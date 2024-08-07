import {
  IProcessamento,
  ProcessamentoStatus,
} from "../interfaces/processamento";
import { IDirectory } from "../interfaces/directory";
import {
  getDb,
  getDbHistoric,
  listDirectory,
  saveDb,
  saveDbHistoric,
  saveLog,
} from "../services/file-operation-service";
import { connection } from "websocket";
import { WSMessageType, WSMessageTyped } from "../interfaces/ws-message";
import { IFileInfo } from "../interfaces/file-info";
import { IDb } from "../interfaces/db";
import { IDbHistoric, IExecution } from "../interfaces/db-historic";
import { randomUUID } from "crypto";

export class DiscoveryTask {
  isPaused: boolean;
  pausedMessage: string | null;
  isCancelled: boolean;
  cancelledMessage: string | null;
  db: IDb;
  directoriesAndSubDirectories: IDirectory[];
  files: IFileInfo[];
  execution: IExecution;
  connection: connection | null;
  constructor() {
    this.isPaused = false;
    this.isCancelled = false;
    this.db = {} as IDb;
    this.directoriesAndSubDirectories = [];
    this.files = [];
    this.execution = {} as IExecution;
    this.connection = null;
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

  async run(connection: connection) {
    try {
      this.initializeProperties(connection);
      await this.sendMessageClient([
        "Tarefa de descoberta dos arquivos iniciada.",
      ]);
      this.db = { ...getDb() };
      this.files = this.db.files;
      await this.discoveryDirectories(this.db.directories);
      saveDb({
        ...this.db,
        directoriesAndSubDirectories: this.directoriesAndSubDirectories,
        files: this.files,
      });
      if (!this.isCancelled) {
        await this.sendMessageClient(
          ["Concluído processo de descoberta dos arquivos"],
          0,
          ProcessamentoStatus.Concluded
        );
      }
    } catch (error) {
      saveLog(JSON.stringify(error));
      await this.sendMessageClient(
        ["❌ houve um problema na descoberta dos arquivos"],
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
    this.execution.startDate = new Date();
    this.execution.id = randomUUID();
    this.execution.log = [];
    this.connection = connection;
  }

  private async discoveryDirectories(directories: IDirectory[]) {
    for (let index = 0; index < directories.length; index++) {
      if (this.isCancelled) {
        await this.sendMessageClient(
          ["Tarefa de descoberta dos arquivos cancelada."],
          0,
          ProcessamentoStatus.Stopped
        );
        await this.sendMessageClient([], 0, ProcessamentoStatus.Stopped);
        return;
      }
      if (this.isPaused) {
        if (this.pausedMessage === null) {
          this.pausedMessage = "Tarefa de descoberta dos arquivos pausada.";
          await this.sendMessageClient(
            [this.pausedMessage],
            0,
            ProcessamentoStatus.Paused
          );
        }
        await timeout(500);
        index--;
      } else {
        await timeout();
        const filesInfo = listDirectory(directories[index].path);
        await this.sendMessageClient(
          [
            `🔍 Foram encontrados ${
              filesInfo.filter((x) => x.isDirectory).length
            } 📁 | ${
              filesInfo.filter((x) => x.extension === ".xml").length
            } XML | ${
              filesInfo.filter((x) => x.extension === ".pdf").length
            } PDF | ${
              filesInfo.filter((x) => x.extension === ".zip").length
            } Zip no diretório ${directories[index].path}`,
          ],
          0,
          ProcessamentoStatus.Running
        );
        const subDirectories = filesInfo
          .filter((x) => x.isDirectory)
          .map(
            (x) =>
              ({
                path: x.filepath,
                modifiedtime: x.modifiedtime,
                size: x.size,
              } as IDirectory)
          );

        const newDirectoriesAndSubDirectories = subDirectories.filter(
          (x) =>
            !this.directoriesAndSubDirectories
              .map((d) => d.path)
              .includes(x.path)
        );
        if (newDirectoriesAndSubDirectories.length > 0) {
          this.directoriesAndSubDirectories = [
            ...this.directoriesAndSubDirectories,
            ...newDirectoriesAndSubDirectories,
          ];
        }
        let filesFiltered = filesInfo.filter(
          (x) =>
            x.isFile &&
            [".xml", ".pdf", ".zip"].includes(x.extension.toLowerCase())
        );

        this.files = this.files.map((f) => {
          const file = filesFiltered.find((ff) => ff.filepath == f.filepath);
          return file ? { ...f, bloqued: file.bloqued } : f;
        });

        filesFiltered = filesFiltered.filter(
          (x) => !this.files.map((d) => d.filepath).includes(x.filepath)
        );

        if (filesFiltered.length > 0) {
          this.files = [...this.files, ...filesFiltered];
        }
        await this.discoveryDirectories(subDirectories);
      }
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
      dbHistoric.executions.push(this.execution);
      saveDbHistoric(dbHistoric);
    }
    this.connection?.sendUTF(
      JSON.stringify({
        type: "message",
        message: {
          type: WSMessageType.Discovery,
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
