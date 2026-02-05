import { IProcessamento, ProcessamentoStatus } from '../interfaces/processamento';
import {
  validFile,
  validZip,
  validateDFileExists,
  listFilesInDirectory,
  listSubdirectories,
} from '../services/file-operation-service';
import { connection } from 'websocket';
import { IFileInfo } from '../interfaces/file-info';
import { WSMessageType, WSMessageTyped } from '../interfaces/ws-message';
import { signIn, upload, uploadBatch } from '../lib/axios';
import { IDbHistoric } from '../interfaces/db-historic';
import {
  addHistoric,
  getAuth,
  getConfiguration,
  getCountFilesSended,
  getDirectories,
  removeFiles,
  updateAuth,
  updateFile,
  updateHistoric,
  updateFilesBatch,
  removeFilesBatch,
  getFilesByBasePath,
  addFilesForBasePath,
  getPendingFilesCount,
} from '../services/database';
import { IAuth } from '../interfaces/auth';
import { timeout } from '../lib/time-utils';
import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as crypto from 'crypto';
import AdmZip from 'adm-zip';
import { startPowerSaveBlocker, stopPowerSaveBlocker } from '../lib/power-save';
import { fileLogger } from '../lib/file-logger';

// Yield para não bloquear o event loop
const yieldToEventLoop = () => new Promise<void>(resolve => setImmediate(resolve));

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
  batchSize: number = 500;

  // Tracking de tempo
  private startTime: number = 0;
  private processedCount: number = 0;
  private batchesCompleted: number = 0;
  private filesInCompletedBatches: number = 0;

  private tokenExpireTime: number = 0;
  private readonly TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000;
  private readonly TOKEN_REFRESH_BEFORE_MS = 10 * 60 * 1000;

  // Para processamento incremental
  private totalFilesEstimate: number = 0;
  private directoriesProcessed: number = 0;

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

  // Calcula velocidade e tempo restante
  private getTimeStats(): { speed: number; estimatedTimeRemaining: number } {
    if (this.startTime === 0 || this.filesInCompletedBatches === 0) {
      return { speed: 0, estimatedTimeRemaining: 0 };
    }

    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    if (elapsedSeconds < 1) {
      return { speed: 0, estimatedTimeRemaining: 0 };
    }

    // Usar filesInCompletedBatches para estimativa baseada em uploads reais
    const speed = this.filesInCompletedBatches / elapsedSeconds;
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
    try {
      startPowerSaveBlocker();
      this.initializeProperties(connection);

      await this.sendMessage('Buscando arquivos...');

      const directories = (await getDirectories()).filter(d => d.type === 'invoices');

      this.filesSendedCount = await getCountFilesSended();
      const config = await getConfiguration();
      this.viewUploadedFiles = config?.viewUploadedFiles ?? false;
      this.removeUploadedFiles = config?.removeUploadedFiles ?? false;

      if (directories.length === 0) {
        await this.sendMessage('Nenhum diretório configurado', 100, 0, 0, ProcessamentoStatus.Concluded);
        return;
      }

      // Estimar total de arquivos pendentes para mostrar progresso
      this.totalFilesEstimate = await getPendingFilesCount();
      this.startTime = Date.now();

      if (!(await this.authenticate())) return;

      // Processar cada diretório raiz de forma incremental
      for (const directory of directories) {
        if (this.isCancelled) break;
        await this.processDirectoryIncremental(directory.path);
      }

      // Mensagem final
      if (this.isCancelled) {
        await this.sendMessage(
          `Cancelado. ${this.filesSendedCount} arquivo${this.filesSendedCount !== 1 ? 's' : ''} enviado${this.filesSendedCount !== 1 ? 's' : ''}`,
          0,
          this.processedCount,
          this.max || this.processedCount,
          ProcessamentoStatus.Stopped
        );
        this.reset();
        return;
      }

      if (this.hasError) {
        await this.sendMessage(
          `Concluído com alertas: ${this.filesSendedCount} enviado${this.filesSendedCount !== 1 ? 's' : ''}, ${this.errorCount} não enviado${this.errorCount !== 1 ? 's' : ''}`,
          100,
          this.processedCount,
          this.max || this.processedCount,
          ProcessamentoStatus.Concluded
        );
      } else if (this.filesSendedCount === 0 && this.processedCount === 0) {
        await this.sendMessage('Nenhum arquivo novo encontrado', 100, 0, 0, ProcessamentoStatus.Concluded);
      } else {
        await this.sendMessage(
          `Concluído! ${this.filesSendedCount} arquivo${this.filesSendedCount !== 1 ? 's' : ''} enviado${this.filesSendedCount !== 1 ? 's' : ''}`,
          100,
          this.processedCount,
          this.max || this.processedCount,
          ProcessamentoStatus.Concluded
        );
      }
    } catch (error) {
      fileLogger.error('Erro no processamento de invoices', error);
      await this.sendMessage(
        'Erro no envio',
        0,
        this.processedCount,
        this.max,
        ProcessamentoStatus.Stopped
      );
    }
  }

  /**
   * Processa um diretório de forma incremental (recursivo)
   * Memória constante - processa um diretório por vez
   */
  private async processDirectoryIncremental(dirPath: string): Promise<void> {
    if (this.isCancelled) return;

    // Handle pause
    if (this.isPaused) {
      await this.sendMessage(
        'Envio pausado',
        this.progress,
        this.processedCount,
        this.max || this.totalFilesEstimate,
        ProcessamentoStatus.Paused
      );
      while (this.isPaused && !this.isCancelled) {
        await timeout(500);
      }
      if (this.isCancelled) return;
      await this.sendMessage('Retomando envio...', this.progress, this.processedCount, this.max || this.totalFilesEstimate);
    }

    try {
      // 1. Lista arquivos APENAS deste diretório (não recursivo)
      const diskFiles = await listFilesInDirectory(dirPath);

      if (diskFiles.length > 0) {
        // 2. Busca no banco APENAS arquivos deste basePath
        const dbFilesMap = await getFilesByBasePath(dirPath);
        const existingHashes = new Set(dbFilesMap.keys());

        // 3. Adiciona novos arquivos ao banco (apenas os que não existem)
        await addFilesForBasePath(diskFiles, dirPath, existingHashes);

        // 4. Recarrega o map com os novos arquivos adicionados
        const updatedDbFilesMap = await getFilesByBasePath(dirPath);

        // 5. Filtra arquivos a processar
        const filesToProcess: IFileInfo[] = [];

        for (const diskFile of diskFiles) {
          const hash = crypto.createHash('md5').update(diskFile.filename).digest('base64url');
          const dbEntry = updatedDbFilesMap.get(hash);

          if (dbEntry) {
            const shouldProcess =
              (!dbEntry.wasSend && dbEntry.isValid) ||
              (this.viewUploadedFiles && dbEntry.wasSend);

            if (shouldProcess) {
              filesToProcess.push({
                filepath: diskFile.filepath,
                filename: diskFile.filename,
                extension: diskFile.extension,
                size: diskFile.size,
                modifiedtime: diskFile.modifiedtime,
                isDirectory: false,
                isFile: true,
                id: dbEntry.id,
                wasSend: dbEntry.wasSend,
                isValid: dbEntry.isValid,
                dataSend: dbEntry.dataSend,
                bloqued: false,
              });
            }
          }
        }

        // 6. Processa os arquivos deste diretório
        if (filesToProcess.length > 0) {
          this.max += filesToProcess.length;
          await this.processFilesInDirectory(filesToProcess);
        }
      }

      this.directoriesProcessed++;

      // 7. Lista subdiretórios e processa recursivamente
      const subdirs = await listSubdirectories(dirPath);
      for (const subdir of subdirs) {
        if (this.isCancelled) break;
        await this.processDirectoryIncremental(subdir);
      }
    } catch (error) {
      fileLogger.error(`Erro ao processar diretório: ${dirPath}`, error);
    }
  }

  /**
   * Processa arquivos de um diretório específico
   */
  private async processFilesInDirectory(files: IFileInfo[]): Promise<void> {
    // Separar arquivos normais e ZIPs
    const normalFiles: IFileInfo[] = [];
    const zipFiles: IFileInfo[] = [];

    for (const file of files) {
      if (!validateDFileExists(file)) {
        await removeFiles(file.filepath);
        fileLogger.info(`Arquivo não encontrado: ${file.filepath}`);
        this.processedCount++;
        continue;
      }

      if (file.extension.toLowerCase() === '.zip') {
        zipFiles.push(file);
      } else if (['.xml', '.pdf', '.txt'].includes(file.extension.toLowerCase())) {
        normalFiles.push(file);
      }
    }

    // Processar arquivos normais em lotes
    for (let i = 0; i < normalFiles.length; i += this.batchSize) {
      if (this.isCancelled) return;

      if (this.isPaused) {
        await this.sendMessage(
          'Envio pausado',
          this.progress,
          this.processedCount,
          this.max,
          ProcessamentoStatus.Paused
        );
        while (this.isPaused && !this.isCancelled) {
          await timeout(500);
        }
        if (this.isCancelled) return;
        await this.sendMessage('Retomando envio...', this.progress, this.processedCount, this.max);
      }

      if (!(await this.ensureValidToken())) {
        throw new Error('Falha na autenticação');
      }

      const batch = normalFiles.slice(i, i + this.batchSize);
      await this.processBatchWithRetry(batch);
    }

    // Processar ZIPs
    for (const zipFile of zipFiles) {
      if (this.isCancelled) return;

      if (this.isPaused) {
        await this.sendMessage(
          'Envio pausado',
          this.progress,
          this.processedCount,
          this.max,
          ProcessamentoStatus.Paused
        );
        while (this.isPaused && !this.isCancelled) {
          await timeout(500);
        }
        if (this.isCancelled) return;
        await this.sendMessage('Retomando envio...', this.progress, this.processedCount, this.max);
      }

      if (!(await this.ensureValidToken())) {
        throw new Error('Falha na autenticação');
      }

      // Adiciona o ZIP ao array files para usar processFileWithRetry
      const index = this.files.length;
      this.files.push(zipFile);
      const currentProgress = (this.processedCount / this.max) * 100;
      await this.processFileWithRetry(index, currentProgress);
      this.processedCount++;
    }
  }


  async processBatchWithRetry(batch: IFileInfo[]) {
    if (batch.length === 0) return;

    // Validar arquivos do lote
    const validFiles: IFileInfo[] = [];
    for (const file of batch) {
      const fileValidation = validFile(file, false);
      if (!fileValidation.valid) {
        await updateFile(file.filepath, { isValid: false });
        file.isValid = false;
        fileLogger.info(`Arquivo inválido: ${file.filepath}`);
        this.processedCount++;
        continue;
      }
      file.isValid = true;
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    let attempts = 0;
    let success = false;

    while (attempts < this.maxRetries && !success && !this.isCancelled && !this.isPaused) {
      try {
        attempts++;

        if (attempts > 1) {
          const currentProgress = (this.processedCount / this.max) * 100;
          await this.sendMessage(
            `Tentando novamente... (${attempts}/${this.maxRetries})`,
            currentProgress,
            this.processedCount,
            this.max,
            ProcessamentoStatus.Running
          );
          await timeout(this.retryDelay);
          if (this.isPaused || this.isCancelled) break;
        }

        if (!(await this.ensureValidToken())) {
          throw new Error('Token expirado');
        }


        if (this.isPaused || this.isCancelled) break;

        // Mostrar que está iniciando o envio (primeiro arquivo do lote)
        const firstFileName = this.getFileName(validFiles[0].filepath);
        const currentProgress = (this.processedCount / this.max) * 100;
        await this.sendMessage(
          `Enviando: ${firstFileName}`,
          currentProgress,
          this.processedCount,
          this.max,
          ProcessamentoStatus.Running,
          validFiles[0].filepath
        );

        await uploadBatch(
          this.auth?.token ?? '',
          validFiles.map(f => f.filepath)
        );

        if (this.isCancelled || this.isPaused) break;


        // Atualizar status no banco em LOTE (Aceleração absurda)
        const fileIds: number[] = validFiles.map(f => f.id).filter((id): id is number => id !== undefined);

        await updateFilesBatch(fileIds, {
          wasSend: true,
          dataSend: new Date(),
        });

        // Atualizar memória local
        for (const file of validFiles) {
          file.wasSend = true;
          file.dataSend = new Date();
        }

        this.filesSendedCount += validFiles.length;
        this.processedCount += validFiles.length;

        // Atualizar contadores de lote para estimativa de tempo (MOVIDO PARA CÁ)
        this.batchesCompleted++;
        this.filesInCompletedBatches += validFiles.length;

        // Mostrar progresso visual (UM evento por lote em vez de 300+)
        const lastFileName = this.getFileName(validFiles[validFiles.length - 1].filepath);
        const newProgress = (this.processedCount / this.max) * 100;

        await this.sendMessage(
          `Lote de ${validFiles.length} arquivos enviado. Último: ${lastFileName}`,
          newProgress,
          this.processedCount,
          this.max,
          ProcessamentoStatus.Running,
          validFiles[0].filepath
        );

        if (this.removeUploadedFiles) {
          // Remover do disco (ainda precisa ser loop pois unlink é arquivo por arquivo)
          for (const file of validFiles) {
            try {
              if (fs.existsSync(file.filepath)) {
                fs.unlinkSync(file.filepath);
              }
            } catch (removeError) {
              fileLogger.error(`Erro ao remover arquivo físico: ${file.filepath}`, removeError);
            }
          }
          // Remover do banco EM LOTE
          await removeFilesBatch(fileIds);
        }



        success = true;
      } catch (error: any) {

        fileLogger.error(`Erro ao enviar lote de arquivos`, error);

        if (error.response?.status === 401 || error.message?.includes('Unauthorized')) {
          if (await this.authenticate()) {
            continue;
          }
        }

        if (attempts === this.maxRetries) {
          this.hasError = true;
          this.errorCount += validFiles.length;
          this.processedCount += validFiles.length;
          await this.sendMessage(
            `Não foi possível enviar ${validFiles.length} arquivo${validFiles.length > 1 ? 's' : ''}`,
            (this.processedCount / this.max) * 100,
            this.processedCount,
            this.max,
            ProcessamentoStatus.Running
          );
        }
      }
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
            await this.sendMessage('Falha na autenticação', 0, 0, this.max, ProcessamentoStatus.Stopped);
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
    this.batchesCompleted = 0;
    this.filesInCompletedBatches = 0;
    this.connection = connection;
    this.tokenExpireTime = 0;
    this.totalFilesEstimate = 0;
    this.directoriesProcessed = 0;
    this.files = [];
    this.max = 0;
    this.historic = {
      startDate: new Date(),
      endDate: null,
      filesSent: 0,
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
      this.filesInCompletedBatches++;

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
          await removeFiles(this.files[index].filepath);
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

      const extractedFiles = await this.getExtractedFiles(extractPath);

      if (extractedFiles.length > 0) {
        // Validar arquivos extraídos
        const validExtracted: IFileInfo[] = [];
        for (const extractedFile of extractedFiles) {
          const validExtractedFile = validFile(extractedFile, false);
          if (validExtractedFile.valid) {
            validExtracted.push(extractedFile);
          }
        }

        let successCount = 0;

        // Enviar em lotes
        for (let i = 0; i < validExtracted.length; i += this.batchSize) {
          if (this.isCancelled || this.isPaused) break;

          if (!(await this.ensureValidToken())) {
            throw new Error('Falha na autenticação');
          }

          const batch = validExtracted.slice(i, i + this.batchSize);

          try {
            if (this.isPaused || this.isCancelled) break;

            await uploadBatch(
              this.auth?.token ?? '',
              batch.map(f => f.filepath)
            );
            successCount += batch.length;
            this.filesInCompletedBatches += batch.length;
            this.batchesCompleted++;
          } catch (error: any) {
            fileLogger.error(`Erro ao enviar lote de arquivos extraídos`, error);

            if (error.response?.status === 401 || error.message?.includes('Unauthorized')) {
              if (await this.authenticate()) {
                i -= this.batchSize; // Retentar o mesmo lote
                continue;
              }
            }
            this.hasError = true;
            this.errorCount += batch.length;
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
      await this.removeDirectory(extractPath);

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

  private async getExtractedFiles(extractPath: string): Promise<IFileInfo[]> {
    const files: IFileInfo[] = [];
    const dirQueue: string[] = [extractPath];

    while (dirQueue.length > 0) {
      const dirPath = dirQueue.shift()!;

      try {
        const items = await fsPromises.readdir(dirPath, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(dirPath, item.name);

          try {
            if (item.isDirectory()) {
              dirQueue.push(fullPath);
            } else {
              const ext = path.extname(item.name).toLowerCase();
              if (['.xml', '.pdf', '.txt'].includes(ext)) {
                const stat = await fsPromises.stat(fullPath);
                files.push({
                  filepath: fullPath,
                  filename: item.name,
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
        }

        // Yield a cada diretório para não bloquear o event loop
        await yieldToEventLoop();
      } catch {
        // Diretório inacessível
      }
    }

    return files;
  }

  private async removeDirectory(dirPath: string): Promise<void> {
    try {
      await fsPromises.rm(dirPath, { recursive: true, force: true });
    } catch {
      // Ignorar erro de remoção
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
      this.historic.filesSent = this.filesSendedCount;
      if (this.historic.id && this.historic.id > 0) {
        await updateHistoric(this.historic);
      } else {
        await addHistoric(this.historic);
      }
    }

    // Log inteligente: ignora mensagens de progresso arquivo a arquivo, mantém o resto
    const ignoreLog =
      status === ProcessamentoStatus.Running &&
      (message.startsWith('Enviando:') || message.startsWith('Enviado:'));

    if (!ignoreLog) {
      this.historic.log.push(
        `[${new Date().toLocaleString('pt-BR')}] ${message}${lastFileName ? ` (${lastFileName})` : ''}`
      );
    }

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
