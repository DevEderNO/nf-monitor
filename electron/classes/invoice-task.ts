import { IProcessamento, ProcessamentoStatus } from '../interfaces/processamento';
import {
  isFileBlocked,
  listarArquivos,
  unblockFile,
  validFile,
  validZip,
  validateDFileExists,
} from '../services/file-operation-service';
import { connection } from 'websocket';
import { IFileInfo } from '../interfaces/file-info';
import { WSMessageType, WSMessageTyped } from '../interfaces/ws-message';
import { signIn, upload } from '../lib/axios';
import { IDbHistoric } from '../interfaces/db-historic';
import {
  addFiles,
  getAuth,
  getConfiguration,
  getDirectories,
  getFiles,
  removeFiles,
  updateAuth,
  updateFile,
  updateHistoric,
} from '../services/database';
import { IAuth } from '../interfaces/auth';
import { getTimestamp, timeout } from '../lib/time-utils';
import { XHealthType } from '../interfaces/health-message';
import { healthBrokerComunication } from '../services/health-broker-service';
import * as path from 'path';
import * as fs from 'fs';

const AdmZip = require('adm-zip');

export class InvoiceTask {
  isPaused: boolean;
  pausedMessage: string | null;
  isCancelled: boolean;
  cancelledMessage: string | null;
  connection: connection | null;
  progress: number;
  files: IFileInfo[];
  filesSended: IFileInfo[];
  hasError: boolean;
  historic: IDbHistoric;
  viewUploadedFiles: boolean = false;
  auth: IAuth | null = null;
  max: number = 0;
  maxRetries: number = 3;
  retryDelay: number = 2000;

  constructor() {
    this.isPaused = false;
    this.isCancelled = false;
    this.connection = null;
    this.progress = 0;
    this.files = [];
    this.filesSended = [];
    this.hasError = false;
    this.historic = {
      startDate: new Date(),
      endDate: null,
      log: [],
    } as IDbHistoric;
    this.pausedMessage = null;
    this.cancelledMessage = null;
    this.max = 0;
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
    this.pausedMessage = null;
  }

  cancel() {
    this.isCancelled = true;
  }

  async run(connection: connection) {
    let lastProcessedIndex = 0;

    try {
      this.initializeProperties(connection);
      const directories = await getDirectories();
      await this.sendMessageClient(['🔎 Realizando a descoberta dos arquivos']);
      await healthBrokerComunication(XHealthType.Info, `Iniciado processo de envio de arquivos para o Sittax`);
      await addFiles(await listarArquivos(directories.map(x => x.path)));
      this.files = (await getFiles()).filter(x => !x.wasSend && x.isValid);
      this.filesSended = (await getFiles()).filter(x => x.wasSend || !x.isValid);
      this.viewUploadedFiles = (await getConfiguration())?.viewUploadedFiles ?? false;
      if (this.viewUploadedFiles && this.filesSended.length > 0) {
        this.files.push(...this.filesSended);
      }
      if (this.files.length > 0) {
        await this.sendMessageClient(['🚀 Iniciando o envio dos arquivos para o Sittax']);
        const progressIncrement = 100 / this.files.length;
        this.max = this.files.length;
        let currentProgress = 0;

        if (!(await this.authenticate())) return;

        for (let index = 0; index < this.files.length; index++) {
          lastProcessedIndex = index;

          if (this.isCancelled) {
            this.cancelledMessage ??= `Tarefa de envio de arquivo para o Sittax foi cancelada. Foram enviados ${this.files.reduce((acc, file) => acc + (file.wasSend ? 1 : 0), 0)} arquivos e ${this.files.reduce((acc, file) => acc + (file.isValid ? 0 : 1), 0)} arquivos inválidos.`;
            await this.sendMessageClient([this.cancelledMessage], 0, index + 1, this.max, ProcessamentoStatus.Stopped);
            await healthBrokerComunication(XHealthType.Warning, this.cancelledMessage);
            this.isCancelled = false;
            this.isPaused = false;
            this.hasError = false;
            this.progress = 0;
            return;
          }

          if (this.isPaused) {
            if (this.pausedMessage === null) {
              this.pausedMessage = 'Tarefa de envio de arquivo para o Sittax foi pausada.';
              await this.sendMessageClient(
                [this.pausedMessage],
                currentProgress,
                index + 1,
                this.max,
                ProcessamentoStatus.Paused
              );
            }
            await timeout(500);
            index--;
          } else {
            currentProgress = this.progress + progressIncrement * (index + 1);
            const element = this.files[index];

            if (element.wasSend) {
              if (!element.isValid) {
                await this.sendMessageClient(
                  [`⚠️ Arquivo não e válido para o envio ${element.filepath}`],
                  currentProgress,
                  index + 1,
                  this.max,
                  ProcessamentoStatus.Running
                );
                await updateFile(element.filepath, {
                  isValid: false,
                });
                this.files[index].isValid = false;
                continue;
              }
              await this.sendMessageClient(
                [`☑️ Já foi enviando ${element.filepath}`],
                currentProgress,
                index + 1,
                this.max,
                ProcessamentoStatus.Running
              );
            } else {
              if (!validateDFileExists(element)) {
                await this.sendMessageClient(
                  [`🗑️ O arquivo ${element.filepath} não existe, será removido da lista de arquivos`],
                  currentProgress,
                  index + 1,
                  this.max,
                  ProcessamentoStatus.Running
                );
                await removeFiles(element.filepath);
                continue;
              }

              if (process.platform === 'win32') {
                if (isFileBlocked(element.filepath)) {
                  await this.sendMessageClient(
                    [`🔓 desbloqueando o arquivo ${element.filepath}`],
                    currentProgress,
                    index + 1,
                    this.max,
                    ProcessamentoStatus.Running
                  );
                  unblockFile(element.filepath);
                }
              }

              await this.processFileWithRetry(index, currentProgress);
            }
          }
        }
      } else {
        await this.sendMessageClient(
          ['🥲 Não foram encontrados novos arquivos para o envio'],
          100,
          0,
          this.max,
          ProcessamentoStatus.Concluded
        );
        await healthBrokerComunication(XHealthType.Success, `Não foram encontrados novos arquivos para o envio`);
      }

      const message = this.hasError
        ? `😨 Tarefa concluída com erros. Foram enviados ${this.files.reduce((acc, file) => acc + (file.wasSend ? 1 : 0), 0)} arquivos e ${this.files.reduce((acc, file) => acc + (file.isValid ? 0 : 1), 0)} arquivos inválidos.`
        : `😁 Tarefa concluída. Foram enviados ${this.filesSended.length} arquivos.`;

      await this.sendMessageClient([message], 100, this.max, this.max, ProcessamentoStatus.Concluded);

      await healthBrokerComunication(this.hasError ? XHealthType.Error : XHealthType.Success, message);
    } catch (error) {

      await this.sendMessageClient(
        [`❌ Houve um problema ao enviar os arquivos para o Sittax: ${error}`],
        0,
        lastProcessedIndex,
        this.max,
        ProcessamentoStatus.Running
      );

      await healthBrokerComunication(
        XHealthType.Error,
        `Houve um problema ao enviar os arquivos para o Sittax. Continuando do arquivo ${lastProcessedIndex + 1}`
      );

      await this.continueFromIndex(lastProcessedIndex);
    }
  }

  async continueFromIndex(startIndex: number) {
    try {
      await this.sendMessageClient([`🔄 Continuando o processo do arquivo ${startIndex + 1}`]);

      const progressIncrement = 100 / this.files.length;

      for (let index = startIndex; index < this.files.length; index++) {
        if (this.isCancelled || this.isPaused) break;

        const currentProgress = this.progress + progressIncrement * (index + 1);
        await this.processFileWithRetry(index, currentProgress);
      }
    } catch (error) {
      await this.sendMessageClient(
        ['❌ houve um problema ao enviar os arquivos para o Sittax'],
        0,
        startIndex,
        this.max,
        ProcessamentoStatus.Stopped
      );
    }
  }

  async processFileWithRetry(index: number, currentProgress: number) {
    const element = this.files[index];
    let attempts = 0;
    let success = false;

    while (attempts < this.maxRetries && !success && !this.isCancelled && !this.isPaused) {
      try {

        if (this.isPaused || this.isCancelled) break;
        attempts++;

        if (attempts > 1) {
          await this.sendMessageClient(
            [`🔄 Tentativa ${attempts}/${this.maxRetries} para ${element.filepath}`],
            currentProgress,
            index + 1,
            this.max,
            ProcessamentoStatus.Running
          );
          await timeout(this.retryDelay);
        }

        switch (element.extension) {
          case '.xml':
          case '.pdf':
          case '.txt':
            success = await this.sendInvoicesFileToSittax(index, currentProgress);
            break;
          case '.zip':
            success = await this.extractAndProcessZip(index, currentProgress);
            break;
          default:
            success = true;
            break;
        }
      } catch (error) {
        if (attempts === this.maxRetries) {
          this.hasError = true;
          await this.sendMessageClient(
            [`❌ Falha definitiva após ${this.maxRetries} tentativas: ${element.filepath}`],
            currentProgress,
            index + 1,
            this.max,
            ProcessamentoStatus.Stopped
          );
        }
      }
    }
  }

  async authenticate(): Promise<boolean> {
    let attempts = 0;
    const maxAuthRetries = 3;

    while (attempts < maxAuthRetries) {
      try {
        attempts++;
        this.auth = await getAuth();
        if (!this.auth?.id) return false;

        const resp = await signIn(this.auth.username ?? '', this.auth.password ?? '', true);

        if (!resp.Token) {
          if (attempts === maxAuthRetries) {
            this.hasError = true;
            await this.sendMessageClient(
              ['❌ Não foi possível autenticar no Sittax após múltiplas tentativas'],
              0,
              0,
              this.max,
              ProcessamentoStatus.Stopped
            );
            await healthBrokerComunication(
              XHealthType.Error,
              `Não foi possível autenticar no Sittax após ${maxAuthRetries} tentativas`
            );
            return false;
          }
          await timeout(2000);
          continue;
        }

        this.auth.token = resp.Token;
        await updateAuth({
          id: this.auth.id,
          token: this.auth.token ?? '',
          username: this.auth.username ?? '',
          password: this.auth.password ?? '',
        });
        return true;
      } catch (error) {
        if (attempts === maxAuthRetries) {
          this.hasError = true;
          await this.sendMessageClient(
            ['❌ Erro na autenticação no Sittax'],
            0,
            0,
            this.max,
            ProcessamentoStatus.Stopped
          );
          return false;
        }
        await timeout(2000);
      }
    }
    return false;
  }

  private initializeProperties(connection: connection) {
    this.isCancelled = false;
    this.cancelledMessage = null;
    this.isPaused = false;
    this.pausedMessage = null;
    this.hasError = false;
    this.progress = 0;
    this.filesSended = [];
    this.connection = connection;
  }

  private async sendInvoicesFileToSittax(index: number, currentProgress: number): Promise<boolean> {
    const file = validFile(this.files[index], false);

    if (file.valid) {
      this.files[index].isValid = true;
      try {
        await this.sendMessageClient(
          [`🚀 Enviando ${this.files[index].filepath}`],
          currentProgress,
          index + 1,
          this.max,
          ProcessamentoStatus.Running
        );

        await upload(this.auth?.token ?? '', this.files[index].filepath, true);
        await updateFile(this.files[index].filepath, {
          wasSend: true,
          dataSend: new Date(),
        });
        this.files[index].wasSend = true;
        this.files[index].dataSend = new Date();
        await this.sendMessageClient(
          [`✅ Enviado com sucesso ${this.files[index].filepath}`],
          currentProgress,
          index + 1,
          this.max,
          ProcessamentoStatus.Running
        );
        return true;
      } catch (error: any) {
        this.hasError = true;
        let errorMessage = `❌ Erro ao enviar ${this.files[index].filepath} \n Erro: ${error}`;

        if (error.code === 'ERR_BAD_RESPONSE') {
          if (error.config?.headers?.['Content-Length']) {
            const sizeInMB = (parseInt(error.config.headers['Content-Length']) / (1024 * 1024)).toFixed(2);
            errorMessage = `❌ Arquivo muito grande (${sizeInMB}MB): ${this.files[index].filepath}`;
          } else if (error.response?.status === 400) {
            errorMessage = `❌ Servidor rejeitou o arquivo: ${this.files[index].filepath}`;
          }
        }
        await this.sendMessageClient([errorMessage], currentProgress, index + 1, this.max, ProcessamentoStatus.Running);
        throw error;
      }
    } else {
      await this.sendMessageClient(
        [
          file.isNotaFiscal
            ? `⚠️ Arquivo não é válido por que a data de emissão e anterior 3️⃣ messes ${this.files[index].filepath}`
            : `⚠️ Arquivo não e válido para o envio ${this.files[index].filepath}`,
        ],
        currentProgress,
        index + 1,
        this.max,
        ProcessamentoStatus.Running
      );
      await updateFile(this.files[index].filepath, {
        isValid: false,
      });
      this.files[index].isValid = false;
      return true;
    }
  }

  private async extractAndProcessZip(index: number, currentProgress: number): Promise<boolean> {
    const file = validZip(this.files[index]);
    if (!file.valid) {
      await this.sendMessageClient(
        [
          file.isNotaFiscal
            ? `⚠️ Arquivo não é válido por que a data de emissão e anterior 3️⃣ messes ${this.files[index].filepath}`
            : `⚠️ Arquivo não é válido para o envio ${this.files[index].filepath}`,
        ],
        currentProgress,
        index + 1,
        this.max,
        ProcessamentoStatus.Running
      );
      await updateFile(this.files[index].filepath, {
        isValid: false,
      });
      this.files[index].isValid = false;
      return true;
    }

    this.files[index].isValid = true;

    try {
      await this.sendMessageClient(
        [`📦 Extraindo arquivo ZIP ${this.files[index].filepath}`],
        currentProgress,
        index + 1,
        this.max,
        ProcessamentoStatus.Running
      );

      const zip = new AdmZip(this.files[index].filepath);
      const extractPath = path.join(
        path.dirname(this.files[index].filepath),
        'extracted_' + Date.now() + '_' + path.basename(this.files[index].filepath, '.zip')
      );

      if (!fs.existsSync(extractPath)) {
        fs.mkdirSync(extractPath, { recursive: true });
      }

      zip.extractAllTo(extractPath, true);

      await this.sendMessageClient(
        [`✅ Arquivo ZIP extraído para ${extractPath}`],
        currentProgress,
        index + 1,
        this.max,
        ProcessamentoStatus.Running
      );

      const extractedFiles = this.getExtractedFiles(extractPath);

      if (extractedFiles.length > 0) {
        await this.sendMessageClient(
          [`📁 Encontrados ${extractedFiles.length} arquivos para envio`],
          currentProgress,
          index + 1,
          this.max,
          ProcessamentoStatus.Running
        );

        let successCount = 0;
        let errorCount = 0;

        for (const extractedFile of extractedFiles) {
          try {
            if (this.isCancelled || this.isPaused) break;

            await this.sendMessageClient(
              [`🚀 Enviando arquivo extraído: ${extractedFile.filename}`],
              currentProgress,
              index + 1,
              this.max,
              ProcessamentoStatus.Running
            );

            const validExtractedFile = validFile(extractedFile, false);
            if (validExtractedFile.valid) {
              await upload(this.auth?.token ?? '', extractedFile.filepath, true);
              successCount++;

              await this.sendMessageClient(
                [`✅ Arquivo extraído enviado com sucesso: ${extractedFile.filename}`],
                currentProgress,
                index + 1,
                this.max,
                ProcessamentoStatus.Running
              );
            } else {
              errorCount++;
              await this.sendMessageClient(
                [`⚠️ Arquivo extraído não é válido: ${extractedFile.filename}`],
                currentProgress,
                index + 1,
                this.max,
                ProcessamentoStatus.Running
              );
            }
          } catch (error: any) {
            errorCount++;
            this.hasError = true;
            let errorMessage = `❌ Erro ao enviar arquivo extraído ${extractedFile.filename} \n Erro: ${error}`;

            if (error.code === 'ERR_BAD_RESPONSE') {
              if (error.config?.headers?.['Content-Length']) {
                const sizeInMB = (parseInt(error.config.headers['Content-Length']) / (1024 * 1024)).toFixed(2);
                errorMessage = `❌ Arquivo extraído muito grande (${sizeInMB}MB): ${extractedFile.filename}`;
              } else if (error.response?.status === 400) {
                errorMessage = `❌ Servidor rejeitou o arquivo extraído: ${extractedFile.filename}`;
              }
            }

            await this.sendMessageClient(
              [errorMessage],
              currentProgress,
              index + 1,
              this.max,
              ProcessamentoStatus.Running
            );
          }
        }

        try {
          this.removeDirectory(extractPath);
          await this.sendMessageClient(
            [`🧹 Diretório temporário removido: ${extractPath}`],
            currentProgress,
            index + 1,
            this.max,
            ProcessamentoStatus.Running
          );
        } catch (cleanupError) {
          await this.sendMessageClient(
            [`⚠️ Não foi possível remover diretório temporário: ${extractPath}`],
            currentProgress,
            index + 1,
            this.max,
            ProcessamentoStatus.Running
          );
        }

        await updateFile(this.files[index].filepath, {
          wasSend: true,
          dataSend: new Date(),
        });
        this.files[index].wasSend = true;
        this.files[index].dataSend = new Date();

        await this.sendMessageClient(
          [`📊 Processamento do ZIP concluído: ${successCount} enviados, ${errorCount} com erro`],
          currentProgress,
          index + 1,
          this.max,
          ProcessamentoStatus.Running
        );

        return true;
      } else {
        await this.sendMessageClient(
          [`⚠️ Nenhum arquivo válido encontrado no ZIP ${this.files[index].filepath}`],
          currentProgress,
          index + 1,
          this.max,
          ProcessamentoStatus.Running
        );

        try {
          this.removeDirectory(extractPath);
        } catch (cleanupError) {}

        await updateFile(this.files[index].filepath, {
          wasSend: true,
          dataSend: new Date(),
        });
        this.files[index].wasSend = true;
        this.files[index].dataSend = new Date();

        return true;
      }
    } catch (error: any) {
      this.hasError = true;
      const errorMessage = `❌ Erro ao processar ZIP ${this.files[index].filepath}: ${error.message}`;
      await this.sendMessageClient([errorMessage], currentProgress, index + 1, this.max, ProcessamentoStatus.Running);
      throw error;
    }
  }

  private getExtractedFiles(extractPath: string): IFileInfo[] {
    const files: IFileInfo[] = [];

    const scanDirectory = (dirPath: string) => {
      try {
        const items = fs.readdirSync(dirPath);

        items.forEach(item => {
          const fullPath = path.join(dirPath, item);
          try {
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
              scanDirectory(fullPath);
            } else {
              const ext = path.extname(item).toLowerCase();
              if (['.xml', '.pdf', '.txt'].includes(ext)) {
                files.push({
                  filepath: fullPath,
                  filename: item,
                  extension: ext,
                  size: stat.size,
                  dateCreated: stat.birthtime,
                  dateModified: stat.mtime,
                  wasSend: false,
                  isValid: true,
                  dataSend: null,
                } as any);
              }
            }
          } catch (statError) {
            console.warn(`Não foi possível acessar: ${fullPath}`, statError);
          }
        });
      } catch (readError) {
        console.warn(`Não foi possível ler diretório: ${dirPath}`, readError);
      }
    };

    scanDirectory(extractPath);
    return files;
  }

  private removeDirectory(dirPath: string) {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);

      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          this.removeDirectory(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      });

      fs.rmdirSync(dirPath);
    }
  }

  private async sendMessageClient(
    messages: string[],
    progress = 0,
    value = 0,
    max = 0,
    status = ProcessamentoStatus.Running,
    replace = false
  ) {
    await timeout();

    const timestampedMessages = messages.map(message => {
      return `${getTimestamp()} - ${message}`;
    });

    timestampedMessages.forEach(x => this.historic.log?.push(x));

    if ([ProcessamentoStatus.Concluded, ProcessamentoStatus.Stopped].includes(status)) {
      this.historic.endDate = new Date();
      if (this.historic.id) {
        await updateHistoric(this.historic);
      }
    }

    this.connection?.sendUTF(
      JSON.stringify({
        type: 'message',
        message: {
          type: WSMessageType.Invoice,
          data: {
            messages: timestampedMessages,
            progress,
            value,
            max,
            status,
            replace,
            id: this.historic?.id,
          },
        },
      } as WSMessageTyped<IProcessamento>)
    );

    await timeout();
  }
}
