import {
  IProcessamento,
  ProcessamentoStatus,
} from "../interfaces/processamento";
import {
  listarArquivos,
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
  private isPaused = false;
  private pausedMessage: string | null = null;
  private isCancelled = false;
  private cancelledMessage: string | null = null;
  private connection: connection | null = null;
  private progress = 0;
  private files: IFileInfo[] = [];
  private filesSended: IFileInfo[] = [];
  private hasError = false;
  private viewUploadedFiles = false;
  private auth: IAuth | null = null;
  private max = 0;

  private historic: IDbHistoric = {
    startDate: new Date(),
    endDate: null,
    log: [],
  } as IDbHistoric;

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    this.pausedMessage = null;
  }

  cancel(): void {
    this.isCancelled = true;
  }

  async run(connection: connection): Promise<void> {
    try {
      this.initializeProperties(connection);
      await this.discoverFiles();
      await this.processFiles();
      await this.sendCompletionMessage();
    } catch (error) {
      await this.handleError();
    }
  }

  private async discoverFiles(): Promise<void> {
    const directories = await getDirectories();
    await this.sendMessageClient(["🔎 Realizando a descoberta dos arquivos"]);
    await healthBrokerComunication(
      XHealthType.Info,
      "Iniciado processo de envio de arquivos para o Sittax",
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
  }

  private async processFiles(): Promise<void> {
    if (this.files.length === 0) {
      await this.handleNoFilesFound();
      return;
    }

    await this.sendMessageClient([
      "🚀 Iniciando o envio dos arquivos para o Sittax",
    ]);

    const progressIncrement = 100 / this.files.length;
    this.max = this.files.length;

    if (!(await this.authenticate())) return;

    for (let index = 0; index < this.files.length; index++) {
      if (this.isCancelled) {
        await this.handleCancellation(index);
        return;
      }

      if (this.isPaused) {
        await this.handlePause(index);
        index--;
        continue;
      }

      const currentProgress = this.progress + progressIncrement * (index + 1);
      await this.processFile(index, currentProgress);
    }
  }

  private async processFile(
    index: number,
    currentProgress: number,
  ): Promise<void> {
    const file = this.files[index];

    if (file.wasSend) {
      await this.handleAlreadySentFile(file, currentProgress, index);
      return;
    }

    if (!validateDFileExists(file)) {
      await this.handleMissingFile(file, currentProgress, index);
      return;
    }

    switch (file.extension) {
      case ".xml":
      case ".pdf":
        await this.sendXmlAndPdfSittax(index, currentProgress);
        break;
      case ".zip":
        await this.sendZipSittax(index, currentProgress);
        break;
    }
  }

  private async handleAlreadySentFile(
    file: IFileInfo,
    currentProgress: number,
    index: number,
  ): Promise<void> {
    if (!file.isValid) {
      await this.sendMessageClient(
        [`⚠️ Arquivo não é válido para o envio ${file.filepath}`],
        currentProgress,
        index + 1,
        this.max,
        ProcessamentoStatus.Running,
      );
      await updateFile(file.filepath, { isValid: false });
      this.files[index].isValid = false;
      return;
    }

    await this.sendMessageClient(
      [`☑️ Já foi enviado ${file.filepath}`],
      currentProgress,
      index + 1,
      this.max,
      ProcessamentoStatus.Running,
    );
  }

  private async handleMissingFile(
    file: IFileInfo,
    currentProgress: number,
    index: number,
  ): Promise<void> {
    await this.sendMessageClient(
      [
        `🗑️ O arquivo ${file.filepath} não existe, será removido da lista de arquivos`,
      ],
      currentProgress,
      index + 1,
      this.max,
      ProcessamentoStatus.Running,
    );
    await removeFiles(file.filepath);
  }

  private async handleNoFilesFound(): Promise<void> {
    await this.sendMessageClient(
      ["🥲 Não foram encontrados novos arquivos para o envio"],
      100,
      0,
      this.max,
      ProcessamentoStatus.Concluded,
    );
    await healthBrokerComunication(
      XHealthType.Success,
      "Não foram encontrados novos arquivos para o envio",
    );
  }

  private async handleCancellation(index: number): Promise<void> {
    const sentCount = this.files.reduce(
      (acc, file) => acc + (file.wasSend ? 1 : 0),
      0,
    );
    const invalidCount = this.files.reduce(
      (acc, file) => acc + (file.isValid ? 0 : 1),
      0,
    );

    this.cancelledMessage ??= `Tarefa de envio de arquivo para o Sittax foi cancelada. Foram enviados ${sentCount} arquivos e ${invalidCount} arquivos inválidos.`;

    await this.sendMessageClient(
      [this.cancelledMessage],
      0,
      index + 1,
      this.max,
      ProcessamentoStatus.Stopped,
    );

    await healthBrokerComunication(XHealthType.Warning, this.cancelledMessage);
    this.resetState();
  }

  private async handlePause(index: number): Promise<void> {
    if (this.pausedMessage === null) {
      this.pausedMessage =
        "Tarefa de envio de arquivo para o Sittax foi pausada.";
      await this.sendMessageClient(
        [this.pausedMessage],
        this.progress,
        index + 1,
        this.max,
        ProcessamentoStatus.Paused,
      );
    }
    await timeout(500);
  }

  private async authenticate(): Promise<boolean> {
    this.auth = await getAuth();
    if (!this.auth?.id) return false;

    const resp = await signIn(
      this.auth.username ?? "",
      this.auth.password ?? "",
    );

    if (!resp.Token) {
      await this.handleAuthenticationError();
      return false;
    }

    this.auth.token = resp.Token;
    await updateAuth({
      id: this.auth.id,
      token: this.auth.token,
      username: this.auth.username ?? "",
      password: this.auth.password ?? "",
    });

    return true;
  }

  private async handleAuthenticationError(): Promise<void> {
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
      "Não foi possível autenticar no Sittax",
    );
    await timeout(500);
  }

  private initializeProperties(connection: connection): void {
    this.isCancelled = false;
    this.cancelledMessage = null;
    this.isPaused = false;
    this.pausedMessage = null;
    this.hasError = false;
    this.progress = 0;
    this.filesSended = [];
    this.connection = connection;
  }

  private resetState(): void {
    this.isCancelled = false;
    this.isPaused = false;
    this.hasError = false;
    this.progress = 0;
  }

  private async sendXmlAndPdfSittax(
    index: number,
    currentProgress: number,
  ): Promise<void> {
    const file = this.files[index];
    const validFile = validXmlAndPdf(file);

    if (!validFile.valid) {
      await this.handleInvalidFile(file, validFile, currentProgress, index);
      return;
    }

    file.isValid = true;

    try {
      await upload(this.auth?.token ?? "", file.filepath);
      await this.handleSuccessfulUpload(file, currentProgress, index);
    } catch (error) {
      await this.handleUploadError(file, currentProgress, index);
    }
  }

  private async sendZipSittax(
    index: number,
    currentProgress: number,
  ): Promise<void> {
    const file = this.files[index];
    const validFile = validZip(file);

    if (!validFile.valid) {
      await this.handleInvalidFile(file, validFile, currentProgress, index);
      return;
    }

    file.isValid = true;

    await this.sendMessageClient(
      [`🚀 Enviando ${file.filepath}`],
      currentProgress,
      index + 1,
      this.max,
      ProcessamentoStatus.Running,
    );

    try {
      await upload(this.auth?.token ?? "", file.filepath);
      await this.handleSuccessfulUpload(file, currentProgress, index);
    } catch (error) {
      await this.handleUploadError(file, currentProgress, index);
    }
  }

  private async handleInvalidFile(
    file: IFileInfo,
    validFile: any,
    currentProgress: number,
    index: number,
  ): Promise<void> {
    const message = validFile.isNotaFiscal
      ? `⚠️ Arquivo não é válido porque a data de emissão é anterior a 3 meses ${file.filepath}`
      : `⚠️ Arquivo não é válido para o envio ${file.filepath}`;

    await this.sendMessageClient(
      [message],
      currentProgress,
      index + 1,
      this.max,
      ProcessamentoStatus.Running,
    );

    await updateFile(file.filepath, { isValid: false });
    file.isValid = false;
  }

  private async handleSuccessfulUpload(
    file: IFileInfo,
    currentProgress: number,
    index: number,
  ): Promise<void> {
    await updateFile(file.filepath, {
      wasSend: true,
      dataSend: new Date(),
    });

    file.wasSend = true;
    file.dataSend = new Date();

    await this.sendMessageClient(
      [`✅ Enviado com sucesso ${file.filepath}`],
      currentProgress,
      index + 1,
      this.max,
      ProcessamentoStatus.Running,
    );
  }

  private async handleUploadError(
    file: IFileInfo,
    currentProgress: number,
    index: number,
  ): Promise<void> {
    this.hasError = true;
    await this.sendMessageClient(
      [`❌ Erro ao enviar ${file.filepath}`],
      currentProgress,
      index + 1,
      this.max,
      ProcessamentoStatus.Running,
    );
  }

  private async sendCompletionMessage(): Promise<void> {
    const sentCount = this.files.reduce(
      (acc, file) => acc + (file.wasSend ? 1 : 0),
      0,
    );
    const invalidCount = this.files.reduce(
      (acc, file) => acc + (file.isValid ? 0 : 1),
      0,
    );

    const message = this.hasError
      ? `😨 Tarefa concluída com erros. Foram enviados ${sentCount} arquivos e ${invalidCount} arquivos inválidos.`
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
  }

  private async handleError(): Promise<void> {
    await this.sendMessageClient(
      ["❌ Houve um problema ao enviar os arquivos para o Sittax"],
      0,
      0,
      this.max,
      ProcessamentoStatus.Stopped,
    );

    await healthBrokerComunication(
      XHealthType.Error,
      "Houve um problema ao enviar os arquivos para o Sittax",
    );
  }

  private async sendMessageClient(
    messages: string[],
    progress = 0,
    value = 0,
    max = 0,
    status = ProcessamentoStatus.Running,
    replace = false,
  ): Promise<void> {
    await timeout();

    messages.forEach((message) => this.historic.log?.push(message));

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
