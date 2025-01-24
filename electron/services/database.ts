import { ErrorType, PrismaClient } from "@prisma/client";
import { app } from "electron";
import path from "path";
import { IUser } from "../interfaces/user";
import { IDbHistoric } from "../interfaces/db-historic";
import { IFileInfo } from "../interfaces/file-info";
import { IDirectory } from "../interfaces/directory";
import { IConfig } from "../interfaces/config";
import { getDirectoryData } from "./file-operation-service";
import { ICountedNotes } from "../interfaces/count-notes";
import { IAuth } from "../interfaces/auth";

// Configura o caminho do banco de dados
const dbPath = app.isPackaged
  ? path.join(process.resourcesPath, "prisma", "nfmonitor.db")
  : path.join(__dirname, "..", "prisma", "dev.db");

process.env.DATABASE_URL = `file:${dbPath}`;

// Inicializa o PrismaClient com o banco de dados no caminho especificado
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`,
    },
  },
});

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
  const result = await prisma.$transaction(async (tx) => {
    // Create user record first
    const savedUser = await tx.user.create({
      data: {
        id: undefined,
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
        nivel: data.user.nivel,
      },
    });

    // Create empresas record with reference to user
    await tx.empresa.createMany({
      data: data.empresas.map((empresa) => ({
        empresaId: empresa.empresaId,
        nome: empresa.nome,
        cnpj: empresa.cnpj,
        userId: savedUser.id,
      })),
    });

    // Create auth record with reference to user
    const auth = await tx.auth.create({
      data: {
        token: data.token,
        userId: savedUser.id,
        name: data.user.nome,
        username: data.username,
        password: data.password,
      },
    });
    const config = await tx.configuration.findFirst();
    if (config) {
      await tx.configuration.update({
        where: { id: config?.id },
        data: {
          ...config,
          apiKeySieg: data.configuration.apiKeySieg,
          emailSieg: data.configuration.emailSieg,
          senhaSieg: data.configuration.senhaSieg,
        },
      });
    } else {
      await tx.configuration.create({
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
  });
  return result;
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
  if (directorySieg) {
    return [directorySieg, ...(await prisma.directory.findMany())];
  }
  return await prisma.directory.findMany();
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

export async function existsDirectory(path: string): Promise<boolean> {
  const result =
    (await prisma.directory.findFirst({
      where: {
        path: {
          equals: path,
        },
      },
    })) !== null;
  return result;
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

export async function getDirectoryDiscovery() {
  return prisma.directoryDiscovery.findMany();
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

export async function addDirectoryDiscoveries(
  data: {
    path: string;
    modifiedtime: Date;
    size: number;
  }[]
) {
  return prisma.directoryDiscovery.createMany({ data });
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
