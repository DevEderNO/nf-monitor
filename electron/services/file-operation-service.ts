import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { BrowserWindow, dialog, OpenDialogOptions } from 'electron';
import AdmZip from 'adm-zip';
import { IFileInfo } from '../interfaces/file-info';
import { IDirectory } from '../interfaces/directory';
import { isBefore, addMonths } from 'date-fns';
import { getDataEmissao } from '../lib/nfse-utils';

const VALID_EXTENSIONS = new Set(['.xml', '.pdf', '.zip', '.txt', '.pfx']);

const CHAVE_ACESSO_PATTERNS = [
  /<chNFe>[0-9]{44}/gi,
  /NFe[0-9]{44}/gi,
  /NFCe[0-9]{44}/gi,
  /CFe[0-9]{44}/gi,
  /CTe[0-9]{44}/gi,
];

// LRU Cache com limite de tamanho
const MAX_CACHE_SIZE = 10000;

class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    // Move para o final (mais recente)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove o mais antigo (primeiro item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const diretorioCache = new LRUCache<string, IDirectory>(MAX_CACHE_SIZE);
const validationCache = new LRUCache<string, { valid: boolean; isNotaFiscal: boolean }>(MAX_CACHE_SIZE);
const fileStatsCache = new LRUCache<string, fsSync.Stats>(MAX_CACHE_SIZE);

const BATCH_SIZE = 100;

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
  const cached = diretorioCache.get(dirPath);
  if (cached) return cached;

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
  } catch {
    return null;
  }
}

export function validFile(fileInfo: IFileInfo, certificate: boolean): { valid: boolean; isNotaFiscal: boolean } {
  const cacheKey = `${fileInfo.filepath}:${fileInfo.extension}`;

  const cached = validationCache.get(cacheKey);
  if (cached) return cached;

  let validate = { valid: false, isNotaFiscal: false };

  try {
    switch (fileInfo.extension.toLowerCase()) {
      case '.xml':
        // Ler apenas os primeiros bytes para verificar se é XML válido
        const fd = fsSync.openSync(fileInfo.filepath, 'r');
        const buffer = Buffer.alloc(64);
        const bytesRead = fsSync.readSync(fd, buffer, 0, 64, 0);
        fsSync.closeSync(fd);
        if (bytesRead > 0) {
          const start = buffer.toString('utf-8', 0, bytesRead).trim();
          if (start.startsWith('<')) {
            validate = { valid: true, isNotaFiscal: true };
          }
        }
        validationCache.set(cacheKey, validate);
        return validate;
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
  } catch {
    // Erro de validação, retornar inválido
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
  } catch {
    return { valid: false, isNotaFiscal: false };
  }
}

export function validZip(fileInfo: IFileInfo): { valid: boolean; isNotaFiscal: boolean } {
  const cacheKey = `zip:${fileInfo.filepath}`;

  const cached = validationCache.get(cacheKey);
  if (cached) return cached;

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
  } catch {
    validationCache.set(cacheKey, validate);
    return validate;
  }
}

// TODO - refazer essa validação sem lib externa
function validatePdf(_fileInfo: IFileInfo, _certificate: boolean): boolean {
  return true;
}

export function validateDiretoryFileExists(fileInfo: IFileInfo): boolean {
  try {
    const fileDirectory = path.dirname(fileInfo.filepath);
    return fsSync.existsSync(fileDirectory);
  } catch {
    return false;
  }
}

export function validateDFileExists(fileInfo: IFileInfo): boolean {
  return fsSync.existsSync(fileInfo.filepath);
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
            const cachedStats = fileStatsCache.get(caminhoCompleto);
            if (cachedStats) {
              stats = cachedStats;
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
    } catch {
      // Erro ao processar diretório, continuar
    }
  }

  return results;
}

function validateTxt(fileInfo: IFileInfo): boolean {
  try {
    if (!fsSync.existsSync(fileInfo.filepath)) {
      return false;
    }

    // Ler apenas os primeiros 28 bytes em vez do arquivo inteiro
    const fd = fsSync.openSync(fileInfo.filepath, 'r');
    const buffer = Buffer.alloc(28);
    const bytesRead = fsSync.readSync(fd, buffer, 0, 28, 0);
    fsSync.closeSync(fd);

    if (bytesRead < 28) {
      return false;
    }

    const first28Chars = buffer.toString('utf8', 0, 28);
    return /^.{28}$/.test(first28Chars);
  } catch {
    return false;
  }
}

function validatePfx(fileInfo: IFileInfo): boolean {
  try {
    if (!fsSync.existsSync(fileInfo.filepath)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ==================== INCREMENTAL PROCESSING FUNCTIONS ====================

export interface IDiskFile {
  filepath: string;
  filename: string;
  extension: string;
  size: number;
  modifiedtime: Date | null;
  isDirectory: boolean;
  isFile: boolean;
}

/**
 * List files in a single directory (non-recursive)
 * Returns only files, not subdirectories
 */
export async function listFilesInDirectory(dirPath: string): Promise<IDiskFile[]> {
  const files: IDiskFile[] = [];

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (item.isFile()) {
        const fullPath = path.join(dirPath, item.name);
        const extension = path.extname(item.name).toLowerCase();

        if (!VALID_EXTENSIONS.has(extension)) continue;

        try {
          const stats = await fs.stat(fullPath);
          files.push({
            filepath: fullPath,
            filename: item.name,
            extension,
            size: stats.size,
            modifiedtime: stats.mtime,
            isDirectory: false,
            isFile: true,
          });
        } catch {
          // File inaccessible, skip
        }
      }
    }
  } catch {
    // Directory inaccessible
  }

  return files;
}

/**
 * List subdirectories in a directory (non-recursive)
 */
export async function listSubdirectories(dirPath: string): Promise<string[]> {
  const subdirs: string[] = [];

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        subdirs.push(path.join(dirPath, item.name));
      }
    }
  } catch {
    // Directory inaccessible
  }

  return subdirs;
}
