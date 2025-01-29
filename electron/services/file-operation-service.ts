import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { BrowserWindow, dialog, OpenDialogOptions } from "electron";
import AdmZip from "adm-zip";
import { IFileInfo } from "../interfaces/file-info";
import { IFile } from "../interfaces/file";
import { IDirectory } from "../interfaces/directory";
import { isBefore, addMonths } from "date-fns";
import { app } from "electron";
import { createDocumentParser } from "@arbs.io/asset-extractor-wasm";
import { getDataEmissao } from "../lib/nfse-utils";

export function selectDirectories(
  win: BrowserWindow,
  properties: OpenDialogOptions["properties"] = [
    "openDirectory",
    "multiSelections",
  ]
): IDirectory[] {
  const result = dialog.showOpenDialogSync(win, {
    properties,
  });
  if (result) {
    const dados: IDirectory[] = result.map((x) => {
      return getDirectoryData(x);
    });
    return dados;
  }
  return [];
}

export function getDirectoryData(path: string): IDirectory {
  const directory = fs.statSync(path);
  return {
    path: path.includes("\\") ? path.split("\\").join("/").toString() : path,
    modifiedtime: directory.mtime,
    size: directory.size,
  };
}

export function validXmlAndPdf(fileInfo: IFileInfo): {
  valid: boolean;
  isNotaFiscal: boolean;
} {
  let validate = { valid: false, isNotaFiscal: false };
  let data = "";
  switch (fileInfo.extension) {
    case ".xml":
      data = fs.readFileSync(fileInfo.filepath, "utf-8")?.trim();
      if (!data.startsWith("<")) return validate;
      validate = validateNotaFiscal(data);
      if (validate.isNotaFiscal) return validate;
      return validateNotaServico(data);
    case ".pdf":
      if (validatePdf(fileInfo)) return { valid: true, isNotaFiscal: false };
      return validate;
  }
  return validate;
}

function validateNotaFiscal(data: string): {
  valid: boolean;
  isNotaFiscal: boolean;
} {
  const chaveAcesso =
    /<chNFe>[0-9]{44}/gi.exec(data)?.[0] ??
    /NFe[0-9]{44}/gi.exec(data)?.[0] ??
    /NFCe[0-9]{44}/gi.exec(data)?.[0] ??
    /CFe[0-9]{44}/gi.exec(data)?.[0] ??
    /CTe[0-9]{44}/gi.exec(data)?.[0];
  if (!chaveAcesso) return { valid: false, isNotaFiscal: false };
  if (
    isBefore(
      new Date(
        2000 + Number(chaveAcesso.slice(2, 4)),
        Number(chaveAcesso.slice(4, 6)),
        1
      ),
      addMonths(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        -3
      )
    )
  ) {
    return { valid: false, isNotaFiscal: true };
  }
  return { valid: true, isNotaFiscal: true };
}

function validateNotaServico(data: string): {
  valid: boolean;
  isNotaFiscal: boolean;
} {
  try {
    const newDate = new Date();
    let date = getDataEmissao(data);
    if (!date) return { valid: false, isNotaFiscal: false };
    if (
      isBefore(
        date,
        addMonths(new Date(newDate.getFullYear(), newDate.getMonth(), 1), -3)
      )
    )
      return { valid: false, isNotaFiscal: true };
    return { valid: true, isNotaFiscal: true };
  } catch (error) {
    return { valid: false, isNotaFiscal: false };
  }
}

export function validZip(fileInfo: IFileInfo): {
  valid: boolean;
  isNotaFiscal: boolean;
} {
  let validate: {
    valid: boolean;
    isNotaFiscal: boolean;
  } = { valid: false, isNotaFiscal: false };
  try {
    const zip = new AdmZip(fileInfo.filepath);
    const zipEntries = zip.getEntries();
    let data = "";
    zipEntries.forEach((zipEntry) => {
      switch (path.extname(zipEntry.entryName)) {
        case ".xml":
          data = zipEntry.getData().toString("utf-8").trim();
          if (data.startsWith("<")) {
            validate = validateNotaFiscal(data);
            if (validate.valid) return;
            validate = validateNotaServico(data);
            if (validate.valid) return;
          }
          break;
        case ".pdf":
          if (validatePdf(fileInfo)) {
            validate = {
              valid: true,
              isNotaFiscal: false,
            };
            return;
          }
          break;
      }
    });
    return validate;
  } catch (error) {
    return validate;
  }
}

export function getFileXmlAndPdf(fileInfo: IFileInfo): IFile | null {
  if ([".xml", ".pdf"].includes(fileInfo.extension)) {
    const data = fs.readFileSync(fileInfo.filepath, "binary");
    return {
      name: fileInfo.filename,
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
    return directoryExist;
  } catch (error) {
    console.log("Erro ao desbloquear arquivos:", error);
    return false;
  }
}

export function acceptStreamsEula() {
  try {
    // Comando para adicionar a entrada no registro
    const regCommand =
      'reg add "HKCU\\Software\\Sysinternals\\Streams" /v EulaAccepted /t REG_DWORD /d 1 /f';
    execSync(regCommand, { stdio: "ignore" });
    console.log("Termos do streams.exe aceitos automaticamente.");
  } catch (error) {
    console.error("Erro ao aceitar os termos do streams.exe:", error);
  }
}

export function isFileBlocked(filePath: string): boolean {
  const streamsPath = path.join(
    process.env["VITE_DEV_SERVER_URL"]
      ? __dirname
      : path.dirname(app.getPath("exe")),
    "streams.exe"
  );
  try {
    const output = execSync(`"${streamsPath}" "${filePath}"`, {
      stdio: "pipe",
    }).toString();
    return output.includes("Zone.Identifier");
  } catch (error) {
    console.error("Erro ao verificar o arquivo:", error);
    return false;
  }
}

export function unblockFile(filePath: string) {
  const streamsPath = path.join(
    process.env["VITE_DEV_SERVER_URL"]
      ? __dirname
      : path.dirname(app.getPath("exe")),
    "streams.exe"
  );
  try {
    execSync(`"${streamsPath}" -d "${filePath}"`, { stdio: "ignore" });
    console.log(`Arquivo ${path.basename(filePath)} desbloqueado com sucesso.`);
  } catch (error) {
    console.error("Erro ao desbloquear o arquivo:", error);
  }
}

export function existsDirectory(path: string): boolean {
  return fs.existsSync(path);
}

export async function copyMigrations(): Promise<void> {
  try {
    const prismaMigrations = path.join(process.resourcesPath, "prisma");
    if (fs.existsSync(prismaMigrations)) {
      fs.cpSync(prismaMigrations, app.getPath("userData"), {
        recursive: true,
      });
    }
  } catch (error) {
    console.error("Erro ao copiar as migrations:", error);
  }
}

export async function applyMigrations(): Promise<void> {
  try {
    const prismaBinary = path.join(
      process.resourcesPath,
      "node_modules",
      ".bin",
      "prisma"
    );
    const prismaSchema = path.join(
      app.getPath("userData"),
      "schema.prisma"
    );
    const prismaMigrateDeploy = `"${prismaBinary}" migrate deploy --schema "${prismaSchema}"`;
    let prismaMigrateDeployString = fs.readFileSync(prismaSchema, "utf-8");
    prismaMigrateDeployString = prismaMigrateDeployString.replace(
      "file:./dev.db",
      "file:./nfmonitor.db"
    );
    fs.writeFileSync(prismaSchema, prismaMigrateDeployString, "utf-8");

    console.log("Aplicando migrations...");
    execSync(prismaMigrateDeploy, { stdio: "inherit" });
    console.log("Migrations aplicadas com sucesso.");
  } catch (error) {
    console.error("Erro ao aplicar migrations:", error);
  }
}
