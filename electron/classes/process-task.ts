import {
  IProcessamento,
  ProcessamentoStatus,
} from "../interfaces/processamento";
import {
  getDb,
  saveDb,
  validXmlAndPdf,
  validZip,
} from "../services/file-operation-service";
import { connection } from "websocket";
import { IFileInfo } from "../interfaces/file-info";
import { WSMessageType, WSMessageTyped } from "../interfaces/ws-message";
import { IDb } from "../interfaces/db";

export class ProcessTask {
  isPaused: boolean;
  isCancelled: boolean;
  connection: connection | null;
  progress: number;
  db: IDb;
  files: IFileInfo[];
  constructor() {
    this.isPaused = false;
    this.isCancelled = false;
    this.connection = null;
    this.progress = 0;
    this.db = {} as IDb;
    this.files = [];
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

  async run(connection: connection) {
    this.isCancelled = false;
    this.isPaused = false;
    this.progress = 0;
    this.connection = connection;
    this.db = { ...JSON.parse(getDb()) };
    this.files = this.db.files;
    this.sendMessageStartTask();
    console.log(this.files.length);
    const progressIncrement = 100 / this.files.length;
    let currentProgress = 0;
    for (let index = 0; index < this.files.length; index++) {
      if (this.isCancelled) {
        this.sendMessageCancelTask(currentProgress);
        return;
      }
      if (this.isPaused) {
        await new Promise((resolve) => {
          setTimeout(resolve, 500);
        });
        index--;
        this.sendMessagePauseTask(currentProgress);
      } else {
        currentProgress = this.progress + progressIncrement * (index + 1);
        const element = this.files[index];
        if (element.wasSend) {
          if (!element.isValid) {
            this.sendMessageIsInvalidFile(element.filepath, currentProgress);
            continue;
          }
          this.sendMessageWasSendFile(element.filepath, currentProgress);
        } else {
          switch (element.extension) {
            case ".xml":
            case ".pdf":
              this.sendXmlAndPdfSittax(index, currentProgress);
              break;
            case ".zip":
              this.sendZipSittax(index, currentProgress);
              break;
            default:
              break;
          }
        }
      }
    }
    saveDb({ ...this.db, files: this.files });
    this.sendMessageCompleteTask();
  }

  private sendXmlAndPdfSittax(index: number, currentProgress: number) {
    const validFile = validXmlAndPdf(this.files[index]);
    if (validFile) {
      this.sendMessageSendFile(this.files[index], currentProgress);
      this.files[index].isValid = true;
    } else {
      this.sendMessageIsInvalidFile(
        this.files[index].filepath,
        currentProgress
      );
      this.files[index].isValid = false;
    }
    this.files[index].wasSend = true;
    this.files[index].dataSend = new Date();
  }

  private sendZipSittax(index: number, currentProgress: number) {
    const validFile = validZip(this.files[index]);
    if (validFile) {
      this.sendMessageSendFile(this.files[index], currentProgress);
      this.files[index].isValid = true;
    } else {
      this.sendMessageIsInvalidFile(
        this.files[index].filepath,
        currentProgress
      );
      this.files[index].isValid = false;
    }
    this.files[index].wasSend = true;
    this.files[index].dataSend = new Date();
  }

  private sendMessageCompleteTask() {
    const response = {
      type: "message",
      message: {
        type: WSMessageType.Process,
        data: {
          messages: ["😁 Tarefa concluída."],
          progress: 100,
          status: ProcessamentoStatus.Concluded,
        },
      },
    };
    this.connection?.sendUTF(JSON.stringify(response));
  }

  private sendMessageSendFile(file: IFileInfo, currentProgress: number) {
    const response = {
      type: "message",
      message: {
        type: WSMessageType.Process,
        data: {
          messages: [`🚀 Enviando ${file.filepath}`],
          progress: currentProgress,
          status: ProcessamentoStatus.Running,
        },
      },
    };
    this.connection?.sendUTF(JSON.stringify(response));
  }

  private sendMessageWasSendFile(filepath: string, currentProgress: number) {
    const response = {
      type: "message",
      message: {
        type: WSMessageType.Process,
        data: {
          messages: [`☑️ Já foi enviando ${filepath}`],
          progress: currentProgress,
          status: ProcessamentoStatus.Running,
        },
      },
    };
    this.connection?.sendUTF(JSON.stringify(response));
  }

  private sendMessageIsInvalidFile(filepath: string, currentProgress: number) {
    const response = {
      type: "message",
      message: {
        type: WSMessageType.Process,
        data: {
          messages: [`⚠️ Arquivo não e válido para o envio ${filepath}`],
          progress: currentProgress,
          status: ProcessamentoStatus.Running,
        },
      },
    };
    this.connection?.sendUTF(JSON.stringify(response));
  }

  private sendMessagePauseTask(currentProgress: number) {
    const response = {
      type: "message",
      message: {
        type: WSMessageType.Process,
        data: {
          messages: ["Tarefa de envio de arquivo para o Sittax foi pausada."],
          progress: currentProgress,
          status: ProcessamentoStatus.Paused,
        },
      },
    };
    this.connection?.sendUTF(JSON.stringify(response));
  }

  private sendMessageCancelTask(currentProgress: number) {
    const response = {
      type: "message",
      message: {
        type: WSMessageType.Process,
        data: {
          messages: ["Tarefa de envio de arquivo para o Sittax foi cancelada."],
          progress: currentProgress,
          status: ProcessamentoStatus.Stopped,
        },
      },
    };
    this.connection?.sendUTF(JSON.stringify(response));
  }

  private sendMessageStartTask() {
    const response: WSMessageTyped<IProcessamento> = {
      type: "message",
      message: {
        type: WSMessageType.Process,
        data: {
          messages: ["Iniciando o envio dos arquivos para o Sittax"],
          progress: 0,
          status: ProcessamentoStatus.Running,
        },
      },
    };
    this.connection?.sendUTF(JSON.stringify(response));
  }
}
