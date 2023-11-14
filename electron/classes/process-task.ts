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
  validXmlAndPdf,
  validZip,
} from "../services/file-operation-service";
import { connection } from "websocket";
import { IFileInfo } from "../interfaces/file-info";
import { WSMessageType, WSMessageTyped } from "../interfaces/ws-message";
import { IDb } from "../interfaces/db";
import { api } from "../lib/axios";
import FormData from "form-data";
import { createReadStream } from "fs";
import { IDbHistoric, IExecution } from "../interfaces/db-historic";

export class ProcessTask {
  isPaused: boolean;
  isCancelled: boolean;
  connection: connection | null;
  progress: number;
  db: IDb;
  files: IFileInfo[];
  hasError: boolean;
  execution: IExecution;
  constructor() {
    this.isPaused = false;
    this.isCancelled = false;
    this.connection = null;
    this.progress = 0;
    this.db = {} as IDb;
    this.files = [];
    this.hasError = false;
    this.execution = {} as IExecution;
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

  async run(connection: connection, id: string) {
    this.isCancelled = false;
    this.isPaused = false;
    this.hasError = false;
    this.progress = 0;
    this.connection = connection;
    this.db = { ...getDb() };
    this.files = this.db.files;
    this.execution = findHistoric(id);
    await this.sendMessageClient([
      "Iniciando o envio dos arquivos para o Sittax",
    ]);
    const progressIncrement = 100 / this.files.length;
    let currentProgress = 0;
    for (let index = 0; index < this.files.length; index++) {
      if (this.isCancelled) {
        await this.sendMessageClient(
          ["Tarefa de envio de arquivo para o Sittax foi cancelada."],
          currentProgress,
          ProcessamentoStatus.Stopped
        );
        this.isCancelled = false;
        this.isPaused = false;
        this.hasError = false;
        this.progress = 0;
        return;
      }
      if (this.isPaused) {
        await new Promise((resolve) => {
          setTimeout(resolve, 500);
        });
        index--;
        await this.sendMessageClient(
          ["Tarefa de envio de arquivo para o Sittax foi pausada."],
          currentProgress,
          ProcessamentoStatus.Paused
        );
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
  }

  private async sendXmlAndPdfSittax(index: number, currentProgress: number) {
    const validFile = validXmlAndPdf(this.files[index]);
    if (validFile) {
      this.files[index].isValid = true;
      await this.sendMessageClient(
        [`🚀 Enviando ${this.files[index].filepath}`],
        currentProgress
      );
      const form = new FormData();
      form.append("arquivo", createReadStream(validFile.filepath));
      try {
        await api.post("upload/importar-arquivo", form, {
          headers: {
            ...form.getHeaders,
            Authorization: `Bearer ${this.db.auth.token}`,
          },
        });
        this.files[index].wasSend = true;
        this.files[index].dataSend = new Date();
        await this.sendMessageClient(
          [`✅ Enviado com sucesso ${this.files[index].filepath}`],
          currentProgress
        );
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

  private async sendZipSittax(index: number, currentProgress: number) {
    const validFile = validZip(this.files[index]);
    if (validFile) {
      this.files[index].isValid = true;
      await this.sendMessageClient(
        [`🚀 Enviando ${this.files[index].filepath}`],
        currentProgress
      );
      const form = new FormData();
      form.append("arquivo", createReadStream(this.files[index].filepath));
      try {
        await api.post("upload/importar-arquivo", form, {
          headers: {
            ...form.getHeaders,
            Authorization: this.db.auth.token,
          },
        });
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
    messages.forEach((x) => this.execution.log?.push(x));
    if (
      [ProcessamentoStatus.Concluded, ProcessamentoStatus.Stopped].includes(
        status
      )
    ) {
      const dbHistoric: IDbHistoric = getDbHistoric();
      this.execution.endDate = new Date();
      dbHistoric.executions = [
        ...dbHistoric.executions.filter((x) => x.id !== this.execution.id),
        this.execution,
      ];
      saveDbHistoric(dbHistoric);
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });
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
  }
}
