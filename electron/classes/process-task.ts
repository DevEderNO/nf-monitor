import {
  IProcessamento,
  ProcessamentoStatus,
} from "../interfaces/processamento";
import {
  isFileBlocked,
  listarArquivos,
  unblockFile,
  validXmlAndPdf,
  validZip,
  validateDFileExists,
} from "../services/file-operation-service";
import { connection } from "websocket";
import { IFileInfo } from "../interfaces/file-info";
import { WSMessageType, WSMessageTyped } from "../interfaces/ws-message";
import { signIn, upload } from "../lib/axios";
import { IDbHistoric } from "../interfaces/db-historic";
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
} from "../services/database";
import { IAuth } from "../interfaces/auth";
import { timeout } from "../lib/time-utils";
import { XHealthType } from "../interfaces/health-message";
import { healthBrokerComunication } from "../services/health-broker-service";

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
  max: number = 0;
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
    try {
      this.initializeProperties(connection);
      const directories = await getDirectories();
      await this.sendMessageClient(["🔎 Realizando a descoberta dos arquivos"]);
      await healthBrokerComunication(
        XHealthType.Info,
        `Iniciado processo de envio de arquivos para o Sittax`,
      );
      await addFiles(await listarArquivos(directories.map((x) => x.path)));
      this.files = (await getFiles()).filter((x) => !x.wasSend && x.isValid);
      this.filesSended = (await getFiles()).filter(
        (x) => x.wasSend || !x.isValid,
      );
      this.viewUploadedFiles =
        (await getConfiguration())?.viewUploadedFiles ?? false;
      if (this.viewUploadedFiles && this.filesSended.length > 0) {
        this.files.push(...this.filesSended);
      }
      if (this.files.length > 0) {
        await this.sendMessageClient([
          "🚀 Iniciando o envio dos arquivos para o Sittax",
        ]);
        const progressIncrement = 100 / this.files.length;
        this.max = this.files.length;
        let currentProgress = 0;
        if (!(await this.authenticate())) return;
        for (let index = 0; index < this.files.length; index++) {
          if (this.isCancelled) {
            this.cancelledMessage ??= `Tarefa de envio de arquivo para o Sittax foi cancelada. Foram enviados ${this.files.reduce((acc, file) => acc + (file.wasSend ? 1 : 0), 0)} arquivos e ${this.files.reduce((acc, file) => acc + (file.isValid ? 0 : 1), 0)} arquivos inválidos.`;
            await this.sendMessageClient(
              [this.cancelledMessage],
              0,
              index + 1,
              this.max,
              ProcessamentoStatus.Stopped,
            );
            await healthBrokerComunication(
              XHealthType.Warning,
              this.cancelledMessage,
            );
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
                index + 1,
                this.max,
                ProcessamentoStatus.Paused,
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
                  ProcessamentoStatus.Running,
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
                ProcessamentoStatus.Running,
              );
            } else {
              if (!validateDFileExists(element)) {
                await this.sendMessageClient(
                  [
                    `🗑️ O arquivo ${element.filepath} não existe, será removido da lista de arquivos`,
                  ],
                  currentProgress,
                  index + 1,
                  this.max,
                  ProcessamentoStatus.Running,
                );
                await removeFiles(element.filepath);
                continue;
              }
              if (process.platform === "win32") {
                if (isFileBlocked(element.filepath)) {
                  await this.sendMessageClient(
                    [`🔓 desbloqueando o arquivo ${element.filepath}`],
                    currentProgress,
                    index + 1,
                    this.max,
                    ProcessamentoStatus.Running,
                  );
                  unblockFile(element.filepath);
                }
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
      } else {
        await this.sendMessageClient(
          ["🥲 Não foram encontrados novos arquivos para o envio"],
          100,
          0,
          this.max,
          ProcessamentoStatus.Concluded,
        );
        await healthBrokerComunication(
          XHealthType.Success,
          `Não foram encontrados novos arquivos para o envio`,
        );
      }
      const message = this.hasError
        ? `😨 Tarefa concluída com erros. Foram enviados ${this.files.reduce((acc, file) => acc + (file.wasSend ? 1 : 0), 0)} arquivos e ${this.files.reduce((acc, file) => acc + (file.isValid ? 0 : 1), 0)} arquivos inválidos.`
        : `😁 Tarefa concluída. Foram enviados ${this.filesSended.length} arquivos.`;
      await this.sendMessageClient(
        [message, ""],
        100,
        this.max,
        this.max,
        ProcessamentoStatus.Concluded,
      );
      await healthBrokerComunication(
        this.hasError ? XHealthType.Error : XHealthType.Success,
        message,
      );
    } catch (error) {
      this.sendMessageClient(
        ["❌ houve um problema ao enviar os arquivos para o Sittax"],
        0,
        0,
        this.max,
        ProcessamentoStatus.Stopped,
      );
      await healthBrokerComunication(
        XHealthType.Error,
        `Houve um problema ao enviar os arquivos para o Sittax`,
      );
    }
  }

  async authenticate(): Promise<boolean> {
    this.auth = await getAuth();
    if (!this.auth?.id) return false;
    const resp = await signIn(
      this.auth.username ?? "",
      this.auth.password ?? "",
      true,
    );
    if (!resp.Token) {
      this.hasError = true;
      await this.sendMessageClient(
        ["❌ Não foi possível autenticar no Sittax"],
        0,
        0,
        this.max,
        ProcessamentoStatus.Stopped,
      );
      await healthBrokerComunication(
        XHealthType.Error,
        `Não foi possível autenticar no Sittax`,
      );
      await timeout(500);
      return false;
    }
    this.auth.token = resp.Token;
    await updateAuth({
      id: this.auth.id,
      token: this.auth.token ?? "",
      username: this.auth.username ?? "",
      password: this.auth.password ?? "",
    });
    return true;
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

  // private validateDiretoryFile() {
  //   const validatedFiles: IFileInfo[] = [];
  //   this.files.forEach((file) => {
  //     if (validateDiretoryFileExists(file)) {
  //       validatedFiles.push(file);
  //     }
  //   });
  //   this.files = validatedFiles;
  // }

  private async sendXmlAndPdfSittax(index: number, currentProgress: number) {
    const validFile = validXmlAndPdf(this.files[index]);
    if (validFile.valid) {
      this.files[index].isValid = true;
      try {
        await upload(this.auth?.token ?? "", this.files[index].filepath);
        updateFile(this.files[index].filepath, {
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
          ProcessamentoStatus.Running,
        );
      } catch (error) {
        this.hasError = true;
        this.sendMessageClient(
          [`❌ Erro ao enviar ${this.files[index].filepath}`],
          currentProgress,
          index + 1,
          this.max,
          ProcessamentoStatus.Running,
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
        index + 1,
        this.max,
        ProcessamentoStatus.Running,
      );
      await updateFile(this.files[index].filepath, {
        isValid: false,
      });
      this.files[index].isValid = false;
    }
  }

  private async sendZipSittax(index: number, currentProgress: number) {
    const validFile = validZip(this.files[index]);
    if (validFile.valid) {
      this.files[index].isValid = true;
      await this.sendMessageClient(
        [`🚀 Enviando ${this.files[index].filepath}`],
        currentProgress,
        index + 1,
        this.max,
        ProcessamentoStatus.Running,
      );
      try {
        await upload(this.auth?.token ?? "", this.files[index].filepath);
        await this.sendMessageClient(
          [`✅ Enviado com sucesso ${this.files[index].filepath}`],
          currentProgress,
          index + 1,
          this.max,
          ProcessamentoStatus.Running,
        );
        updateFile(this.files[index].filepath, {
          wasSend: true,
          dataSend: new Date(),
        });
      } catch (error) {
        this.hasError = true;
        await this.sendMessageClient(
          [`❌ Erro ao enviar ${this.files[index].filepath}`],
          currentProgress,
          index + 1,
          this.max,
          ProcessamentoStatus.Running,
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
        index + 1,
        this.max,
        ProcessamentoStatus.Running,
      );
      await updateFile(this.files[index].filepath, {
        isValid: false,
      });
      this.files[index].isValid = false;
    }
  }

  private async sendMessageClient(
    messages: string[],
    progress = 0,
    value = 0,
    max = 0,
    status = ProcessamentoStatus.Running,
    replace = false,
  ) {
    await timeout();
    messages.forEach((x) => this.historic.log?.push(x));
    if (
      [ProcessamentoStatus.Concluded, ProcessamentoStatus.Stopped].includes(
        status,
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
            value,
            max,
            status,
            replace,
            id: this.historic?.id,
          },
        },
      } as WSMessageTyped<IProcessamento>),
    );
    await timeout();
  }
}
