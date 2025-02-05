import { ErrorType } from "@prisma/client";
import { IUser } from "../interfaces/user";
import { IDbHistoric } from "../interfaces/db-historic";
import { IFileInfo } from "../interfaces/file-info";
import { IDirectory } from "../interfaces/directory";
import { IConfig } from "../interfaces/config";
import { getDirectoryData } from "./file-operation-service";
import { ICountedNotes } from "../interfaces/count-notes";
import { IAuth } from "../interfaces/auth";
import prisma from "../lib/prisma";
import { BrowserWindow } from "electron";
import { endOfDay, startOfDay } from "date-fns";

export async function getConfiguration(): Promise<IConfig | null> {
  return prisma.configuration.findFirst();
}

export async function updateConfiguration(data: IConfig) {
  const config = await prisma.configuration.findFirst();
  if (config) {
    return await prisma.configuration.update({
      where: { id: config.id },
      data: {
        ...data,
        id: undefined,
      },
    });
  }
}

export async function getAuth(): Promise<IAuth | null> {
  const user = await prisma.user.findFirst();
  const auth = await prisma.auth.findFirst();
  if (!auth) return null;
  return { ...auth, user };
}

export async function addAuth(data: {
  token: string;
  user: IUser;
  username: string;
  password: string;
  empresas: any[];
  configuration: {
    apiKeySieg: string;
    emailSieg: string;
    senhaSieg: string;
  };
}) {
  try {
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
      data: data.empresas.map((empresa) => ({
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
    const config = await prisma.configuration.findFirst();
    if (config) {
      await prisma.configuration.update({
        where: { id: config?.id },
        data: {
          ...config,
          apiKeySieg: data.configuration.apiKeySieg,
          emailSieg: data.configuration.emailSieg,
          senhaSieg: data.configuration.senhaSieg,
        },
      });
    } else {
      await prisma.configuration.create({
        data: {
          timeForProcessing: "00:00",
          timeForConsultingSieg: "00:00",
          viewUploadedFiles: false,
          apiKeySieg: data.configuration.apiKeySieg,
          emailSieg: data.configuration.emailSieg,
          senhaSieg: data.configuration.senhaSieg,
        },
      });
    }

    return { ...auth, config, token: data.token };
  } catch (error) {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send(
        "main-process-message",
        `signIn error: ${JSON.stringify(
          error,
          Object.getOwnPropertyNames(error)
        )}`
      );
    });
  }
}

export async function updateAuth(data: {
  id: number;
  token?: string;
  username?: string;
  password?: string;
}) {
  return prisma.auth.update({
    where: { id: data.id },
    data: {
      token: data.token ?? "",
      username: data.username ?? "",
      password: data.password ?? "",
    },
  });
}

export async function getUser(): Promise<IUser | null> {
  const user = await prisma.user.findFirst();
  if (!user) return null;
  return {
    id: user.id,
    userId: user.userId,
    nome: user.nome,
    sobrenome: user.sobrenome,
    cpf: user.cpf,
    email: user.email,
    phoneNumber: user.phoneNumber,
    ativo: user.ativo,
    emailConfirmed: user.emailConfirmed,
    accessFailedCount: user.accessFailedCount,
    dataDeCriacao: user.dataDeCriacao,
    lockoutEnd: user.lockoutEnd,
    eUsuarioEmpresa: user.eUsuarioEmpresa,
    role: user.role,
    ePrimeiroAcesso: user.ePrimeiroAcesso,
    nivel: user.nivel,
  };
}

export async function removeAuth() {
  return await prisma.$transaction(async (tx) => {
    await tx.countedNotes.deleteMany();
    await tx.empresa.deleteMany();
    await tx.auth.deleteMany();
    await tx.user.deleteMany();
  });
}

export async function getDirectories(): Promise<IDirectory[]> {
  const directorySieg = await getDirectoriesDownloadSieg();
  const directories = await prisma.directory.findMany();
  const result: IDirectory[] = [];
  if (directories?.length > 0) {
    result.push(...directories);
  }
  if (directorySieg) {
    result.push(directorySieg);
  }
  return result;
}

export async function getDirectoriesDownloadSieg(): Promise<IDirectory | null> {
  const config = await getConfiguration();
  if (config && config.directoryDownloadSieg) {
    const directory = getDirectoryData(config.directoryDownloadSieg);
    return directory;
  }
  return null;
}

export async function addDirectory(data: {
  path: string;
  modifiedtime: Date;
  size: number;
}) {
  const existingPath = await prisma.directory.findFirst({
    where: {
      path: {
        equals: data.path,
      },
    },
  });
  if (existingPath) {
    return existingPath;
  }
  return prisma.directory.create({ data });
}

export async function addDirectories(
  data: {
    path: string;
    modifiedtime: Date;
    size: number;
  }[]
) {
  const existingPaths = await prisma.directory.findMany({
    select: { path: true },
  });
  const existingPathSet = new Set(existingPaths.map((d) => d.path));
  const newDirectories = data.filter((d) => !existingPathSet.has(d.path));
  return prisma.directory.createMany({ data: newDirectories });
}

export async function removeDirectory(path: string) {
  return await prisma.directory.deleteMany({
    where: {
      path: {
        equals: path,
      },
    },
  });
}

export async function getFiles(): Promise<IFileInfo[]> {
  return await prisma.file.findMany();
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
) {
  const existingPaths = await prisma.file.findMany({
    select: { filepath: true },
  });
  const existingPathSet = new Set(existingPaths.map((d) => d.filepath));
  const newDirectories = data.filter((d) => !existingPathSet.has(d.filepath));
  return prisma.file.createMany({ data: newDirectories });
}

export async function updateFile(
  filepath: string,
  data: {
    wasSend?: boolean;
    dataSend?: Date;
    isValid?: boolean;
    bloqued?: boolean;
  }
) {
  return prisma.file.updateMany({
    where: { filepath },
    data,
  });
}

export async function removeFiles(path: string) {
  return prisma.file.deleteMany({
    where: { filepath: { contains: path } },
  });
}

export async function countFilesSendedToDay() {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  return prisma.file.count({
    where: { wasSend: true, dataSend: { gte: todayStart, lt: todayEnd } },
  });
}

export async function getDirectoryDiscovery(term?: string) {
  if (!term || term.length === 0) return prisma.directoryDiscovery.findMany();
  return prisma.directoryDiscovery.findMany({
    where: { path: { equals: term } },
  });
}

export async function addDirectoryDiscovery(data: IDirectory[]) {
  const existingPaths = await prisma.directoryDiscovery.findMany({
    select: { path: true },
  });

  const existingPathSet = new Set(existingPaths.map((d) => d.path));
  const newDirectories = data.filter((d) => !existingPathSet.has(d.path));

  if (newDirectories.length === 0) {
    return { count: 0 };
  }
  return prisma.directoryDiscovery.createMany({ data });
}

export async function updateDirectoryDiscovery(
  directoryPath: string,
  data: Partial<IDirectory>
) {
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

export async function updateHistoric(data: IDbHistoric) {
  return prisma.historic.update({
    where: { id: data.id },
    data: { ...data, log: JSON.stringify(data.log) },
  });
}

export async function getHistoric(): Promise<IDbHistoric[]> {
  const historic =
    (await prisma.historic.findMany({
      orderBy: { startDate: "desc" },
    })) ?? [];

  return historic.map((record: any) => ({
    ...record,
    log: JSON.parse(record.log),
  }));
}

export async function clearHistoric() {
  return prisma.historic.deleteMany();
}

export async function addError(data: {
  message: string;
  stack: string;
  type: ErrorType;
}) {
  return prisma.error.create({ data });
}

export async function getEmpresas() {
  return prisma.empresa.findMany({ orderBy: { cnpj: "asc" } });
}

export async function addCountedNotes(data: ICountedNotes) {
  return prisma.countedNotes.create({
    data,
  });
}

export async function getCountedNotes(
  dataInicio: Date,
  dataFim: Date
): Promise<ICountedNotes | null> {
  return prisma.countedNotes.findFirst({
    where: {
      dataInicio,
      dataFim,
    },
  });
}

export async function updateCountedNotes(data: ICountedNotes) {
  return prisma.countedNotes.update({
    where: { id: data.id },
    data,
  });
}
