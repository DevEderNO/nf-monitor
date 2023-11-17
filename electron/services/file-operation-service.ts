import * as fs from "node:fs";
import * as path from "node:path";
import { BrowserWindow, dialog } from "electron";
import AdmZip from "adm-zip";
import { IFileInfo } from "../interfaces/file-info";
import { IFile } from "../interfaces/file";
import { IDb } from "../interfaces/db";
import { IDirectory } from "../interfaces/directory";
import { IDbHistoric, IExecution } from "../interfaces/db-historic";
import { IUser } from "../interfaces/user";
import { isBefore, addMonths } from "date-fns";

export function listDirectory(
  directoryPath: string,
  callback?: (message: string) => void
): IFileInfo[] {
  const filesAndFolders: IFileInfo[] = [];
  try {
    const directoryContents = fs.readdirSync(directoryPath);
    for (let index = 0; index < directoryContents.length; index++) {
      const element = directoryContents[index];
      const itemPath = path.join(directoryPath, element);
      try {
        const isDirectory = fs.statSync(itemPath).isDirectory();
        const isFile = fs.statSync(itemPath).isFile();
        filesAndFolders.push({
          name: element,
          isDirectory,
          isFile,
          filepath: itemPath.split("\\").join("/").toString(),
          extension: !isDirectory ? path.extname(element) : "",
          modifiedtime: fs.statSync(itemPath).mtime,
          size: fs.statSync(itemPath).size,
          wasSend: false,
          isValid: false,
        });
      } catch (_) {
        if (callback) {
          callback(`A pasta/arquivo não pode ser lido ${itemPath}`);
        }
      }
    }
  } catch (_) {
    if (callback) {
      callback(`A pasta não pode ser lida ${directoryPath}`);
    }
  }
  return filesAndFolders;
}

export function selectDirectories(win: BrowserWindow): IDirectory[] {
  const result = dialog.showOpenDialogSync(win, {
    properties: ["openDirectory", "multiSelections"],
  });
  if (result) {
    const dados: IDirectory[] = result.map((x) => {
      return {
        path: x.split("\\").join("/").toString(),
        modifiedtime: fs.statSync(x).mtime,
        size: fs.statSync(x).size,
      };
    });
    return dados;
  }
  return [];
}

export function validXmlAndPdf(fileInfo: IFileInfo): IFileInfo | null {
  if (fileInfo.extension === ".xml") {
    const data = fs.readFileSync(fileInfo.filepath, "utf-8")?.trim();
    if (!data.startsWith("<")) return null;
    if (!validNotaFiscal(data)) return null;
    return fileInfo;
  } else if (fileInfo.extension === ".pdf") {
    return null;
  }
  return null;
}

function validNotaFiscal(data: string): boolean {
  const chaveAcesso = /\\d{44}/.exec(data);
  if (
    chaveAcesso &&
    isBefore(
      new Date(
        2000 + Number(chaveAcesso.slice(2, 4)),
        Number(chaveAcesso.slice(4, 6)),
        1
      ),
      addMonths(new Date(), -3)
    )
  ) {
    return false;
  }
  return true;
}

export function validZip(fileInfo: IFileInfo): AdmZip | null {
  const zip = new AdmZip(fileInfo.filepath);
  const zipEntries = zip.getEntries();
  let valid = false;
  zipEntries.forEach((zipEntry) => {
    if (zipEntry.entryName.endsWith(".xml")) {
      if (
        zipEntry.getData().toString("utf-8").startsWith("<") &&
        validNotaFiscal(zipEntry.getData().toString("utf-8"))
      )
        valid = true;
    } else if (zipEntry.entryName.endsWith(".pdf")) {
      valid = false;
    }
    if (valid) return;
  });
  return valid ? zip : null;
}

export function getFileXmlAndPdf(fileInfo: IFileInfo): IFile | null {
  if ([".xml", ".pdf"].includes(fileInfo.extension)) {
    const data = fs.readFileSync(fileInfo.filepath, "binary");
    return {
      name: fileInfo.name,
      type: "xml",
      data: data,
      path: fileInfo.filepath,
    };
  }
  return null;
}

export function getFilesZip(fileInfo: IFileInfo): IFile[] {
  if (fileInfo.extension === ".zip") {
    // Lidar com arquivos ZIP
    const zip = new AdmZip(fileInfo.filepath);
    const zipEntries = zip.getEntries();
    return zipEntries.map((zipEntry) => ({
      type: "zip",
      name: zipEntry.name,
      data: zipEntry.getData().toString("binary"),
      path: fileInfo.filepath,
    }));
  }
  return [];
}

export function getDb(): IDb {
  try {
    return JSON.parse(
      fs.readFileSync(
        path.join(
          process.env["VITE_DEV_SERVER_URL"] ? __dirname : process.cwd(),
          "db.json"
        ),
        "utf-8"
      )
    );
  } catch (error) {
    return {
      configuration: {},
      directories: [],
      directoriesAndSubDirectories: [],
      files: [],
      auth: {
        token: "",
        user: {} as IUser,
        credentials: {
          user: "",
          password: "",
        },
      },
      timeForProcessing: "",
    };
  }
}

export function getDbHistoric(): IDbHistoric {
  try {
    return JSON.parse(
      fs.readFileSync(
        path.join(
          process.env["VITE_DEV_SERVER_URL"] ? __dirname : process.cwd(),
          "dbHistoric.json"
        ),
        "utf-8"
      )
    );
  } catch (error) {
    return {
      executions: [],
    };
  }
}
export function findHistoric(id: string): IExecution {
  try {
    const db: IDbHistoric = getDbHistoric();
    const execution = db.executions.find((x) => x?.id === id);
    if (!execution) throw new Error("Registro de execução não localizado");
    return execution;
  } catch (error) {
    console.log("findHistoric", error);
    throw error;
  }
}

export function saveDb(db: IDb) {
  try {
    fs.writeFileSync(
      path.join(
        process.env["VITE_DEV_SERVER_URL"] ? __dirname : process.cwd(),
        "db.json"
      ),
      JSON.stringify(db, null, 0)
    );
  } catch (error) {
    console.log("saveDb", error);
  }
}

export function saveDbHistoric(db: IDbHistoric) {
  try {
    fs.writeFileSync(
      path.join(
        process.env["VITE_DEV_SERVER_URL"] ? __dirname : process.cwd(),
        "dbHistoric.json"
      ),
      JSON.stringify(db, null, 0)
    );
  } catch (error) {
    console.log("saveDbHistoric", error);
  }
}
