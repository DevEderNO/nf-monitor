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
import { isBefore, addMonths, parseISO, format } from "date-fns";
import * as cheerio from "cheerio";
import { app } from "electron";
import { createDocumentParser } from "@arbs.io/asset-extractor-wasm";

const emissaoSelectors = [
  "data_emissao",
  "DataEmissao",
  "dtEmissao",
  "Emissao",
  "data_nfse",
  "tsDatEms",
  "prestacao",
  "dEmi",
  "DTDATA",
  "DtEmiNf",
  "DtHrGerNf",
  "DT_COMPETENCIA",
  "data",
];

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
    const validate = validateNotaFiscal(data);
    if (validate.isNotaFiscal && !validate.valid) return null;
    if (!validate.valid && !validateNotaServico(data)) return null;
    return fileInfo;
  } else if (fileInfo.extension === ".pdf") {
    if (validatePdf(fileInfo)) return fileInfo;
    return null;
  }
  return null;
}

function validateNotaFiscal(data: string): {
  valid: boolean;
  isNotaFiscal: boolean;
} {
  const chaveAcesso = /[0-9]{44}/.exec(data)?.[0];
  if (!chaveAcesso) return { valid: false, isNotaFiscal: false };
  if (
    isBefore(
      new Date(
        2000 + Number(chaveAcesso.slice(2, 4)),
        Number(chaveAcesso.slice(4, 6)),
        1
      ),
      addMonths(new Date(), -3)
    )
  ) {
    return { valid: false, isNotaFiscal: true };
  }
  return { valid: true, isNotaFiscal: true };
}

function validateNotaServico(data: string): boolean {
  try {
    const html = cheerio.load(data);
    let date = "";
    for (let i = 0; i < emissaoSelectors.length; i++) {
      const element = emissaoSelectors[i];
      html("*").each((_, elemento) => {
        if (
          html(elemento)
            .prop("name")
            .toLowerCase()
            .startsWith(element.toLowerCase())
        ) {
          const text = html(elemento).text().trim();
          if (text.length > 0) {
            date = text;
            return false;
          }
        }
      });
      if (date.length > 0) break;
    }
    if (date.length === 0) return false;
    if (isBefore(parseISO(date), addMonths(new Date(), -3))) return false;
    return true;
  } catch (error) {
    return false;
  }
}

export function validZip(fileInfo: IFileInfo): AdmZip | null {
  try {
    console.log("criando amdzip");
    const zip = new AdmZip(fileInfo.filepath);
    console.log("pegando os entries");
    const zipEntries = zip.getEntries();
    let valid = false;
    zipEntries.forEach((zipEntry) => {
      if (zipEntry.entryName.endsWith(".xml")) {
        const data = zipEntry.getData().toString("utf-8").trim();
        if (data.startsWith("<")) {
          const validate = validateNotaFiscal(data);
          if (validate.valid || validateNotaServico(data)) valid = true;
        }
      } else if (zipEntry.entryName.endsWith(".pdf")) {
        valid = false;
      }
      if (valid) return;
    });
    return valid ? zip : null;
  } catch (error) {
    return null;
  }
}

export function getFileXmlAndPdf(fileInfo: IFileInfo): IFile | null {
  if ([".xml", ".pdf"].includes(fileInfo.extension)) {
    const data = fs.readFileSync(fileInfo.filepath, "binary");
    return {
      name: fileInfo.name,
      type: fileInfo.extension === ".xml" ? "xml" : "pdf",
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
  const userDataPath = app.getPath("userData");
  try {
    return JSON.parse(
      fs.readFileSync(
        path.join(
          process.env["VITE_DEV_SERVER_URL"] ? __dirname : userDataPath,
          "db.json"
        ),
        "utf-8"
      )
    );
  } catch (error) {
    return {
      configuration: { viewUploadedFiles: true },
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
  const userDataPath = app.getPath("userData");
  try {
    return JSON.parse(
      fs.readFileSync(
        path.join(
          process.env["VITE_DEV_SERVER_URL"] ? __dirname : userDataPath,
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
  const userDataPath = app.getPath("userData");
  try {
    fs.writeFileSync(
      path.join(
        process.env["VITE_DEV_SERVER_URL"] ? __dirname : userDataPath,
        "db.json"
      ),
      JSON.stringify(db, null, 0)
    );
  } catch (error) {
    console.log("saveDb", error);
  }
}

export function saveDbHistoric(db: IDbHistoric) {
  const userDataPath = app.getPath("userData");
  try {
    fs.writeFileSync(
      path.join(
        process.env["VITE_DEV_SERVER_URL"] ? __dirname : userDataPath,
        "dbHistoric.json"
      ),
      JSON.stringify(db, null, 0)
    );
  } catch (error) {
    console.log("saveDbHistoric", error);
  }
}

export function clearHistoric() {
  const userDataPath = app.getPath("userData");
  const dbHistoric = getDbHistoric();
  try {
    if (dbHistoric.executions.length > 0)
      fs.writeFileSync(
        path.join(
          process.env["VITE_DEV_SERVER_URL"] ? __dirname : userDataPath,
          `dbHistoric-${format(new Date(), "yyyy-MM-dd HH-mm-ss")}.json`
        ),
        JSON.stringify(dbHistoric, null, 0)
      );
    fs.writeFileSync(
      path.join(
        process.env["VITE_DEV_SERVER_URL"] ? __dirname : userDataPath,
        "dbHistoric.json"
      ),
      JSON.stringify({ executions: [] }, null, 0)
    );
  } catch (error) {
    console.log("saveDbHistoric", error);
  }
}

export function saveLog(log: string) {
  const userDataPath = app.getPath("userData");
  try {
    fs.appendFileSync(
      path.join(
        process.env["VITE_DEV_SERVER_URL"] ? __dirname : userDataPath,
        "log.json"
      ),
      JSON.stringify(log + "\n", null, 0)
    );
  } catch (error) {
    console.log("saveDbHistoric", error);
  }
}

function validatePdf(fileInfo: IFileInfo): boolean {
  try {
    const buf = fs.readFileSync(fileInfo.filepath);
    const documentParser = createDocumentParser(new Uint8Array(buf));
    const pdfText = documentParser?.contents?.text;
    if (!pdfText) return false;
    const isDeclaracao =
      (/Nº da Declaração:\s+(\d+)/.exec(pdfText)?.[0].length ?? 0) > 0;
    const isExtrato =
      (/Informações da Apuração\s+(\d+)/.exec(pdfText)?.[0]?.length ?? 0) > 0;
    return isDeclaracao || isExtrato;
  } catch (error) {
    console.log("Erro ao ler o PDF: ", fileInfo.filepath);
  }
  return false;
}

export function validateDiretoryFileExists(fileInfo: IFileInfo): boolean {
  try {
    const fileDirectory = path.dirname(fileInfo.filepath);
    const directoryExist = fs.existsSync(fileDirectory);
    fs.accessSync(fileInfo.filepath, fs.constants.F_OK);
    return directoryExist;
  } catch (error) {
    return false;
  }
}
