import { IProcessamento, ProcessamentoStatus } from '../interfaces/processamento';
import { listarArquivos, validFile, validateDFileExists } from '../services/file-operation-service';
import { connection } from 'websocket';
import { IFileInfo } from '../interfaces/file-info';
import { WSMessageType, WSMessageTyped } from '../interfaces/ws-message';
import { signIn, upload } from '../lib/axios';
import { IDbHistoric } from '../interfaces/db-historic';
import {
  addFiles,
  getAuth,
  getConfiguration,
  getCountFilesSendedPfx,
  getDirectories,
  getFiles,
  removeFiles,
  updateAuth,
  updateFile,
  updateHistoric,
} from '../services/database';
import { IAuth } from '../interfaces/auth';
import { timeout } from '../lib/time-utils';
import { startPowerSaveBlocker, stopPowerSaveBlocker } from '../lib/power-save';
import { fileLogger } from '../lib/file-logger';
import * as path from 'path';
import * as crypto from 'crypto';

export class CertificateTask {
  isPaused: boolean;
  isCancelled: boolean;
  connection: connection | null;
  progress: number;
  files: IFileInfo[];
  filesSended: number;
  hasError: boolean;
  historic: IDbHistoric;
  viewUploadedFiles: boolean = false;
  auth: IAuth | null = null;
  max: number = 0;
  maxRetries: number = 3;
  retryDelay: number = 2000;

  // Campos para controle de tempo e velocidade
  private startTime: number = 0;
  private processedCount: number = 0;
  private lastSpeedUpdate: number = 0;
  private recentProcessingTimes: number[] = [];
  private currentFileName: string = '';

  constructor() {
    this.isPaused = false;
    this.isCancelled = false;
    this.connection = null;
    this.progress = 0;
    this.files = [];
    this.filesSended = 0;
    this.hasError = false;
    this.historic = {
      startDate: new Date(),
      endDate: null,
      filesSent: 0,
      log: [],
    } as IDbHistoric;
    this.max = 0;
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  cancel() {
    this.isCancelled = true;
  }

  private calculateSpeed(): number {
    if (this.recentProcessingTimes.length < 2) return 0;
    const avgTime =
      this.recentProcessingTimes.reduce((a, b) => a + b, 0) / this.recentProcessingTimes.length;
    return avgTime > 0 ? 1000 / avgTime : 0;
  }

  private calculateETA(): number {
    const speed = this.calculateSpeed();
    if (speed <= 0) return 0;
    const remaining = this.max - this.processedCount;
    return remaining / speed;
  }

  private recordProcessingTime() {
    const now = Date.now();
    if (this.lastSpeedUpdate > 0) {
      const timeTaken = now - this.lastSpeedUpdate;
      this.recentProcessingTimes.push(timeTaken);
      if (this.recentProcessingTimes.length > 10) {
        this.recentProcessingTimes.shift();
      }
    }
    this.lastSpeedUpdate = now;
    this.processedCount++;
  }

  async run(connection: connection) {
    let lastProcessedIndex = 0;

    try {
      startPowerSaveBlocker();
      this.initializeProperties(connection);
      this.startTime = Date.now();

      const directories = (await getDirectories()).filter(d => d.type === 'certificates');
      await this.sendProgress('Buscando arquivos...', 0, 0, 0, ProcessamentoStatus.Running);

      const diskFiles = await listarArquivos(directories.map(x => x.path));
      await addFiles(diskFiles);

      this.filesSended = await getCountFilesSendedPfx();
      const config = await getConfiguration();
      this.viewUploadedFiles = config?.viewUploadedFiles ?? false;
      const dbFiles = await getFiles();

      this.files = [];
      const viewLocalMethod = this.viewUploadedFiles;

      for (const diskFile of diskFiles) {
        const hash = crypto.createHash('md5').update(diskFile.filename).digest('base64url');

        const dbEntry = dbFiles.find(
          db => db.filename === hash && db.basePath === path.dirname(diskFile.filepath)
        );

        if (dbEntry) {
          if ((!dbEntry.wasSend && dbEntry.isValid) || (viewLocalMethod && dbEntry.wasSend)) {
            this.files.push({
              ...diskFile,
              id: dbEntry.id,
              wasSend: dbEntry.wasSend,
              isValid: dbEntry.isValid,
              dataSend: dbEntry.dataSend
            });
          }
        }
      }

      if (this.files.length === 0) {
        await this.sendProgress(
          'Nenhum documento novo encontrado',
          100,
          0,
          0,
          ProcessamentoStatus.Concluded
        );
        return;
      }

      this.max = this.files.length;
      await this.sendProgress(
        `${this.max} documento${this.max !== 1 ? 's' : ''} encontrado${this.max !== 1 ? 's' : ''}`,
        0,
        0,
        this.max,
        ProcessamentoStatus.Running
      );

      if (!(await this.authenticate())) return;

      await this.sendProgress('Iniciando envio...', 0, 0, this.max, ProcessamentoStatus.Running);

      for (let index = 0; index < this.files.length; index++) {
        lastProcessedIndex = index;

        if (this.isCancelled) {
          const enviados = this.files.filter(f => f.wasSend).length;
          await this.sendProgress(
            `Cancelado. ${enviados} documento${enviados !== 1 ? 's' : ''} enviado${enviados !== 1 ? 's' : ''}`,
            0,
            index,
            this.max,
            ProcessamentoStatus.Stopped
          );
          this.resetState();
          return;
        }

        if (this.isPaused) {
          await this.sendProgress(
            'Envio pausado',
            this.calculateCurrentProgress(index),
            index,
            this.max,
            ProcessamentoStatus.Paused
          );
          await timeout(500);
          index--;
          continue;
        }

        const element = this.files[index];
        this.currentFileName = element.filepath;
        const currentProgress = this.calculateCurrentProgress(index + 1);

        if (element.wasSend && !this.viewUploadedFiles) {
          if (!element.isValid) {
            await updateFile(element.filepath, { isValid: false });
            this.files[index].isValid = false;
            this.recordProcessingTime();
            continue;
          }
          this.recordProcessingTime();
          await this.sendProgress(
            'Verificando documentos já enviados...',
            currentProgress,
            index + 1,
            this.max,
            ProcessamentoStatus.Running
          );
          continue;
        }

        if (!validateDFileExists(element)) {
          fileLogger.info('Arquivo não encontrado, removido da lista', { filepath: element.filepath });
          await removeFiles(element.filepath);
          this.recordProcessingTime();
          continue;
        }

        await this.processFileWithRetry(index, currentProgress);
      }

      const enviados = this.filesSended;
      const mensagem = this.hasError
        ? `Concluído com alguns erros. ${enviados} documento${enviados !== 1 ? 's' : ''} enviado${enviados !== 1 ? 's' : ''}`
        : `Concluído! ${enviados} documento${enviados !== 1 ? 's' : ''} enviado${enviados !== 1 ? 's' : ''}`;

      await this.sendProgress(mensagem, 100, this.max, this.max, ProcessamentoStatus.Concluded);
    } catch (error) {
      fileLogger.error('Erro durante o processamento de documentos', { error, lastProcessedIndex });
      await this.sendProgress(
        'Ocorreu um erro. Tentando continuar...',
        0,
        lastProcessedIndex,
        this.max,
        ProcessamentoStatus.Running
      );
      await this.continueFromIndex(lastProcessedIndex);
    }
  }

  private calculateCurrentProgress(processedIndex: number): number {
    if (this.max === 0) return 0;
    return (processedIndex / this.max) * 100;
  }

  private resetState() {
    this.isCancelled = false;
    this.isPaused = false;
    this.hasError = false;
    this.progress = 0;
  }

  async continueFromIndex(startIndex: number) {
    try {
      if (this.files.length === 0) return;

      await this.sendProgress(
        'Retomando envio...',
        this.calculateCurrentProgress(startIndex),
        startIndex,
        this.max,
        ProcessamentoStatus.Running
      );

      for (let index = startIndex; index < this.files.length; index++) {
        if (this.isCancelled || this.isPaused) break;
        const currentProgress = this.calculateCurrentProgress(index + 1);
        await this.processFileWithRetry(index, currentProgress);
      }
    } catch (error) {
      fileLogger.error('Erro ao continuar processamento de documentos', { error, startIndex });
      await this.sendProgress(
        'Erro ao continuar o envio',
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
          await this.sendProgress(
            `Tentando novamente (${attempts}/${this.maxRetries})...`,
            currentProgress,
            index + 1,
            this.max,
            ProcessamentoStatus.Running
          );
          await timeout(this.retryDelay);
        }

        switch (element.extension.toLowerCase()) {
          case '.pdf':
          case '.pfx':
            success = await this.sendCertificatesToSittax(index, currentProgress);
            break;
          default:
            success = true;
            break;
        }

        if (success) {
          this.recordProcessingTime();
        }
      } catch (error) {
        if (attempts === this.maxRetries) {
          this.hasError = true;
          fileLogger.error('Falha definitiva ao enviar documento', {
            filepath: element.filepath,
            attempts,
            error,
          });
          await this.sendProgress(
            `Não foi possível enviar o documento`,
            currentProgress,
            index + 1,
            this.max,
            ProcessamentoStatus.Running
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
        if (!this.auth?.id) {
          await this.sendProgress(
            'Configure suas credenciais para continuar',
            0,
            0,
            this.max,
            ProcessamentoStatus.Stopped
          );
          return false;
        }

        const resp = await signIn(this.auth.username ?? '', this.auth.password ?? '', true);

        if (!resp.Token) {
          if (attempts === maxAuthRetries) {
            this.hasError = true;
            fileLogger.error('Falha na autenticação após múltiplas tentativas', { attempts });
            await this.sendProgress(
              'Não foi possível conectar. Verifique suas credenciais',
              0,
              0,
              this.max,
              ProcessamentoStatus.Stopped
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
        fileLogger.error('Erro durante autenticação', { error, attempt: attempts });
        if (attempts === maxAuthRetries) {
          this.hasError = true;
          await this.sendProgress(
            'Erro de conexão. Tente novamente mais tarde',
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
    this.isPaused = false;
    this.hasError = false;
    this.progress = 0;
    this.filesSended = 0;
    this.connection = connection;
    this.startTime = 0;
    this.processedCount = 0;
    this.lastSpeedUpdate = 0;
    this.recentProcessingTimes = [];
    this.currentFileName = '';
  }

  private async sendCertificatesToSittax(index: number, currentProgress: number): Promise<boolean> {
    const file = validFile(this.files[index], true);

    if (file.valid) {
      this.files[index].isValid = true;
      try {
        this.currentFileName = this.files[index].filepath;

        await this.sendProgress(
          `Enviando documento...`,
          currentProgress,
          index + 1,
          this.max,
          ProcessamentoStatus.Running
        );

        const uploadPromise = upload(this.auth?.token ?? '', this.files[index].filepath, true);

        while (true) {
          if (this.isCancelled || this.isPaused) {
            return false;
          }

          const done = await Promise.race([
            uploadPromise.then(() => true),
            new Promise(res => setTimeout(() => res(false), 200)),
          ]);

          if (done) break;
        }

        await updateFile(this.files[index].filepath, {
          wasSend: true,
          dataSend: new Date(),
        });
        this.files[index].wasSend = true;
        this.files[index].dataSend = new Date();
        this.filesSended++;

        await this.sendProgress(
          `Documento enviado`,
          currentProgress,
          index + 1,
          this.max,
          ProcessamentoStatus.Running
        );
        return true;
      } catch (error: any) {
        this.hasError = true;

        let logMessage = 'Erro ao enviar documento';
        const logDetails: Record<string, unknown> = {
          filepath: this.files[index].filepath,
          error: error.message || error,
        };

        if (error.code === 'ERR_BAD_RESPONSE') {
          if (error.config?.headers?.['Content-Length']) {
            const sizeInMB = (parseInt(error.config.headers['Content-Length']) / (1024 * 1024)).toFixed(2);
            logDetails.size = `${sizeInMB}MB`;
            logMessage = 'Arquivo muito grande para envio';
          } else if (error.response?.status === 400) {
            logMessage = 'Servidor rejeitou o arquivo';
          }
        }

        fileLogger.error(logMessage, logDetails);

        await this.sendProgress(
          'Erro ao enviar documento',
          currentProgress,
          index + 1,
          this.max,
          ProcessamentoStatus.Running
        );
        throw error;
      }
    } else {
      const logDetails = {
        filepath: this.files[index].filepath,
        isNotaFiscal: file.isNotaFiscal,
        reason: file.isNotaFiscal ? 'Data de emissão anterior a 3 meses' : 'Arquivo inválido',
      };
      fileLogger.info('Documento ignorado', logDetails);

      await updateFile(this.files[index].filepath, { isValid: false });
      this.files[index].isValid = false;
      return true;
    }
  }

  private async sendProgress(
    message: string,
    progress = 0,
    value = 0,
    max = 0,
    status = ProcessamentoStatus.Running
  ) {
    if ([ProcessamentoStatus.Concluded, ProcessamentoStatus.Stopped].includes(status)) {
      stopPowerSaveBlocker();
      this.historic.endDate = new Date();
      this.historic.filesSent = this.filesSended;
      if (this.historic.id) {
        await updateHistoric(this.historic);
      }
    }

    // Log inteligente: ignora mensagens de progresso arquivo a arquivo, mantém o resto
    const ignoreLog =
      status === ProcessamentoStatus.Running &&
      (message.startsWith('Enviando') || message.startsWith('Documento enviado') || message.startsWith('ZIP processado'));

    if (!ignoreLog) {
      this.historic.log.push(
        `[${new Date().toLocaleString('pt-BR')}] ${message}`
      );
    }

    const speed = this.calculateSpeed();
    const estimatedTimeRemaining = this.calculateETA();

    this.connection?.sendUTF(
      JSON.stringify({
        type: 'message',
        message: {
          type: WSMessageType.Certificates,
          data: {
            message,
            progress,
            value,
            max,
            status,
            replace: false,
            id: this.historic?.id,
            startTime: this.startTime,
            estimatedTimeRemaining,
            speed,
            lastFileName: this.currentFileName,
          },
        },
      } as WSMessageTyped<IProcessamento>)
    );

    await timeout();
  }
}
