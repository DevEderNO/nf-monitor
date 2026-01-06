import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { BrowserWindow, dialog, OpenDialogOptions } from 'electron';
import AdmZip from 'adm-zip';
import { IFileInfo } from '../interfaces/file-info';
import { IFile } from '../interfaces/file';
import { IDirectory } from '../interfaces/directory';
import { isBefore, addMonths } from 'date-fns';
import { app } from 'electron';
import { getDataEmissao } from '../lib/nfse-utils';
import { IDb } from '../interfaces/db';
import { IConfig } from '../interfaces/config';
import { signInSittax } from '../listeners';
import prisma from '../lib/prisma';

const VALID_EXTENSIONS = new Set(['.xml', '.pdf', '.zip', '.txt', '.pfx']);

const CHAVE_ACESSO_PATTERNS = [
  /<chNFe>[0-9]{44}/gi,
  /NFe[0-9]{44}/gi,
  /NFCe[0-9]{44}/gi,
  /CFe[0-9]{44}/gi,
  /CTe[0-9]{44}/gi,
];

const diretorioCache = new Map<string, IDirectory>();
const validationCache = new Map<string, { valid: boolean; isNotaFiscal: boolean }>();
const fileStatsCache = new Map<string, fsSync.Stats>();

const BATCH_SIZE = 100;
const MAX_CONCURRENT_OPERATIONS = 10;

export function selectDirectories(
  win: BrowserWindow,
  properties: OpenDialogOptions['properties'] = ['openDirectory', 'multiSelections']
): IDirectory[] {
  const result = dialog.showOpenDialogSync(win, { properties });

  if (!result?.length) return [];

  const diretorios: IDirectory[] = [];
  result.forEach(x => {
    const diretorio = getDirectoryData(x);
    if (diretorio) diretorios.push(diretorio);
  });

  return diretorios;
}

export function getDirectoryData(dirPath: string): IDirectory | null {
  if (diretorioCache.has(dirPath)) return diretorioCache.get(dirPath)!;

  try {
    const diretorio = fsSync.statSync(dirPath);
    const result: IDirectory = {
      path: dirPath.includes('\\') ? dirPath.split('\\').join('/').toString() : dirPath,
      modifiedtime: diretorio.mtime,
      size: diretorio.size,
      directories: 0,
      xmls: 0,
      pdfs: 0,
      zips: 0,
      txts: 0,
      pfx: 0,
      type: 'invoices',
      totalFiles: 0,
    };

    diretorioCache.set(dirPath, result);
    return result;
  } catch (error) {
    return null;
  }
}

export function validFile(fileInfo: IFileInfo, certificate: boolean): { valid: boolean; isNotaFiscal: boolean } {
  const cacheKey = `${fileInfo.filepath}:${fileInfo.extension}`;

  if (validationCache.has(cacheKey)) return validationCache.get(cacheKey)!;

  let validate = { valid: false, isNotaFiscal: false };

  try {
    let data = '';
    switch (fileInfo.extension.toLowerCase()) {
      case '.xml':
        data = fsSync.readFileSync(fileInfo.filepath, 'utf-8')?.trim();
        if (data.startsWith('<')) return { valid: true, isNotaFiscal: true };
        return { valid: false, isNotaFiscal: false };
      case '.pdf':
        if (validatePdf(fileInfo, certificate)) {
          validate = { valid: true, isNotaFiscal: false };
        }
        validationCache.set(cacheKey, validate);
        return validate;
      case '.txt':
        if (validateTxt(fileInfo)) {
          validate = { valid: true, isNotaFiscal: false };
        }
        validationCache.set(cacheKey, validate);
        return validate;
      case '.pfx':
        if (validatePfx(fileInfo)) {
          validate = { valid: true, isNotaFiscal: false };
        }
        validationCache.set(cacheKey, validate);
        return validate;
    }
  } catch (error) {
    console.error(`Erro de validacao para ${fileInfo.filepath}:`, error);
  }

  validationCache.set(cacheKey, validate);
  return validate;
}

function validateNotaFiscal(data: string): {
  valid: boolean;
  isNotaFiscal: boolean;
} {
  let chaveAcesso: string | null = null;

  for (const pattern of CHAVE_ACESSO_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(data);
    if (match) {
      chaveAcesso = match[0];
      break;
    }
  }

  if (!chaveAcesso) return { valid: false, isNotaFiscal: false };

  if (
    isBefore(
      new Date(2000 + Number(chaveAcesso.slice(2, 4)), Number(chaveAcesso.slice(4, 6)), 1),
      addMonths(new Date(new Date().getFullYear(), new Date().getMonth(), 1), -3)
    )
  )
    return { valid: false, isNotaFiscal: true };

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
    if (isBefore(date, addMonths(new Date(newDate.getFullYear(), newDate.getMonth(), 1), -3)))
      return { valid: false, isNotaFiscal: true };
    return { valid: true, isNotaFiscal: true };
  } catch (error) {
    return { valid: false, isNotaFiscal: false };
  }
}

export function validZip(fileInfo: IFileInfo): { valid: boolean; isNotaFiscal: boolean } {
  const cacheKey = `zip:${fileInfo.filepath}`;

  if (validationCache.has(cacheKey)) return validationCache.get(cacheKey)!;

  let validate: { valid: boolean; isNotaFiscal: boolean } = { valid: false, isNotaFiscal: false };

  try {
    const zip = new AdmZip(fileInfo.filepath);
    const zipEntries = zip.getEntries();
    let data = '';

    zipEntries.forEach(zipEntry => {
      switch (path.extname(zipEntry.entryName)) {
        case '.xml':
          data = zipEntry.getData().toString('utf-8').trim();
          if (data.startsWith('<')) {
            validate = validateNotaFiscal(data);
            if (validate.valid) return;
            validate = validateNotaServico(data);
            if (validate.valid) return;
          }
          break;
        case '.pdf':
          if (validatePdf(fileInfo, false)) {
            validate = {
              valid: true,
              isNotaFiscal: false,
            };
            return;
          }
          break;
        case '.txt':
          if (validateTxt(fileInfo)) {
            validate = {
              valid: true,
              isNotaFiscal: false,
            };
            return;
          }
          break;
      }
    });

    validationCache.set(cacheKey, validate);
    return validate;
  } catch (error) {
    validationCache.set(cacheKey, validate);
    return validate;
  }
}

export function getFileXmlAndPdf(fileInfo: IFileInfo): IFile | null {
  const extensionMap: Record<string, 'xml' | 'pdf' | 'txt'> = {
    '.xml': 'xml',
    '.pdf': 'pdf',
    '.txt': 'txt',
  };

  if (extensionMap[fileInfo.extension]) {
    try {
      const data = fsSync.readFileSync(fileInfo.filepath, 'binary');
      return {
        name: fileInfo.filename,
        type: extensionMap[fileInfo.extension],
        data: data,
        path: fileInfo.filepath,
      };
    } catch (error) {
      console.error(`Erro ao ler o arquivo ${fileInfo.filepath}:`, error);
      return null;
    }
  }
  return null;
}

export function getFilesZip(fileInfo: IFileInfo): IFile[] {
  if (fileInfo.extension === '.zip') {
    try {
      const zip = new AdmZip(fileInfo.filepath);
      const zipEntries = zip.getEntries();
      return zipEntries.map(zipEntry => ({
        type: 'zip',
        name: zipEntry.name,
        data: zipEntry.getData().toString('binary'),
        path: fileInfo.filepath,
      }));
    } catch (error) {
      console.error(`Erro ao processar ZIP ${fileInfo.filepath}:`, error);
      return [];
    }
  }
  return [];
}

// TODO - refazer essa validação sem lib externa
function validatePdf(fileInfo: IFileInfo, certificate: boolean): boolean {
  console.log(fileInfo)
  console.log(certificate)
  return true;
}

export function validateDiretoryFileExists(fileInfo: IFileInfo): boolean {
  try {
    const fileDirectory = path.dirname(fileInfo.filepath);
    return fsSync.existsSync(fileDirectory);
  } catch (error) {
    return false;
  }
}

export function validateDFileExists(fileInfo: IFileInfo): boolean {
  return fsSync.existsSync(fileInfo.filepath);
}

export async function copyMigrations(): Promise<void> {
  try {
    if (!app.isPackaged) return;

    const prismaMigrations = path.join(process.resourcesPath, 'prisma');
    const userDataPath = app.getPath('userData');

    await copyRecursiveAsync(prismaMigrations, userDataPath);

    console.log('Migrations copiadas com sucesso');
  } catch (error) {
    console.error('Erro ao copiar migrations:', error);
  }
}

export async function applyMigrations(): Promise<void> {
  try {
    if (!app.isPackaged) {
      execSync('npx prisma migrate deploy', {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
      return;
    }

    const resourcesPath = process.resourcesPath.replace('app.asar', 'app.asar.unpacked');

    const migrationEnginePath = path.join(
      resourcesPath,
      'prisma-engines',
      process.platform === 'win32' ? 'migration-engine.exe' : 'migration-engine'
    );

    const prismaSchema = path.join(app.getPath('userData'), 'schema.prisma');
    const dbPath = path.join(app.getPath('userData'), 'nfmonitor.db');

    let schemaContent = fsSync.readFileSync(prismaSchema, 'utf-8');
    schemaContent = schemaContent.replace('file:./dev.db', `file:${dbPath}`);
    fsSync.writeFileSync(prismaSchema, schemaContent, 'utf-8');

    if (!fsSync.existsSync(migrationEnginePath)) {
      throw new Error(`Migration engine não encontrado em: ${migrationEnginePath}`);
    }

    if (process.platform !== 'win32') {
      execSync(`chmod +x "${migrationEnginePath}"`, { stdio: 'ignore' });
    }

    execSync(`"${migrationEnginePath}" cli migrate deploy`, {
      stdio: 'pipe',
      timeout: 60000,
      env: {
        ...process.env,
        DATABASE_URL: `file:${dbPath}`,
        PRISMA_SCHEMA_PATH: prismaSchema,
        PRISMA_MIGRATION_TABLE_NAME: '_prisma_migrations',
      },
      cwd: app.getPath('userData'),
    });

    console.log('Migrations aplicadas com sucesso');
  } catch (error) {
    console.error('Erro ao aplicar migrations:', error);
    throw error;
  }
}

export async function recicleDb() {
  if (!app.isPackaged) return;
  const dbPath = path.join(app.getPath('userData'), 'db.json');
  if (!fsSync.existsSync(dbPath)) return;
  const db: IDb = JSON.parse(fsSync.readFileSync(dbPath, 'utf-8'));
  const config: IConfig = {
    timeForProcessing: db.timeForProcessing ?? '00:00',
    viewUploadedFiles: false,
    removeUploadedFiles: false,
  };
  const directories: IDirectory[] =
    db.directories?.map(x => ({
      ...x,
      directories: 0,
      xmls: 0,
      pdfs: 0,
      txts: 0,
      zips: 0,
      totalFiles: 0,
      pfx: 0,
    })) ?? [];

  const discoredDirecories: IDirectory[] =
    db.directoriesAndSubDirectories?.map(x => ({
      ...x,
      directories: 0,
      xmls: 0,
      pdfs: 0,
      txts: 0,
      zips: 0,
      pfx: 0,
      totalFiles: 0,
    })) ?? [];

  const files: IFileInfo[] =
    db.files?.map(x => ({
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
  await signInSittax(db.auth?.credentials?.user ?? '', db.auth?.credentials?.password ?? '', true);
  const newDbPath = dbPath.replace('db.json', 'oldDb.json');
  fsSync.renameSync(dbPath, newDbPath);
}

async function copyRecursiveAsync(srcDir: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });

  const entries = await fs.readdir(srcDir, { withFileTypes: true });

  const semaphore = new Array(MAX_CONCURRENT_OPERATIONS).fill(null);
  let index = 0;

  const processEntry = async () => {
    while (index < entries.length) {
      const entry = entries[index++];
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        await copyRecursiveAsync(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  };

  await Promise.all(semaphore.map(() => processEntry()));
}

export function copyRecursive(srcDir: string, destDir: string) {
  fsSync.mkdirSync(destDir, { recursive: true });

  const entries = fsSync.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fsSync.copyFileSync(srcPath, destPath);
    }
  }
}

export function createDirectoryFolder(directoryPath: string) {
  if (!fsSync.existsSync(directoryPath)) {
    fsSync.mkdirSync(path.resolve(directoryPath), { recursive: true });
  }
}

export async function listarArquivos(diretorios: string[]): Promise<IFileInfo[]> {
  const arquivos = await Promise.all(
    diretorios.map(async (diretorio): Promise<IFileInfo[]> => {
      return await processDirectoryAsync(diretorio);
    })
  );

  return arquivos.flat();
}

async function processDirectoryAsync(diretorio: string): Promise<IFileInfo[]> {
  const results: IFileInfo[] = [];
  const dirQueue: string[] = [diretorio];
  const visitedDirs = new Set<string>();

  while (dirQueue.length > 0) {
    const currentDir = dirQueue.shift()!;
    const normalizedPath = path.resolve(currentDir);

    if (visitedDirs.has(normalizedPath)) {
      continue;
    }

    visitedDirs.add(normalizedPath);

    try {
      const itens = await fs.readdir(currentDir, {
        withFileTypes: true,
      });

      for (let i = 0; i < itens.length; i += BATCH_SIZE) {
        const batch = itens.slice(i, i + BATCH_SIZE);

        const paths = await Promise.all(
          batch.map(async (item): Promise<IFileInfo | null> => {
            const caminhoCompleto = path.join(currentDir, item.name);

            if (item.isDirectory()) {
              dirQueue.push(caminhoCompleto);
              return null;
            }

            let stats: fsSync.Stats;
            if (fileStatsCache.has(caminhoCompleto)) {
              stats = fileStatsCache.get(caminhoCompleto)!;
            } else {
              stats = await fs.stat(caminhoCompleto);
              fileStatsCache.set(caminhoCompleto, stats);
            }

            const extension = path.extname(item.name).toLowerCase();

            return {
              filepath: caminhoCompleto,
              filename: item.name,
              extension: extension,
              isDirectory: false,
              isFile: true,
              wasSend: false,
              dataSend: null,
              isValid: VALID_EXTENSIONS.has(extension),
              bloqued: false,
              modifiedtime: stats.mtime,
              size: stats.size,
            };
          })
        );

        results.push(...(paths.filter(p => p !== null) as IFileInfo[]));
      }
    } catch (error) {
      console.error(`Erro ao processar diretório ${currentDir}:`, error);
    }
  }

  return results;
}

function validateTxt(fileInfo: IFileInfo): boolean {
  try {
    if (!fsSync.existsSync(fileInfo.filepath)) {
      console.log('Arquivo não encontrado:', fileInfo.filepath);
      return false;
    }

    const fileContent = fsSync.readFileSync(fileInfo.filepath, 'utf8');

    if (fileContent.length < 28) {
      console.log('Arquivo muito pequeno. Tamanho:', fileContent.length);
      return false;
    }

    const first28Chars = fileContent.substring(0, 28);

    return /^.{28}$/.test(first28Chars);
  } catch (error) {
    return false;
  }
}

function validatePfx(fileInfo: IFileInfo): boolean {
  try {
    if (!fsSync.existsSync(fileInfo.filepath)) {
      console.log('Arquivo não encontrado:', fileInfo.filepath);
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}
('');
