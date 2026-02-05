import { ErrorType, Prisma } from '@prisma/client';
import { IUser } from '../interfaces/user';
import { IDbHistoric } from '../interfaces/db-historic';
import { IFileInfo } from '../interfaces/file-info';
import { IDirectory } from '../interfaces/directory';
import { IConfig } from '../interfaces/config';
import { IAuth } from '../interfaces/auth';
import prisma from '../lib/prisma';
import { IEmpresa } from '../interfaces/empresa';
import * as path from 'path';
import * as crypto from 'crypto';

let addFilesQueue = Promise.resolve();

function hashFilename(filename: string): string {
  return crypto.createHash('md5').update(filename).digest('base64url');
}

export async function getConfiguration(): Promise<IConfig | null> {
  return (await prisma.configuration.findFirst()) ?? null;
}

export async function updateConfiguration(data: IConfig) {
  const config = await getConfiguration();
  if (config) {
    return await prisma.configuration.update({
      where: { id: config.id },
      data: {
        ...data,
        id: undefined,
      },
    });
  } else {
    return await prisma.configuration.create({ data });
  }
}

export async function getAuth(): Promise<IAuth | null> {
  const user = await prisma.user.findFirst();
  const auth = await prisma.auth.findFirst();
  const config = await getConfiguration();

  if (!auth) return null;

  return {
    ...auth,
    user,
    configuration: config || undefined,
  };
}

export async function addAuth(data: {
  token: string;
  user: IUser;
  username: string;
  password: string;
  empresas: IEmpresa[];
}) {
  // Create user record first
  const savedUser = await prisma.user.create({
    data: {
      userId: data.user.userId,
      nome: data.user.nome,
      sobrenome: data.user.sobrenome,
      cpf: data.user.cpf,
      email: data.user.email,
      phoneNumber: data.user.phoneNumber,
      ativo: data.user.ativo,
      emailConfirmed: data.user.emailConfirmed,
      accessFailedCount: data.user.accessFailedCount,
      dataDeCriacao: data.user.dataDeCriacao,
      lockoutEnd: data.user.lockoutEnd,
      eUsuarioEmpresa: data.user.eUsuarioEmpresa,
      role: JSON.stringify(data.user.role),
      ePrimeiroAcesso: data.user.ePrimeiroAcesso,
      nivel: data.user.nivel.valueOf(),
    },
  });

  // Create empresas record with reference to user
  await prisma.empresa.createMany({
    data: data.empresas.map(empresa => ({
      empresaId: empresa.empresaId,
      nome: empresa.nome,
      cnpj: empresa.cnpj,
      userId: savedUser.id,
    })),
  });

  // Create auth record with reference to user
  const auth = await prisma.auth.create({
    data: {
      token: data.token,
      userId: savedUser.id,
      name: data.user.nome,
      username: data.username,
      password: data.password,
    },
  });
  const config = await getConfiguration();
  if (config) {
    await prisma.configuration.update({
      where: { id: config?.id },
      data: {
        ...config,
      },
    });
  } else {
    await prisma.configuration.create({
      data: {
        timeForProcessing: '00:00',
        viewUploadedFiles: false,
      },
    });
  }

  return {
    ...auth,
    user: savedUser,
    token: data.token,
  };
}

export async function updateAuth(data: { id: number; token?: string; username?: string; password?: string }) {
  return prisma.auth.update({
    where: { id: data.id },
    data: {
      token: data.token ?? '',
      username: data.username ?? '',
      password: data.password ?? '',
    },
  });
}

export async function removeAuth(): Promise<void> {
  return await prisma.$transaction(async tx => {
    await tx.empresa.deleteMany();
    await tx.auth.deleteMany();
    await tx.user.deleteMany();
  });
}

// Simplificado: uma única query para buscar diretórios
export async function getDirectories(): Promise<IDirectory[]> {
  try {
    return (
      (await prisma.directory.findMany({
        where: {
          type: { in: ['invoices', 'certificates'] },
        },
      })) ?? []
    );
  } catch {
    return [];
  }
}

export async function addDirectories(data: IDirectory[]): Promise<number> {
  const existingDirectories =
    (await prisma.directory.findMany({
      select: { path: true, type: true },
    })) ?? [];

  const existingPathTypeSet = new Set(existingDirectories.map(d => `${d.path}|${d.type}`));

  const newDirectories = data.filter(d => !existingPathTypeSet.has(`${d.path}|${d.type}`));

  return (
    (
      await prisma.directory.createMany({
        data: newDirectories.map(d => ({ ...d, id: undefined })),
      })
    )?.count ?? 0
  );
}

export async function updateDirectoryByPath(path: string, data: Partial<IDirectory>): Promise<void> {
  await prisma.directory.updateMany({
    where: { path },
    data,
  });
}

export async function removeDirectory(path: string, type: 'invoices' | 'certificates'): Promise<number> {
  return (
    (
      await prisma.directory.deleteMany({
        where: {
          path: {
            equals: path,
          },
          type: type,
        },
      })
    )?.count ?? 0
  );
}

// BasePath functions

async function getBasePathsMap(basePathIds: number[]): Promise<Map<number, string>> {
  const uniqueIds = [...new Set(basePathIds)];
  const basePaths = await prisma.basePath.findMany({
    where: { id: { in: uniqueIds } },
  });
  return new Map(basePaths.map(bp => [bp.id, bp.path]));
}

function fileToFileInfo(
  file: {
    id: number;
    basePathId: number;
    filename: string;
    extension: string;
    wasSend: boolean;
    dataSend: Date | null;
    isValid: boolean;
    bloqued: boolean;
    isDirectory: boolean;
    isFile: boolean;
    modifiedtime: Date | null;
    size: number;
    createdAt: Date;
    updatedAt: Date;
  },
  basePath: string
): IFileInfo {
  return {
    id: file.id,
    basePathId: file.basePathId,
    basePath: basePath,
    filepath: path.join(basePath, file.filename),
    filename: file.filename,
    extension: file.extension,
    wasSend: file.wasSend,
    dataSend: file.dataSend,
    isValid: file.isValid,
    bloqued: file.bloqued,
    isDirectory: file.isDirectory,
    isFile: file.isFile,
    modifiedtime: file.modifiedtime,
    size: file.size,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

export async function getFiles(): Promise<IFileInfo[]> {
  const files = (await prisma.file.findMany()) ?? [];
  if (files.length === 0) return [];

  const basePathsMap = await getBasePathsMap(files.map(f => f.basePathId));
  return files.map(file => fileToFileInfo(file, basePathsMap.get(file.basePathId) ?? ''));
}

export async function getCountFilesSended(): Promise<number> {
  return (await prisma.file.count({ where: { wasSend: true, extension: { not: { equals: '.pfx' } } } })) ?? 0;
}

export async function getCountFilesSendedPfx(): Promise<number> {
  return (await prisma.file.count({ where: { wasSend: true, extension: { equals: '.pfx' } } })) ?? 0;
}

export async function addFiles(
  data: {
    filepath: string;
    wasSend: boolean;
    dataSend: Date | null;
    isValid: boolean;
    bloqued: boolean;
    filename: string;
    extension: string;
    size: number;
    isDirectory: boolean;
    isFile: boolean;
    modifiedtime: Date | null;
  }[]
): Promise<number> {
  const task = addFilesQueue.then(async () => {
    if (data.length === 0) return 0;

    // Get or create basePaths for all unique directories (batch query to avoid N+1)
    const uniqueDirs = [...new Set(data.map(d => path.dirname(d.filepath)))];

    // Fetch all existing basePaths in a single query
    const existingBasePaths = await prisma.basePath.findMany({
      where: { path: { in: uniqueDirs } },
    });

    const basePathMap = new Map<string, number>(existingBasePaths.map(bp => [bp.path, bp.id]));

    // Create only the missing basePaths
    const newDirs = uniqueDirs.filter(dir => !basePathMap.has(dir));
    if (newDirs.length > 0) {
      await prisma.basePath.createMany({
        data: newDirs.map(dir => ({ path: dir })),
      });
      // Fetch the newly created basePaths
      const newBasePaths = await prisma.basePath.findMany({
        where: { path: { in: newDirs } },
      });
      newBasePaths.forEach(bp => basePathMap.set(bp.path, bp.id));
    }

    // Create map of files to insert, preventing duplicates within the batch
    const newFilesMap = new Map();
    const existingFiles = (await prisma.file.findMany({
      select: { basePathId: true, filename: true },
    })) ?? [];
    const existingSet = new Set(existingFiles.map(f => `${f.basePathId}:${f.filename}`));

    for (const d of data) {
      const dir = path.dirname(d.filepath);
      const basePathId = basePathMap.get(dir)!;
      const hashedName = hashFilename(d.filename);
      const key = `${basePathId}:${hashedName}`;

      if (!existingSet.has(key) && !newFilesMap.has(key)) {
        newFilesMap.set(key, {
          basePathId,
          filename: hashedName,
          extension: d.extension,
          wasSend: d.wasSend,
          dataSend: d.dataSend,
          isValid: d.isValid,
          bloqued: d.bloqued,
          size: d.size,
          isDirectory: d.isDirectory,
          isFile: d.isFile,
          modifiedtime: d.modifiedtime,
        });
      }
    }

    const filesToInsert = Array.from(newFilesMap.values());
    if (filesToInsert.length === 0) return 0;

    try {
      return (await prisma.file.createMany({ data: filesToInsert }))?.count ?? 0;
    } catch (error) {
      let count = 0;
      for (const file of filesToInsert) {
        try {
          await prisma.file.create({ data: file });
          count++;
        } catch (e) {
          // Skip duplicates or log them
        }
      }
      return count;
    }
  });

  addFilesQueue = task.then(() => { }).catch(() => { });
  return task;
}

export async function updateFile(
  filepath: string,
  data: {
    wasSend?: boolean;
    dataSend?: Date;
    isValid?: boolean;
    bloqued?: boolean;
  }
): Promise<number> {
  const dir = path.dirname(filepath);
  const filename = hashFilename(path.basename(filepath));

  const basePath = await prisma.basePath.findUnique({ where: { path: dir } });
  if (!basePath) return 0;

  return (
    (
      await prisma.file.updateMany({
        where: { basePathId: basePath.id, filename },
        data,
      })
    )?.count ?? 0
  );
}

export async function removeFiles(filepath: string): Promise<number> {
  const dir = path.dirname(filepath);
  const filename = hashFilename(path.basename(filepath));

  // Try exact match first (specific file)
  const basePath = await prisma.basePath.findUnique({ where: { path: dir } });
  if (basePath) {
    const deleted = await prisma.file.deleteMany({
      where: { basePathId: basePath.id, filename },
    });
    if (deleted.count > 0) return deleted.count;
  }

  // If no exact match, search for files in directories that start with the given directory
  const matchingBasePaths = await prisma.basePath.findMany({
    where: { path: { startsWith: dir } },
  });

  if (matchingBasePaths.length === 0) return 0;

  const deleted = await prisma.file.deleteMany({
    where: { basePathId: { in: matchingBasePaths.map(bp => bp.id) } },
  });

  return deleted.count;
}

export async function cleanupOldFiles(): Promise<number> {
  const config = await getConfiguration();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (config?.lastCleanup && new Date(config.lastCleanup) > thirtyDaysAgo) {
    return 0;
  }

  const deleted = await prisma.file.deleteMany({
    where: { wasSend: true },
  });

  // Cleanup all old data
  await cleanupOrphanedBasePaths();
  await cleanupOldHistoric(30);
  await cleanupOldErrors(30);
  await vacuumDatabase();

  await updateConfiguration({ ...config, lastCleanup: now } as IConfig);
  return deleted?.count ?? 0;
}

async function cleanupOrphanedBasePaths(): Promise<number> {
  // Find basePaths with no files
  const orphanedBasePaths = await prisma.basePath.findMany({
    where: {
      files: { none: {} },
    },
    select: { id: true },
  });

  if (orphanedBasePaths.length === 0) return 0;

  const deleted = await prisma.basePath.deleteMany({
    where: { id: { in: orphanedBasePaths.map(bp => bp.id) } },
  });

  return deleted.count;
}

/**
 * Cleanup historic records older than specified days
 */
export async function cleanupOldHistoric(daysToKeep = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const deleted = await prisma.historic.deleteMany({
    where: { startDate: { lt: cutoffDate } },
  });

  return deleted.count;
}

/**
 * Cleanup error records older than specified days
 */
export async function cleanupOldErrors(daysToKeep = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const deleted = await prisma.error.deleteMany({
    where: { date: { lt: cutoffDate } },
  });

  return deleted.count;
}

/**
 * Run VACUUM to reclaim disk space after deletions
 */
export async function vacuumDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe('VACUUM');
}

export async function getDirectoriesDiscovery(): Promise<IDirectory[]> {
  return prisma.directoryDiscovery.findMany() ?? [];
}

export async function getDirectoriesDiscoveryInPath(path: string): Promise<IDirectory[]> {
  return (
    prisma.directoryDiscovery.findMany({
      where: { path: { startsWith: path, not: path } },
    }) ?? []
  );
}

export async function getDirectoryDiscovery(term: string): Promise<IDirectory | null> {
  return prisma.directoryDiscovery.findFirst({
    where: { path: { equals: term } },
  });
}

export async function addDirectoryDiscovery(data: IDirectory[]): Promise<{ count: number }> {
  const existingPaths =
    (await prisma.directoryDiscovery.findMany({
      select: { path: true },
    })) ?? [];

  const existingPathSet = new Set(existingPaths.map(d => d.path));
  const newDirectories = data.filter(d => !existingPathSet.has(d.path));

  if (newDirectories.length === 0) {
    return { count: 0 };
  }
  return prisma.directoryDiscovery.createMany({
    data: newDirectories.map(d => ({ ...d, id: undefined })),
  });
}

export async function updateDirectoryDiscovery(directoryPath: string, data: Partial<IDirectory>): Promise<void> {
  if (directoryPath.length === 0) return;
  const directory = await prisma.directoryDiscovery.findFirst({
    where: { path: directoryPath },
  });
  if (directory?.id === undefined) return;
  await prisma.directoryDiscovery.update({
    where: { id: directory.id },
    data: {
      ...directory,
      ...data,
    },
  });
}

export async function removeDirectoryDiscoveryStartsWith(path: string): Promise<number> {
  return (
    (
      await prisma.directoryDiscovery.deleteMany({
        where: { path: { startsWith: path } },
      })
    )?.count ?? 0
  );
}

export async function addHistoric(data: {
  startDate: Date;
  endDate: Date | null;
  filesSent: number;
  log: string[];
}): Promise<IDbHistoric> {
  const historic = await prisma.historic.create({
    data: {
      ...data,
      id: undefined,
      log: JSON.stringify(data.log),
    },
  });
  return {
    ...historic,
    log: JSON.parse(historic.log),
  };
}

export async function updateHistoric(data: IDbHistoric): Promise<void> {
  await prisma.historic.update({
    where: { id: data.id },
    data: { ...data, log: JSON.stringify(data.log) },
  });
}

export async function getHistoric(): Promise<IDbHistoric[]> {
  const historic =
    (await prisma.historic.findMany({
      orderBy: { startDate: 'desc' },
    })) ?? [];

  return historic.map(
    (record: {
      id: number;
      log: string;
      filesSent: number;
      createdAt: Date;
      updatedAt: Date;
      startDate: Date;
      endDate: Date | null;
    }): IDbHistoric => ({
      ...record,
      log: JSON.parse(record.log),
    })
  );
}

export async function clearHistoric(): Promise<void> {
  await prisma.historic.deleteMany();
}

export async function addError(data: { message: string; stack: string; type: ErrorType }): Promise<void> {
  await prisma.error.create({ data });
}

export async function updateFilesBatch(ids: number[], data: Prisma.FileUpdateInput): Promise<void> {
  if (ids.length === 0) return;
  await prisma.file.updateMany({
    where: { id: { in: ids } },
    data: data as any, // Cast to any to avoid strict type mismatch with UpdateManyMutationInput
  });
}

export async function removeFilesBatch(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await prisma.file.deleteMany({
    where: { id: { in: ids } },
  });
  return result.count;
}

// ==================== INCREMENTAL PROCESSING FUNCTIONS ====================

/**
 * Get or create a basePath and return its ID
 */
export async function getOrCreateBasePath(dirPath: string): Promise<number> {
  const existing = await prisma.basePath.findUnique({ where: { path: dirPath } });
  if (existing) return existing.id;

  const created = await prisma.basePath.create({ data: { path: dirPath } });
  return created.id;
}

/**
 * Get files for a specific basePath only (not all files in DB)
 */
export async function getFilesByBasePath(dirPath: string): Promise<Map<string, { id: number; wasSend: boolean; isValid: boolean; dataSend: Date | null }>> {
  const basePath = await prisma.basePath.findUnique({ where: { path: dirPath } });
  if (!basePath) return new Map();

  const files = await prisma.file.findMany({
    where: { basePathId: basePath.id },
    select: { id: true, filename: true, wasSend: true, isValid: true, dataSend: true },
  });

  return new Map(files.map(f => [f.filename, { id: f.id, wasSend: f.wasSend, isValid: f.isValid, dataSend: f.dataSend }]));
}

/**
 * Add files for a specific basePath (incremental, no full table scan)
 */
export async function addFilesForBasePath(
  files: { filename: string; extension: string; size: number; modifiedtime: Date | null; isDirectory: boolean; isFile: boolean }[],
  dirPath: string,
  existingHashes: Set<string>
): Promise<number> {
  if (files.length === 0) return 0;

  const basePathId = await getOrCreateBasePath(dirPath);

  const filesToInsert: {
    basePathId: number;
    filename: string;
    extension: string;
    wasSend: boolean;
    dataSend: null;
    isValid: boolean;
    bloqued: boolean;
    size: number;
    isDirectory: boolean;
    isFile: boolean;
    modifiedtime: Date | null;
  }[] = [];

  for (const file of files) {
    const hashedName = hashFilename(file.filename);
    if (!existingHashes.has(hashedName)) {
      filesToInsert.push({
        basePathId,
        filename: hashedName,
        extension: file.extension,
        wasSend: false,
        dataSend: null,
        isValid: true,
        bloqued: false,
        size: file.size,
        isDirectory: file.isDirectory,
        isFile: file.isFile,
        modifiedtime: file.modifiedtime,
      });
    }
  }

  if (filesToInsert.length === 0) return 0;

  try {
    return (await prisma.file.createMany({ data: filesToInsert }))?.count ?? 0;
  } catch {
    // Fallback for constraint violations
    let count = 0;
    for (const file of filesToInsert) {
      try {
        await prisma.file.create({ data: file });
        count++;
      } catch {
        // Skip duplicates
      }
    }
    return count;
  }
}

/**
 * Get pending files count for progress tracking
 */
export async function getPendingFilesCount(): Promise<number> {
  return await prisma.file.count({
    where: {
      wasSend: false,
      isValid: true,
      extension: { in: ['.xml', '.pdf', '.txt', '.zip'] },
    },
  });
}
