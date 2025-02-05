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
  updateDirectoryDiscovery,
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
        let subDirectories: IDirectory[] = [];
        const directoryPath = directories[index].path;
        // const { hasListed, directoriesDiscovery } =
        //   await this.checkDirectoryHasListed(directoryPath);
        // if (hasListed) {
        //   const currentDirectory = directoriesDiscovery.find(
        //     (x) => x.path === directoryPath
        //   );
        //   if (!currentDirectory) continue;
        //   await this.sendMessageClient(
        //     [
        //       `🔍 Arquivos do diretorio já processado ${currentDirectory.directories} 📁 | ${currentDirectory.xmls} XML | ${currentDirectory.pdfs} PDF | ${currentDirectory.zips} Zip no diretório ${directories[index].path}`,
        //     ],
        //     0,
        //     ProcessamentoStatus.Running
        //   );
        //   subDirectories = directoriesDiscovery.filter(
        //     (x) => x.path !== directoryPath
        //   );
        // } else {
        const filesInfo = await this.listDirectory(directoryPath);
        if (await this.checkIsCancelled()) break;
        const counts = filesInfo.reduce(
          (acc, file) => {
            if (file.isDirectory) {
              acc.directory++;
            }
            if (file.extension === ".xml") {
              acc.xml++;
            }
            if (file.extension === ".pdf") {
              acc.pdf++;
            }
            if (file.extension === ".zip") {
              acc.zip++;
            }
            return acc;
          },
          {
            directory: 0,
            xml: 0,
            pdf: 0,
            zip: 0,
          }
        );
        await this.sendMessageClient(
          [
            `🔍 Foram encontrados ${counts.directory} 📁 | ${counts.xml} XML | ${counts.pdf} PDF | ${counts.zip} Zip no diretório ${directoryPath}`,
          ],
          0,
          ProcessamentoStatus.Running
        );
        await timeout();
        subDirectories = filesInfo
          .filter((x) => x.isDirectory)
          .map(
            (x) =>
              ({
                path: x.filepath,
                modifiedtime: x.modifiedtime,
                size: x.size,
              } as IDirectory)
          );
        await updateDirectoryDiscovery(directoryPath, {
          directories: counts.directory,
          xmls: counts.xml,
          pdfs: counts.pdf,
          zips: counts.zip,
        });
        await addDirectoryDiscovery(subDirectories);
        const filesFiltered = filesInfo.filter(
          (x) =>
            x.isFile &&
            [".xml", ".pdf", ".zip"].includes(x.extension.toLowerCase())
        );
        await addFiles(filesFiltered);
        // }

        await this.discoveryDirectories(subDirectories);
      }
    }
  }

  // private async checkDirectoryHasListed(
  //   directoryPath: string
  // ): Promise<{ hasListed: boolean; directoriesDiscovery: IDirectory[] }> {
  //   const directoriesDiscovery = await getDirectoryDiscovery(directoryPath);
  //   const directoryContents = fs.readdirSync(directoryPath, {
  //     encoding: "utf-8",
  //     recursive: true,
  //   });
  //   if (
  //     directoriesDiscovery &&
  //     directoriesDiscovery.length > 0 &&
  //     directoryContents &&
  //     directoryContents.length > 0
  //   ) {
  //     if (directoriesDiscovery.length === directoryContents.length)
  //       return { hasListed: true, directoriesDiscovery };
  //   }
  //   return { hasListed: false, directoriesDiscovery: [] };
  // }

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
              `⚙️ Processando arquivos do diretório: ${directoryPath} ${
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

            filesAndFolders.push({
              filename: element,
              isDirectory,
              isFile: !isDirectory,
              filepath: itemPath.split("\\").join("/"),
              extension: path.extname(element),
              modifiedtime: stats.mtime,
              size: stats.size,
              wasSend: false,
              isValid: false,
              bloqued: !isDirectory && isFileBlocked(itemPath),
              dataSend: null,
            });
          } catch (_) {
            if (callback) {
              callback(`A pasta/arquivo não pode ser lido ${itemPath}`);
            }
          }
          await timeout(5);
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
