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
import { IDb } from "../interfaces/db";
import { IConfig } from "../interfaces/config";
import { signInSittax } from "../listeners";
import prisma from "../lib/prisma";

export function selectDirectories(
  win: BrowserWindow,
  properties: OpenDialogOptions["properties"] = [
    "openDirectory",
    "multiSelections",
  ],
): IDirectory[] {
  const result = dialog.showOpenDialogSync(win, {
    properties,
  });
  if (result) {
    const directories: IDirectory[] = [];
    result.forEach((x) => {
      const directory = getDirectoryData(x);
      if (directory) {
        directories.push(directory);
      }
    });
    return directories;
  }
  return [];
}

export function getDirectoryData(path: string): IDirectory | null {
  try {
    const directory = fs.statSync(path);
    return {
      path: path.includes("\\") ? path.split("\\").join("/").toString() : path,
      modifiedtime: directory.mtime,
      size: directory.size,
      directories: 0,
      xmls: 0,
      pdfs: 0,
      zips: 0,
      totalFiles: 0,
    };
  } catch (error) {
    return null;
  }
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
        1,
      ),
      addMonths(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        -3,
      ),
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
    const date = getDataEmissao(data);
    if (!date) return { valid: false, isNotaFiscal: false };
    if (
      isBefore(
        date,
        addMonths(new Date(newDate.getFullYear(), newDate.getMonth(), 1), -3),
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
    return false;
  }
}

export function validateDiretoryFileExists(fileInfo: IFileInfo): boolean {
  try {
    const fileDirectory = path.dirname(fileInfo.filepath);
    const directoryExist = fs.existsSync(fileDirectory);
    return directoryExist;
  } catch (error) {
    return false;
  }
}

export function validateDFileExists(fileInfo: IFileInfo): boolean {
  return fs.existsSync(fileInfo.filepath);
}

export async function copyMigrations(): Promise<void> {
  try {
    if (!app.isPackaged) return;
    const prismaMigrations = path.join(process.resourcesPath, "prisma");
    copyRecursive(prismaMigrations, app.getPath("userData"));
  } catch (error) {
    console.error("Erro ao copiar as migrations:", error);
  }
}

export async function applyMigrations(): Promise<void> {
  try {
    if (!app.isPackaged) return;
    const nodePath = path.join(process.resourcesPath, "nodejs", "node.exe");
    const prismaPath = path.join(
      process.resourcesPath,
      "node_modules",
      "prisma",
      "build",
      "index.js",
    );
    const prismaSchema = path.join(app.getPath("userData"), "schema.prisma");
    let prismaMigrateDeployString = fs.readFileSync(prismaSchema, "utf-8");
    prismaMigrateDeployString = prismaMigrateDeployString.replace(
      "file:./dev.db",
      "file:./nfmonitor.db",
    );
    fs.writeFileSync(prismaSchema, prismaMigrateDeployString, "utf-8");

    console.info("Aplicando migrations...");
    const result = execSync(
      `"${nodePath}" "${prismaPath}" migrate deploy --schema "${prismaSchema}"`,
      {
        stdio: "pipe",
      },
    );
    console.info(`Migrations aplicadas com sucesso. ${result}`);
  } catch (error) {
    console.error("Erro ao aplicar migrations:", error);
  }
}

export async function recicleDb() {
  if (!app.isPackaged) return;
  const dbPath = path.join(app.getPath("userData"), "db.json");
  if (!fs.existsSync(dbPath)) return;
  const db: IDb = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  const config: IConfig = {
    timeForProcessing: db.timeForProcessing ?? "00:00",
    timeForConsultingSieg: "00:00",
    directoryDownloadSieg: null,
    viewUploadedFiles: false,
    apiKeySieg: "",
    emailSieg: "",
    senhaSieg: "",
  };
  const directories: IDirectory[] =
    db.directories?.map((x) => ({
      ...x,
      directories: 0,
      xmls: 0,
      pdfs: 0,
      zips: 0,
      totalFiles: 0,
    })) ?? [];
  const discoredDirecories: IDirectory[] =
    db.directoriesAndSubDirectories?.map((x) => ({
      ...x,
      directories: 0,
      xmls: 0,
      pdfs: 0,
      zips: 0,
      totalFiles: 0,
    })) ?? [];
  const files: IFileInfo[] =
    db.files?.map((x) => ({
      filepath: x.filepath,
      filename: x.name,
      extension: x.extension,
      wasSend: x.wasSend,
      dataSend: x.dataSend,
      isValid: x.isValid,
      isDirectory: x.isDirectory,
      bloqued: x.bloqued,
      isFile: x.isFile,
      modifiedtime: x.modifiedtime,
      size: x.size,
    })) ?? [];
  await prisma.file.createMany({ data: files });
  await prisma.directory.createMany({ data: directories });
  await prisma.directoryDiscovery.createMany({ data: discoredDirecories });
  await prisma.configuration.create({ data: config });
  await signInSittax(
    db.auth?.credentials?.user ?? "",
    db.auth?.credentials?.password ?? "",
  );
  const newDbPath = dbPath.replace("db.json", "oldDb.json");
  fs.renameSync(dbPath, newDbPath);
}

export function copyRecursive(srcDir: string, destDir: string) {
  try {
    // Cria a pasta de destino se não existir
    fs.mkdirSync(destDir, { recursive: true });

    // Lê todos os arquivos e subpastas da origem
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        // Se for uma pasta, copia recursivamente
        copyRecursive(srcPath, destPath);
      } else {
        // Se for um arquivo, copia normalmente
        fs.copyFileSync(srcPath, destPath);
        console.info(`Copiado: ${srcPath} -> ${destPath}`);
      }
    }

    console.info("✅ Todos os arquivos e pastas foram copiados!");
  } catch (error) {
    console.error("Erro ao copiar:", error);
  }
}

export function createDirectoryFolder(directoryPath: string) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(path.resolve(directoryPath), { recursive: true });
  }
}

export async function listarArquivos(
  diretorios: string[],
): Promise<IFileInfo[]> {
  try {
    const arquivos = await Promise.all(
      diretorios.map(async (diretorio): Promise<IFileInfo[]> => {
        const itens = await fs.promises.readdir(diretorio, {
          withFileTypes: true,
        });

        const paths = await Promise.all(
          itens.map(async (item): Promise<IFileInfo | IFileInfo[]> => {
            const caminhoCompleto = path.join(diretorio, item.name);
            const stats = await fs.promises.stat(caminhoCompleto);
            const extension = path.extname(caminhoCompleto);
            return item.isDirectory()
              ? listarArquivos([caminhoCompleto]) // Chama recursivamente para subpastas
              : {
                  filepath: caminhoCompleto,
                  filename: item.name,
                  extension: extension,
                  isDirectory: false,
                  isFile: true,
                  wasSend: false,
                  dataSend: null,
                  isValid: [".xml", ".pdf", ".zip"].includes(extension),
                  bloqued: false,
                  modifiedtime: stats.mtime,
                  size: stats.size,
                }; // Retorna o arquivo
          }),
        );

        return paths.flat(); // Achata o array de arquivos em um único nível
      }),
    );

    return arquivos.flat(); // Achata o resultado final
  } catch (erro) {
    console.error("Erro ao ler diretórios:", erro);
    return [];
  }
}
