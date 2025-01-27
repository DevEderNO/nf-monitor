import {
  IProcessamento,
  ProcessamentoStatus,
} from "../interfaces/processamento";
import { IDirectory } from "../interfaces/directory";
import { connection } from "websocket";
import { WSMessageType, WSMessageTyped } from "../interfaces/ws-message";
import { IFileInfo } from "../interfaces/file-info";
import { IDbHistoric } from "../interfaces/db-historic";
import {
  addDirectoryDiscovery,
  addFiles,
  addHistoric,
  getDirectories,
  getFiles,
  updateHistoric,
} from "../services/database";
import path from "path";
import * as fs from "node:fs";
import { isFileBlocked } from "../services/file-operation-service";

export class DiscoveryTask {
  isPaused: boolean;
  pausedMessage: string | null;
  isCancelled: boolean;
  cancelledMessage: string | null;
  directoriesAndSubDirectories: IDirectory[];
  files: IFileInfo[];
  historic: IDbHistoric;
  connection: connection | null;
  constructor() {
    this.isPaused = false;
    this.isCancelled = false;
    this.directoriesAndSubDirectories = [];
    this.files = [];
    this.historic = {
      startDate: new Date(),
      endDate: null,
      log: [],
    } as IDbHistoric;
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
      await this.sendMessageClient([""]);
      this.initializeProperties(connection);
      await this.sendMessageClient([
        "Tarefa de descoberta dos arquivos iniciada.",
      ]);
      this.files = await getFiles();
      this.historic = await addHistoric(this.historic);
      const directories = await getDirectories();
      await this.discoveryDirectories(directories);
      if (!this.isCancelled) {
        await this.sendMessageClient(
          ["Concluído processo de descoberta dos arquivos"],
          0,
          ProcessamentoStatus.Concluded
        );
      }
    } catch (error) {
      await this.sendMessageClient(
        ["❌ houve um problema na descoberta dos arquivos"],
        0,
        ProcessamentoStatus.Stopped
      );
      throw error;
    }
  }

  private initializeProperties(connection: connection) {
    this.isCancelled = false;
    this.cancelledMessage = null;
    this.isPaused = false;
    this.pausedMessage = null;
    this.historic = {
      startDate: new Date(),
      endDate: null,
      log: [],
    } as IDbHistoric;
    this.connection = connection;
  }

  private async discoveryDirectories(directories: IDirectory[]) {
    for (let index = 0; index < directories.length; index++) {
      if (await this.checkIsCancelled()) break;
      if (await this.checkIsPaused()) {
        await timeout(500);
        index--;
      } else {
        const filesInfo = await this.listDirectory(directories[index].path);
        if (await this.checkIsCancelled()) break;
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
        await timeout();
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
        console.log(`addDirectoryDiscovery ${subDirectories.length} start`);
        addDirectoryDiscovery(subDirectories);
        console.log(`addDirectoryDiscovery ${subDirectories.length} end`);
        let filesFiltered = filesInfo.filter(
          (x) =>
            x.isFile &&
            [".xml", ".pdf", ".zip"].includes(x.extension.toLowerCase())
        );
        console.log(`addFiles ${filesFiltered.length} start`);
        addFiles(filesFiltered);
        console.log(`addFiles ${filesFiltered.length} end`);

        await this.discoveryDirectories(subDirectories);
      }
    }
  }

  private async listDirectory(
    directoryPath: string,
    callback?: (message: string) => void
  ): Promise<IFileInfo[]> {
    const filesAndFolders: IFileInfo[] = [];
    try {
      const directoryContents = fs.readdirSync(directoryPath);
      for (let index = 0; index < directoryContents.length; index++) {
        if (await this.checkIsCancelled()) return filesAndFolders;
        if (await this.checkIsPaused()) {
          await timeout(500);
          index--;
        } else {
          await this.sendMessageClient(
            [
              `Processando arquivos do diretório: ${directoryPath} ${
                index + 1
              } de ${directoryContents.length}`,
            ],
            0,
            ProcessamentoStatus.Running,
            true
          );
          const element = directoryContents[index];
          const itemPath = path.join(directoryPath, element);
          try {
            const stats = fs.statSync(itemPath);
            const isDirectory = stats.isDirectory();
            const isFile = stats.isFile();

            filesAndFolders.push({
              filename: element,
              isDirectory,
              isFile,
              filepath: itemPath.split("\\").join("/"),
              extension: !isDirectory ? path.extname(element) : "",
              modifiedtime: stats.mtime,
              size: stats.size,
              wasSend: false,
              isValid: false,
              bloqued: isFile && isFileBlocked(itemPath),
              dataSend: null,
            });
          } catch (_) {
            if (callback) {
              callback(`A pasta/arquivo não pode ser lido ${itemPath}`);
            }
          }
          await timeout(10);
        }
      }
    } catch (_) {
      if (callback) {
        callback(`A pasta não pode ser lida ${directoryPath}`);
      }
    }
    await timeout(10);
    return filesAndFolders;
  }

  private async sendMessageClient(
    messages: string[],
    progress = 0,
    status = ProcessamentoStatus.Running,
    replace = false
  ) {
    await timeout();
    messages.forEach((x) => this.historic.log?.push(x));
    if (
      [ProcessamentoStatus.Concluded, ProcessamentoStatus.Stopped].includes(
        status
      )
    ) {
      this.historic.endDate = new Date();
      await updateHistoric(this.historic);
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
            replace,
            id: this.historic?.id,
          },
        },
      } as WSMessageTyped<IProcessamento>)
    );
    await timeout();
  }

  private async checkIsCancelled(): Promise<boolean> {
    if (this.isCancelled) {
      if (this.cancelledMessage === null) {
        this.cancelledMessage = "Tarefa de descoberta dos arquivos cancelada.";
        await this.sendMessageClient(
          [this.cancelledMessage],
          0,
          ProcessamentoStatus.Stopped
        );
      }
      return true;
    }
    return false;
  }

  private async checkIsPaused(): Promise<boolean> {
    if (this.isPaused) {
      if (this.pausedMessage === null) {
        this.pausedMessage = "Tarefa de descoberta dos arquivos pausada.";
        await this.sendMessageClient(
          [this.pausedMessage],
          0,
          ProcessamentoStatus.Paused
        );
      }
      return true;
    }
    this.isPaused = false;
    return false;
  }
}

function timeout(time?: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, time ?? 50);
  });
}
