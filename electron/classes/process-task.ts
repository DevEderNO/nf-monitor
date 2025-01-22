import {
  IProcessamento,
  ProcessamentoStatus,
} from "../interfaces/processamento";
import {
  unblockFile,
  validXmlAndPdf,
  validZip,
  validateDiretoryFileExists,
} from "../services/file-operation-service";
import { connection } from "websocket";
import { IFileInfo } from "../interfaces/file-info";
import { WSMessageType, WSMessageTyped } from "../interfaces/ws-message";
import { signIn, upload } from "../lib/axios";
import { IDbHistoric } from "../interfaces/db-historic";
import {
  getAuth,
  getConfiguration,
  getFiles,
  updateAuth,
  updateFile,
  updateHistoric,
} from "../services/database";
import { IAuth } from "../interfaces/auth";
import { timeout } from "../lib/time-utils";

export class ProcessTask {
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

  async run(connection: connection, id?: number) {
    try {
      this.initializeProperties(connection);
      this.files = (await getFiles()).filter((x) => !x.wasSend);
      this.filesSended = (await getFiles()).filter((x) => x.wasSend);
      if (id) {
        this.historic.id = id;
      }
      this.viewUploadedFiles =
        (await getConfiguration())?.viewUploadedFiles ?? false;
      if (this.viewUploadedFiles && this.filesSended.length > 0) {
        this.files.push(...this.filesSended);
      }
      this.validateDiretoryFile();
      await this.sendMessageClient([
        "Iniciando o envio dos arquivos para o Sittax",
      ]);
      const progressIncrement = 100 / this.files.length;
      let currentProgress = 0;
      this.auth = await getAuth();
      if (!this.auth?.id) return;
      const resp = await signIn(
        this.auth.username ?? "",
        this.auth.password ?? "",
        true
      );
      if (!resp.Token) {
        this.hasError = true;
        await this.sendMessageClient(
          ["❌ Não foi possível autenticar no Sittax"],
          0,
          ProcessamentoStatus.Stopped
        );
        await timeout(500);
        return;
      }
      this.auth.token = resp.Token;
      await updateAuth({
        id: this.auth.id,
        token: this.auth.token ?? "",
        username: this.auth.username ?? "",
        password: this.auth.password ?? "",
      });
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
            if (element.bloqued) {
              await this.sendMessageClient(
                [`🔓 desbloqueando o arquivo ${element.filepath}`],
                currentProgress
              );
              unblockFile(element.filepath);
            }
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
      if (!this.viewUploadedFiles && this.filesSended.length > 0) {
        this.files.push(...this.filesSended);
      }
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
      this.sendMessageClient(
        ["❌ houve um problema ao enviar os arquivos para o Sittax"],
        0,
        ProcessamentoStatus.Stopped
      );
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
    if (validFile.valid) {
      this.files[index].isValid = true;
      await this.sendMessageClient(
        [`🚀 Enviando ${this.files[index].filepath}`],
        currentProgress
      );
      try {
        await upload(this.auth?.token ?? "", this.files[index].filepath);
        updateFile(this.files[index].filepath, {
          wasSend: true,
          dataSend: new Date(),
        });
        await this.sendMessageClient(
          [`✅ Enviado com sucesso ${this.files[index].filepath}`],
          currentProgress
        );
      } catch (error) {
        this.hasError = true;
        this.sendMessageClient(
          [`❌ Erro ao enviar ${this.files[index].filepath}`],
          currentProgress
        );
        //throw error;
      }
    } else {
      await this.sendMessageClient(
        [
          validFile.isNotaFiscal
            ? `⚠️ Arquivo não é válido por que a data de emissão e anterior 3️⃣ messes ${this.files[index].filepath}`
            : `⚠️ Arquivo não e válido para o envio ${this.files[index].filepath}`,
        ],
        currentProgress,
        ProcessamentoStatus.Running
      );
      this.files[index].isValid = false;
    }
  }

  private async sendZipSittax(index: number, currentProgress: number) {
    const validFile = validZip(this.files[index]);
    if (validFile.valid) {
      this.files[index].isValid = true;
      await this.sendMessageClient(
        [`🚀 Enviando ${this.files[index].filepath}`],
        currentProgress
      );
      try {
        await upload(this.auth?.token ?? "", this.files[index].filepath);
        await this.sendMessageClient(
          [`✅ Enviado com sucesso ${this.files[index].filepath}`],
          currentProgress
        );
        updateFile(this.files[index].filepath, {
          wasSend: true,
          dataSend: new Date(),
        });
      } catch (error) {
        this.hasError = true;
        await this.sendMessageClient(
          [`❌ Erro ao enviar ${this.files[index].filepath}`],
          currentProgress
        );
      }
    } else {
      await this.sendMessageClient(
        [
          validFile.isNotaFiscal
            ? `⚠️ Arquivo não é válido por que a data de emissão e anterior 3️⃣ messes ${this.files[index].filepath}`
            : `⚠️ Arquivo não é válido para o envio ${this.files[index].filepath}`,
        ],
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
    messages.forEach((x) => this.historic.log?.push(x));
    if (
      [ProcessamentoStatus.Concluded, ProcessamentoStatus.Stopped].includes(
        status
      )
    ) {
      this.historic.endDate = new Date();
      if (this.historic.id) {
        await updateHistoric(this.historic);
      }
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
            id: this.historic?.id,
          },
        },
      } as WSMessageTyped<IProcessamento>)
    );
    await timeout();
  }
}
