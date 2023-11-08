import * as fs from "node:fs";
import * as path from "node:path";
import { BrowserWindow, dialog } from "electron";
import AdmZip from "adm-zip";
import { IFileInfo } from "../interfaces/file-info";
import { IFile } from "../interfaces/file";
import { IDb } from "../interfaces/db";

export function listDirectory(directoryPath: string): IFileInfo[] {
  const directoryContents = fs.readdirSync(directoryPath);
  const filesAndFolders: IFileInfo[] = directoryContents.map((item) => {
    const itemPath = path.join(directoryPath, item);
    const isDirectory = fs.statSync(itemPath).isDirectory();
    const isFile = fs.statSync(itemPath).isFile();
    return {
      name: item,
      isDirectory,
      isFile,
      filepath: itemPath.split("\\").join("/").toString(),
      extension: !isDirectory ? path.extname(item) : "",
      modifiedtime: fs.statSync(itemPath).mtime,
      size: fs.statSync(itemPath).size,
      wasSend: false,
      isValid: false,
    };
  });
  return filesAndFolders;
}

export function selectDirectories(win: BrowserWindow) {
  const result = dialog.showOpenDialogSync(win, {
    properties: ["openDirectory", "multiSelections"],
  });
  if (result) {
    const dados = result.map((x) => {
      return {
        path: x,
        modifiedtime: fs.statSync(x).mtime,
        size: fs.statSync(x).size,
      };
    });
    return dados;
  }
  return result;
}

export function validXmlAndPdf(fileInfo: IFileInfo): Buffer | null {
  if (fileInfo.extension === ".xml") {
    const data = fs.readFileSync(fileInfo.filepath, "utf-8");
    return data.trim().startsWith("<") ? Buffer.from(data, "utf-8") : null;
  } else if (fileInfo.extension === ".pdf") {
    const data = fs.readFileSync(fileInfo.filepath, "utf-8");
    return /Nº da Declaração:\\s+(\\d+)/.test(data)
      ? Buffer.from(data, "utf-8")
      : null;
  }
  return null;
}

export function validZip(fileInfo: IFileInfo): AdmZip | null {
  const zip = new AdmZip(fileInfo.filepath);
  const zipEntries = zip.getEntries();
  let valid = false;
  zipEntries.forEach((zipEntry) => {
    if (zipEntry.entryName.endsWith(".xml")) {
      if (zipEntry.getData().toString("utf-8").startsWith("<")) valid = true;
    } else if (zipEntry.entryName.endsWith(".pdf")) {
      if (/Nº da Declaração:\\s+(\\d+)/.test(zipEntry.entryName)) valid = true;
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

export function getDb(): string {
  try {
    return fs.readFileSync(path.join(__dirname, "db.json"), "utf-8");
  } catch (error) {
    return JSON.stringify({
      configuration: {},
      directories: [],
      directoriesAndSubDirectories: [],
      files: [],
    });
  }
}

export function saveDb(db: IDb) {
  try {
    fs.writeFileSync(
      path.join(__dirname, "db.json"),
      JSON.stringify(db, null, 2)
    );
  } catch (error) {
    console.log("error", error);
  }
}
