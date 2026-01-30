import { ErrorType } from '@prisma/client';
import { IUser } from '../interfaces/user';
import { IDbHistoric } from '../interfaces/db-historic';
import { IFileInfo } from '../interfaces/file-info';
import { IDirectory } from '../interfaces/directory';
import { IConfig } from '../interfaces/config';
import { IAuth } from '../interfaces/auth';
import prisma from '../lib/prisma';
import { IEmpresa } from '../interfaces/empresa';

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

export async function getFiles(): Promise<IFileInfo[]> {
  return (await prisma.file.findMany()) ?? [];
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
  }[]
): Promise<number> {
  const existingPaths =
    (await prisma.file.findMany({
      select: { filepath: true },
    })) ?? [];
  const existingPathSet = new Set(existingPaths.map(d => d.filepath));
  const newDirectories = data.filter(d => !existingPathSet.has(d.filepath));
  return (await prisma.file.createMany({ data: newDirectories }))?.count ?? 0;
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
  return (
    (
      await prisma.file.updateMany({
        where: { filepath },
        data,
      })
    )?.count ?? 0
  );
}

export async function removeFiles(path: string): Promise<number> {
  return (
    (
      await prisma.file.deleteMany({
        where: { filepath: { contains: path } },
      })
    )?.count ?? 0
  );
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
