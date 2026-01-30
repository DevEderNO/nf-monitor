import { IProcessamento, ProcessamentoStatus } from '../interfaces/processamento';
import { listarArquivos, validFile, validZip, validateDFileExists } from '../services/file-operation-service';
import { connection } from 'websocket';
import { IFileInfo } from '../interfaces/file-info';
import { WSMessageType, WSMessageTyped } from '../interfaces/ws-message';
import { signIn, upload } from '../lib/axios';
import { IDbHistoric } from '../interfaces/db-historic';
import {
  addFiles,
  addHistoric,
  getAuth,
  getConfiguration,
  getCountFilesSended,
  getDirectories,
  getFiles,
  removeFiles,
  updateAuth,
  updateFile,
  updateHistoric,
} from '../services/database';
import { IAuth } from '../interfaces/auth';
import { timeout } from '../lib/time-utils';
import * as path from 'path';
import * as fs from 'fs';
import AdmZip from 'adm-zip';
import { startPowerSaveBlocker, stopPowerSaveBlocker } from '../lib/power-save';
import { fileLogger } from '../lib/file-logger';

export class InvoiceTask {
  isPaused: boolean;
  isCancelled: boolean;
  connection: connection | null;
  progress: number;
  files: IFileInfo[];
  filesSendedCount: number;
  hasError: boolean;
  historic: IDbHistoric;
  viewUploadedFiles: boolean = false;
  removeUploadedFiles: boolean = false;
  auth: IAuth | null = null;
  max: number = 0;
  maxRetries: number = 3;
  retryDelay: number = 2000;
  errorCount: number = 0;

  // Tracking de tempo
  private startTime: number = 0;
  private processedCount: number = 0;

  private tokenExpireTime: number = 0;
  private readonly TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000;
  private readonly TOKEN_REFRESH_BEFORE_MS = 10 * 60 * 1000;

  constructor() {
    this.isPaused = false;
    this.isCancelled = false;
    this.connection = null;
    this.progress = 0;
    this.files = [];
    this.filesSendedCount = 0;
    this.hasError = false;
    this.errorCount = 0;
    this.historic = {
      startDate: new Date(),
      endDate: null,
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

  // Calcula velocidade e tempo restante
  private getTimeStats(): { speed: number; estimatedTimeRemaining: number } {
    if (this.processedCount === 0 || this.startTime === 0) {
      return { speed: 0, estimatedTimeRemaining: 0 };
    }

    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    const speed = this.processedCount / elapsedSeconds;
    const remaining = this.max - this.processedCount;
    const estimatedTimeRemaining = speed > 0 ? remaining / speed : 0;

    return { speed, estimatedTimeRemaining };
  }

  // Extrai apenas o nome do arquivo de um caminho
  private getFileName(filepath: string): string {
    return path.basename(filepath);
  }

  private isTokenExpiringSoon(): boolean {
    return Date.now() >= this.tokenExpireTime - this.TOKEN_REFRESH_BEFORE_MS;
  }

  private async ensureValidToken(): Promise<boolean> {
    if (!this.isTokenExpiringSoon() && this.auth?.token) {
      return true;
    }
    await this.sendMessage('Reconectando...', this.progress, this.processedCount, this.max);
    return await this.authenticate();
  }

  async run(connection: connection) {
    let lastProcessedIndex = 0;

    try {
      startPowerSaveBlocker();
      this.initializeProperties(connection);

      await this.sendMessage('Buscando arquivos...');

      const directories = await getDirectories();
      await addFiles(await listarArquivos(directories.map(x => x.path)));
      this.files = (await getFiles()).filter(x => !x.wasSend && x.isValid);
      this.filesSendedCount = await getCountFilesSended();
      const config = await getConfiguration();
      this.viewUploadedFiles = config?.viewUploadedFiles ?? false;
      this.removeUploadedFiles = config?.removeUploadedFiles ?? false;

      if (this.viewUploadedFiles && this.filesSendedCount > 0) {
        this.files.push(...(await getFiles()).filter(x => x.wasSend || !x.isValid));
      }

      if (this.files.length === 0) {
        await this.sendMessage('Nenhum arquivo novo encontrado', 100, 0, 0, ProcessamentoStatus.Concluded);
        return;
      }

      this.max = this.files.length;
      this.startTime = Date.now();

      await this.sendMessage(
        `${this.max} arquivo${this.max > 1 ? 's' : ''} encontrado${this.max > 1 ? 's' : ''}`,
        0,
        0,
        this.max
      );

      if (!(await this.authenticate())) return;

      for (let index = 0; index < this.files.length; index++) {
        lastProcessedIndex = index;

        if (this.isCancelled) {
          const sent = this.files.reduce((acc, f) => acc + (f.wasSend ? 1 : 0), 0);
          await this.sendMessage(
            `Cancelado. ${sent} arquivo${sent !== 1 ? 's' : ''} enviado${sent !== 1 ? 's' : ''}`,
            0,
            index,
            this.max,
            ProcessamentoStatus.Stopped
          );
          this.reset();
          return;
        }

        if (this.isPaused) {
          await this.sendMessage('Envio pausado', this.progress, index, this.max, ProcessamentoStatus.Paused);
          while (this.isPaused && !this.isCancelled) {
            await timeout(500);
          }
          if (this.isCancelled) {
            index--;
            continue;
          }
          await this.sendMessage('Retomando envio...', this.progress, index, this.max);
        }

        if (!(await this.ensureValidToken())) {
          throw new Error('Falha na autenticação');
        }

        const currentProgress = ((index + 1) / this.files.length) * 100;
        const element = this.files[index];

        if (element.wasSend) {
          this.processedCount++;
          continue;
        }

        if (!validateDFileExists(element)) {
          await removeFiles(element.filepath);
          fileLogger.info(`Arquivo não encontrado: ${element.filepath}`);
          this.processedCount++;
          continue;
        }

        await this.processFileWithRetry(index, currentProgress);
        this.processedCount++;
      }

      // Mensagem final
      if (this.hasError) {
        const sent = this.files.reduce((acc, f) => acc + (f.wasSend ? 1 : 0), 0);
        await this.sendMessage(
          `Concluído com alertas: ${sent} enviado${sent !== 1 ? 's' : ''}, ${this.errorCount} não enviado${this.errorCount !== 1 ? 's' : ''}`,
          100,
          this.max,
          this.max,
          ProcessamentoStatus.Concluded
        );
      } else {
        await this.sendMessage(
          `Concluído! ${this.filesSendedCount} arquivo${this.filesSendedCount !== 1 ? 's' : ''} enviado${this.filesSendedCount !== 1 ? 's' : ''}`,
          100,
          this.max,
          this.max,
          ProcessamentoStatus.Concluded
        );
      }
    } catch (error) {
      fileLogger.error('Erro no processamento de invoices', error);
      await this.sendMessage(
        'Erro no envio. Tentando novamente...',
        0,
        lastProcessedIndex,
        this.max,
        ProcessamentoStatus.Running
      );
      await this.continueFromIndex(lastProcessedIndex);
    }
  }

  async continueFromIndex(startIndex: number) {
    try {
      if (startIndex < 0 || startIndex >= this.files.length || this.files.length === 0) return;

      await this.sendMessage('Retomando envio...', 0, startIndex, this.max);

      for (let index = startIndex; index < this.files.length; index++) {
        if (this.isCancelled || this.isPaused) break;

        if (!(await this.ensureValidToken())) {
          throw new Error('Falha na autenticação');
        }

        const currentProgress = ((index + 1) / this.files.length) * 100;
        await this.processFileWithRetry(index, currentProgress);
        this.processedCount++;
      }
    } catch (error) {
      fileLogger.error('Erro ao continuar processamento', error);
      await this.sendMessage(
        'Erro no envio',
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
        attempts++;

        if (attempts > 1) {
          await this.sendMessage(
            `Tentando novamente... (${attempts}/${this.maxRetries})`,
            currentProgress,
            index + 1,
            this.max,
            ProcessamentoStatus.Running,
            this.files[index].filepath
          );
          await timeout(this.retryDelay);
          if (this.isPaused || this.isCancelled) break;
        }

        if (!(await this.ensureValidToken())) {
          throw new Error('Token expirado');
        }

        switch (element.extension.toLowerCase()) {
          case '.xml':
          case '.pdf':
          case '.txt':
            success = await this.sendFileToSittax(index, currentProgress);
            break;
          case '.zip':
            success = await this.processZip(index, currentProgress);
            break;
          default:
            success = true;
            break;
        }
      } catch (error: any) {
        fileLogger.error(`Erro ao processar arquivo: ${element.filepath}`, error);

        if (error.response?.status === 401 || error.message?.includes('Unauthorized')) {
          if (await this.authenticate()) {
            continue;
          }
        }

        if (attempts === this.maxRetries) {
          this.hasError = true;
          this.errorCount++;
          await this.sendMessage(
            `Não foi possível enviar: ${this.getFileName(element.filepath)}`,
            currentProgress,
            index + 1,
            this.max,
            ProcessamentoStatus.Running,
            element.filepath
          );
        }
      }
    }
  }

  async authenticate(): Promise<boolean> {
    let attempts = 0;
    const maxAuthRetries = 3;

    while (attempts < maxAuthRetries) {
      if (this.isPaused || this.isCancelled) return false;

      try {
        attempts++;
        this.auth = await getAuth();
        if (!this.auth?.id) return false;

        const resp = await signIn(this.auth.username ?? '', this.auth.password ?? '', true);

        if (!resp.Token) {
          if (attempts === maxAuthRetries) {
            this.hasError = true;
            await this.sendMessage(
              'Falha na autenticação',
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
        this.tokenExpireTime = Date.now() + this.TOKEN_LIFETIME_MS;

        await updateAuth({
          id: this.auth.id,
          token: this.auth.token ?? '',
          username: this.auth.username ?? '',
          password: this.auth.password ?? '',
        });

        return true;
      } catch (error) {
        fileLogger.error('Erro na autenticação', error);
        if (attempts === maxAuthRetries) {
          this.hasError = true;
          await this.sendMessage('Falha na autenticação', 0, 0, this.max, ProcessamentoStatus.Stopped);
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
    this.filesSendedCount = 0;
    this.processedCount = 0;
    this.errorCount = 0;
    this.startTime = 0;
    this.connection = connection;
    this.tokenExpireTime = 0;
    this.historic = {
      startDate: new Date(),
      endDate: null,
      log: [],
    } as IDbHistoric;
  }

  private reset() {
    this.isCancelled = false;
    this.isPaused = false;
    this.hasError = false;
    this.progress = 0;
  }

  private async sendFileToSittax(index: number, currentProgress: number): Promise<boolean> {
    if (this.isPaused || this.isCancelled) return false;

    const fileValidation = validFile(this.files[index], false);
    if (!fileValidation.valid) {
      await updateFile(this.files[index].filepath, { isValid: false });
      this.files[index].isValid = false;
      fileLogger.info(`Arquivo inválido: ${this.files[index].filepath}`);
      return true;
    }

    this.files[index].isValid = true;
    const fileName = this.getFileName(this.files[index].filepath);

    try {
      await this.sendMessage(
        `Enviando: ${fileName}`,
        currentProgress,
        index + 1,
        this.max,
        ProcessamentoStatus.Running,
        this.files[index].filepath
      );

      if (this.isPaused || this.isCancelled) return false;

      await upload(this.auth?.token ?? '', this.files[index].filepath, true);

      if (this.isCancelled || this.isPaused) return false;

      await updateFile(this.files[index].filepath, {
        wasSend: true,
        dataSend: new Date(),
      });

      this.files[index].wasSend = true;
      this.files[index].dataSend = new Date();
      this.filesSendedCount++;

      await this.sendMessage(
        `Enviado: ${fileName}`,
        currentProgress,
        index + 1,
        this.max,
        ProcessamentoStatus.Running,
        this.files[index].filepath
      );

      if (this.removeUploadedFiles) {
        try {
          if (fs.existsSync(this.files[index].filepath)) {
            fs.unlinkSync(this.files[index].filepath);
          }
        } catch (removeError) {
          fileLogger.error(`Erro ao remover arquivo: ${this.files[index].filepath}`, removeError);
        }
      }

      return true;
    } catch (error: any) {
      fileLogger.error(`Erro ao enviar arquivo: ${this.files[index].filepath}`, error);
      this.hasError = true;
      throw error;
    }
  }

  private async processZip(index: number, currentProgress: number): Promise<boolean> {
    if (this.isPaused || this.isCancelled) return false;

    const fileValidation = validZip(this.files[index]);
    if (!fileValidation.valid) {
      await updateFile(this.files[index].filepath, { isValid: false });
      this.files[index].isValid = false;
      return true;
    }

    this.files[index].isValid = true;
    const fileName = this.getFileName(this.files[index].filepath);

    try {
      await this.sendMessage(
        `Processando ZIP: ${fileName}`,
        currentProgress,
        index + 1,
        this.max,
        ProcessamentoStatus.Running,
        this.files[index].filepath
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

      const extractedFiles = this.getExtractedFiles(extractPath);

      if (extractedFiles.length > 0) {
        let successCount = 0;

        for (const extractedFile of extractedFiles) {
          if (this.isCancelled || this.isPaused) break;

          if (!(await this.ensureValidToken())) {
            throw new Error('Falha na autenticação');
          }

          try {
            if (this.isPaused || this.isCancelled) break;

            const validExtractedFile = validFile(extractedFile, false);
            if (validExtractedFile.valid) {
              await upload(this.auth?.token ?? '', extractedFile.filepath, true);
              successCount++;
            }
          } catch (error: any) {
            fileLogger.error(`Erro ao enviar arquivo extraído: ${extractedFile.filepath}`, error);

            if (error.response?.status === 401 || error.message?.includes('Unauthorized')) {
              if (await this.authenticate()) {
                continue;
              }
            }
            this.hasError = true;
            this.errorCount++;
          }
        }

        await this.sendMessage(
          `ZIP processado: ${successCount} arquivo${successCount !== 1 ? 's' : ''} enviado${successCount !== 1 ? 's' : ''}`,
          currentProgress,
          index + 1,
          this.max,
          ProcessamentoStatus.Running,
          this.files[index].filepath
        );
      }

      // Cleanup
      try {
        this.removeDirectory(extractPath);
      } catch {
        // Ignorar erro de cleanup
      }

      await updateFile(this.files[index].filepath, {
        wasSend: true,
        dataSend: new Date(),
      });
      this.files[index].wasSend = true;
      this.files[index].dataSend = new Date();

      return true;
    } catch (error: any) {
      fileLogger.error(`Erro ao processar ZIP: ${this.files[index].filepath}`, error);
      this.hasError = true;
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
          } catch {
            // Arquivo inacessível
          }
        });
      } catch {
        // Diretório inacessível
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

  private async sendMessage(
    message: string,
    progress = 0,
    value = 0,
    max = 0,
    status = ProcessamentoStatus.Running,
    lastFileName?: string
  ) {
    const { speed, estimatedTimeRemaining } = this.getTimeStats();

    if ([ProcessamentoStatus.Concluded, ProcessamentoStatus.Stopped].includes(status)) {
      stopPowerSaveBlocker();
      this.historic.endDate = new Date();
      if (this.historic.id && this.historic.id > 0) {
        await updateHistoric(this.historic);
      } else {
        await addHistoric(this.historic);
      }
    }

    // Log interno com detalhes técnicos
    this.historic.log.push(`[${new Date().toLocaleString('pt-BR')}] ${message}${lastFileName ? ` (${lastFileName})` : ''}`);

    // Mensagem limpa para o usuário
    this.connection?.sendUTF(
      JSON.stringify({
        type: 'message',
        message: {
          type: WSMessageType.Invoice,
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
            lastFileName,
          } as IProcessamento,
        },
      } as WSMessageTyped<IProcessamento>)
    );

    await timeout();
  }
}
