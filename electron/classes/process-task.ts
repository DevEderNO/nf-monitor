import {
  IProcessamento,
  ProcessamentoStatus,
} from "../interfaces/processamento";
import {
  findHistoric,
  getDb,
  getDbHistoric,
  saveDb,
  saveDbHistoric,
  saveLog,
  validXmlAndPdf,
  validZip,
  validateDiretoryFileExists,
} from "../services/file-operation-service";
import { connection } from "websocket";
import { IFileInfo } from "../interfaces/file-info";
import { WSMessageType, WSMessageTyped } from "../interfaces/ws-message";
import { IDb } from "../interfaces/db";
import { signIn, upload } from "../lib/axios";
import { IDbHistoric, IExecution } from "../interfaces/db-historic";

export class ProcessTask {
  isPaused: boolean;
  pausedMessage: string | null;
  isCancelled: boolean;
  cancelledMessage: string | null;
  connection: connection | null;
  progress: number;
  db: IDb;
  files: IFileInfo[];
  filesSended: IFileInfo[];
  hasError: boolean;
  execution: IExecution;
  constructor() {
    this.isPaused = false;
    this.isCancelled = false;
    this.connection = null;
    this.progress = 0;
    this.db = {} as IDb;
    this.files = [];
    this.filesSended = [];
    this.hasError = false;
    this.execution = {} as IExecution;
    this.pausedMessage = null;
    this.cancelledMessage = null;
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

  async run(connection: connection, id: string) {
    try {
      this.initializeProperties(connection);
      this.db = getDb();
      this.files = [...this.db.files.filter((x) => !x.wasSend)];
      this.filesSended = [...this.db.files.filter((x) => x.wasSend)];
      if (
        this.db.configuration.viewUploadedFiles &&
        this.filesSended.length > 0
      ) {
        this.files.push(...this.filesSended);
      }
      this.validateDiretoryFile();
      this.execution = findHistoric(id);
      await this.sendMessageClient([
        "Iniciando o envio dos arquivos para o Sittax",
      ]);
      const progressIncrement = 100 / this.files.length;
      let currentProgress = 0;
      const resp = await signIn(
        this.db.auth.credentials.user,
        this.db.auth.credentials.password,
        true
      );
      this.db.auth.token = resp.Token;
      saveDb(this.db);
      for (let index = 0; index < this.files.length; index++) {
        if (this.isCancelled) {
          if (this.cancelledMessage === null) {
            this.cancelledMessage =
              "Tarefa de envio de arquivo para o Sittax foi cancelada.";
            await this.sendMessageClient(
              [this.cancelledMessage],
              currentProgress,
              ProcessamentoStatus.Stopped
            );
          }
          await this.sendMessageClient([], 0, ProcessamentoStatus.Stopped);
          this.isCancelled = false;
          this.isPaused = false;
          this.hasError = false;
          this.progress = 0;
          saveDb({ ...this.db, files: this.files });
          return;
        }
        if (this.isPaused) {
          if (this.pausedMessage === null) {
            this.pausedMessage =
              "Tarefa de envio de arquivo para o Sittax foi pausada.";
            await this.sendMessageClient(
              [this.pausedMessage],
              currentProgress,
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
                ProcessamentoStatus.Running
              );
              continue;
            }
            await this.sendMessageClient(
              [`☑️ Já foi enviando ${element.filepath}`],
              currentProgress
            );
          } else {
            switch (element.extension) {
              case ".xml":
              case ".pdf":
                await this.sendXmlAndPdfSittax(index, currentProgress);
                break;
              case ".zip":
                await this.sendZipSittax(index, currentProgress);
                break;
              default:
                break;
            }
          }
        }
      }
      if (
        !this.db.configuration.viewUploadedFiles &&
        this.filesSended.length > 0
      ) {
        this.files.push(...this.filesSended);
      }
      saveDb({ ...this.db, files: this.files });
      await this.sendMessageClient(
        [
          this.hasError
            ? "😨 Tarefa concluída com erros."
            : "😁 Tarefa concluída.",
        ],
        100,
        ProcessamentoStatus.Concluded
      );
      await this.sendMessageClient([""], 100, ProcessamentoStatus.Concluded);
    } catch (error) {
      console.log(error);
      this.sendMessageClient(
        ["❌ houve um problema ao enviar os arquivos para o Sittax"],
        0,
        ProcessamentoStatus.Stopped
      );
      saveLog(JSON.stringify(error));
    }
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

  private validateDiretoryFile() {
    const validatedFiles: IFileInfo[] = [];
    this.files.forEach((file) => {
      if (validateDiretoryFileExists(file)) {
        validatedFiles.push(file);
      }
    });
    this.files = validatedFiles;
  }

  private async sendXmlAndPdfSittax(index: number, currentProgress: number) {
    const validFile = validXmlAndPdf(this.files[index]);
    if (validFile) {
      this.files[index].isValid = true;
      await this.sendMessageClient(
        [`🚀 Enviando ${this.files[index].filepath}`],
        currentProgress
      );
      try {
        await upload(this.db.auth.token, validFile.filepath);
        this.files[index].wasSend = true;
        this.files[index].dataSend = new Date();
        await this.sendMessageClient(
          [`✅ Enviado com sucesso ${this.files[index].filepath}`],
          currentProgress
        );
      } catch (error) {
        this.hasError = true;
        saveLog(JSON.stringify(error));
        this.sendMessageClient(
          [`❌ Erro ao enviar ${this.files[index].filepath}`],
          currentProgress
        );
        throw error;
      }
    } else {
      await this.sendMessageClient(
        [`⚠️ Arquivo não e válido para o envio ${this.files[index].filepath}`],
        currentProgress,
        ProcessamentoStatus.Running
      );
      this.files[index].isValid = false;
    }
  }

  private async sendZipSittax(index: number, currentProgress: number) {
    const validFile = validZip(this.files[index]);
    if (validFile) {
      this.files[index].isValid = true;
      await this.sendMessageClient(
        [`🚀 Enviando ${this.files[index].filepath}`],
        currentProgress
      );
      try {
        await upload(this.db.auth.token, this.files[index].filepath);
        await this.sendMessageClient(
          [`✅ Enviado com sucesso ${this.files[index].filepath}`],
          currentProgress
        );
        this.files[index].wasSend = true;
        this.files[index].dataSend = new Date();
      } catch (error) {
        console.log(error);
        this.hasError = true;
        await this.sendMessageClient(
          [`❌ Erro ao enviar ${this.files[index].filepath}`],
          currentProgress
        );
      }
    } else {
      await this.sendMessageClient(
        [`⚠️ Arquivo não e válido para o envio ${this.files[index].filepath}`],
        currentProgress,
        ProcessamentoStatus.Running
      );
      this.files[index].isValid = false;
    }
  }

  private async sendMessageClient(
    messages: string[],
    progress = 0,
    status = ProcessamentoStatus.Running
  ) {
    await timeout();
    messages.forEach((x) => this.execution.log?.push(x));
    if (
      [ProcessamentoStatus.Concluded, ProcessamentoStatus.Stopped].includes(
        status
      )
    ) {
      const dbHistoric: IDbHistoric = getDbHistoric();
      this.execution.endDate = new Date();
      dbHistoric.executions = [
        this.execution,
        ...dbHistoric.executions.filter((x) => x.id !== this.execution.id),
      ];
      saveDbHistoric(dbHistoric);
    }
    this.connection?.sendUTF(
      JSON.stringify({
        type: "message",
        message: {
          type: WSMessageType.Process,
          data: {
            messages,
            progress,
            status,
            id: this.execution?.id,
          },
        },
      } as WSMessageTyped<IProcessamento>)
    );
    await timeout();
  }
}

function timeout(time?: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, time ?? 50);
  });
}
