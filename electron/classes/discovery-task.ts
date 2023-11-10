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
} from "../services/file-operation-service";
import { connection } from "websocket";
import { WSMessageType, WSMessageTyped } from "../interfaces/ws-message";
import { IFileInfo } from "../interfaces/file-info";
import { IDb } from "../interfaces/db";
import { IDbHistoric, IExecution } from "../interfaces/db-historic";
import { randomUUID } from "crypto";

export class DiscoveryTask {
  isPaused: boolean;
  isCancelled: boolean;
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
    this.execution.startDate = new Date();
    this.execution.id = randomUUID();
    this.execution.log = [];
    this.connection = connection;
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
    await this.sendMessageClient(
      ["Concluído processo de descoberta dos arquivos"],
      0,
      ProcessamentoStatus.Concluded
    );
  }

  private async discoveryDirectories(directories: IDirectory[]) {
    for (let index = 0; index < directories.length; index++) {
      if (this.isCancelled) {
        await this.sendMessageClient(
          ["Tarefa de descoberta dos arquivos cancelada."],
          0,
          ProcessamentoStatus.Stopped
        );
        return;
      }
      if (this.isPaused) {
        await this.sendMessageClient(
          ["Tarefa de descoberta dos arquivos pausada."],
          0,
          ProcessamentoStatus.Paused
        );
        await new Promise((resolve) => {
          setTimeout(resolve, 500);
        });
        index--;
      } else {
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
          ProcessamentoStatus.Paused
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
    messages.forEach((x) => this.execution.log?.push(x));
    if (
      [ProcessamentoStatus.Concluded, ProcessamentoStatus.Stopped].includes(
        status
      )
    ) {
      const dbHistoric: IDbHistoric = getDbHistoric();
      dbHistoric.executions.push(this.execution);
      saveDbHistoric(dbHistoric);
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });
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
  }
}
