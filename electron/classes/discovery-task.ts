import {
  IProcessamento,
  ProcessamentoStatus,
} from "../interfaces/processamento";
import { IDirectory } from "../interfaces/directory";
import {
  getDb,
  listDirectory,
  saveDb,
} from "../services/file-operation-service";
import { connection } from "websocket";
import { WSMessageType, WSMessageTyped } from "../interfaces/ws-message";
import { IFileInfo } from "../interfaces/file-info";
import { IDb } from "../interfaces/db";

export class DiscoveryTask {
  isPaused: boolean;
  isCancelled: boolean;
  db: IDb;
  directoriesAndSubDirectories: IDirectory[];
  files: IFileInfo[];
  constructor() {
    this.isPaused = false;
    this.isCancelled = false;
    this.db = {} as IDb;
    this.directoriesAndSubDirectories = [];
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

  async run(connection: connection, directories: IDirectory[]) {
    this.isCancelled = false;
    this.isPaused = false;
    this.sendMessageStartTask(connection);
    this.db = { ...JSON.parse(getDb()) };
    this.directoriesAndSubDirectories = this.db.directoriesAndSubDirectories;
    this.files = this.db.files;
    if (this.directoriesAndSubDirectories.length === 0)
      this.directoriesAndSubDirectories = directories;
    await this.discoveryDirectories(directories, connection);
    saveDb({
      ...this.db,
      directoriesAndSubDirectories: this.directoriesAndSubDirectories,
      files: this.files,
    });
    this.sendMessageEndTask(connection);
  }

  private async discoveryDirectories(
    directories: IDirectory[],
    connection: connection
  ) {
    for (let index = 0; index < directories.length; index++) {
      if (this.isCancelled) {
        this.sendMessageCanceledTask(connection);
        return;
      }
      if (this.isPaused) {
        this.sendMessagePausedTask(connection);
        await new Promise((resolve) => {
          setTimeout(resolve, 500);
        });
        index--;
      } else {
        const filesInfo = listDirectory(directories[index].path);
        this.sendMessageDiscoveryFiles(
          filesInfo,
          directories,
          index,
          connection
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
        await this.discoveryDirectories(subDirectories, connection);
      }
    }
  }

  private sendMessageDiscoveryFiles(
    files: IFileInfo[],
    directories: IDirectory[],
    index: number,
    connection: connection
  ) {
    const response = {
      type: "message",
      message: {
        type: WSMessageType.Discovery,
        data: {
          messages: [
            `🔍 Foram encontrados ${
              files.filter((x) => x.isDirectory).length
            } 📁 | ${
              files.filter((x) => x.extension === ".xml").length
            } XML | ${
              files.filter((x) => x.extension === ".pdf").length
            } PDF | ${
              files.filter((x) => x.extension === ".zip").length
            } Zip no diretório ${directories[index].path}`,
          ],
          progress: 0,
          status: ProcessamentoStatus.Running,
        },
      },
    };
    connection.sendUTF(JSON.stringify(response));
  }

  private sendMessagePausedTask(connection: connection) {
    console.log("Tarefa de descoberta dos arquivos pausada.");
    const response = {
      type: "message",
      message: {
        type: WSMessageType.Discovery,
        data: {
          messages: ["Tarefa de descoberta dos arquivos pausada."],
          progress: 0,
          status: ProcessamentoStatus.Stopped,
        },
      },
    };
    connection.sendUTF(JSON.stringify(response));
    return response;
  }

  private sendMessageCanceledTask(connection: connection) {
    console.log("Tarefa de descoberta dos arquivos cancelada.");
    const response = {
      type: "message",
      message: {
        type: WSMessageType.Discovery,
        data: {
          messages: ["Tarefa de descoberta dos arquivos cancelada."],
          progress: 0,
          status: ProcessamentoStatus.Stopped,
        },
      },
    };
    connection.sendUTF(JSON.stringify(response));
    return response;
  }

  private sendMessageStartTask(connection: connection) {
    console.log("Tarefa de descoberta dos arquivos iniciada.");
    const response: WSMessageTyped<IProcessamento> = {
      type: "message",
      message: {
        type: WSMessageType.Discovery,
        data: {
          messages: ["Tarefa de descoberta dos arquivos iniciada."],
          progress: 0,
          status: ProcessamentoStatus.Running,
        },
      },
    };
    connection.sendUTF(JSON.stringify(response));
  }

  private sendMessageEndTask(connection: connection) {
    console.log("Concluído processo de descoberta dos arquivos");
    const response = {
      type: "message",
      message: {
        type: WSMessageType.Discovery,
        data: {
          messages: ["Concluído processo de descoberta dos arquivos"],
          progress: 0,
          status: ProcessamentoStatus.Concluded,
        },
      },
    };
    connection.sendUTF(JSON.stringify(response));
  }
}
