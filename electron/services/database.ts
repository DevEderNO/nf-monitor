import { ErrorType, PrismaClient } from "@prisma/client";
import { app } from "electron";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { IUser } from "../interfaces/user";
import { IDbHistoric } from "../interfaces/db-historic";
import { IFileInfo } from "../interfaces/file-info";
import { IDirectory } from "../interfaces/directory";

// Configura o caminho do banco de dados
const dbPath = app.isPackaged
  ? path.join(process.resourcesPath, "prisma/dev.db")
  : path.join(__dirname, "../prisma/dev.db");

process.env.DATABASE_URL = `file:${dbPath}`;

const prisma = new PrismaClient();

export async function initializeDatabase() {
  try {
    // Verifica se o banco existe
    const dbExists = fs.existsSync(dbPath);

    if (!dbExists) {
      // Executa o comando prisma db push
      const prismaBinPath = app.isPackaged
        ? path.join(process.resourcesPath, "node_modules/.bin/prisma")
        : "npx prisma";

      execSync(`${prismaBinPath} db push --skip-generate`, {
        env: {
          ...process.env,
          DATABASE_URL: `file:${dbPath}`,
        },
      });

      // Cria configuração inicial
      const config = await prisma.configuration.findFirst();
      if (!config) {
        await prisma.configuration.create({
          data: {
            timeForProcessing: "00:00",
            viewUploadedFiles: false,
          },
        });
      }
    }
  } catch (error) {
    console.error("Erro ao inicializar banco:", error);
    throw error;
  }
}

export async function getConfiguration() {
  return prisma.configuration.findFirst();
}

export async function updateConfiguration(data: {
  timeForProcessing?: string;
  viewUploadedFiles?: boolean;
}) {
  const config = await prisma.configuration.findFirst();
  if (config) {
    return prisma.configuration.update({
      where: { id: config.id },
      data,
    });
  }
}

export async function getAuth() {
  return prisma.auth.findFirst();
}

export async function addAuth(data: {
  token: string;
  user: IUser;
  username: string;
  password: string;
  empresas: any[];
}) {
  const result = await prisma.$transaction(async (tx) => {
    // Create user record first
    const savedUser = await tx.user.create({
      data: {
        userId: data.user.userId,
        nome: data.user.Nome,
        sobrenome: data.user.Sobrenome,
        cpf: data.user.Cpf,
        email: data.user.Email,
        phoneNumber: data.user.PhoneNumber,
        ativo: data.user.Ativo,
        emailConfirmed: data.user.EmailConfirmed,
        accessFailedCount: data.user.AccessFailedCount.toString(),
        dataDeCriacao: data.user.DataDeCriacao.toString(),
        lockoutEnd: data.user.LockoutEnd?.toString() || "",
        eUsuarioEmpresa: data.user.EUsuarioEmpresa,
        role: JSON.stringify(data.user.Role),
        ePrimeiroAcesso: data.user.EPrimeiroAcesso,
        nivel: data.user.Nivel,
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
        name: data.user.Nome,
        username: data.username,
        password: data.password,
      },
    });

    return auth;
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

export async function removeAuth() {
  return await prisma.$transaction(async (tx) => {
    await tx.empresa.deleteMany();
    await tx.auth.deleteMany();
    await tx.user.deleteMany();
  });
}

export async function getDirectories() {
  return prisma.directory.findMany();
}

export async function addDirectory(data: {
  path: string;
  modifiedtime: Date;
  size: number;
}) {
  return prisma.directory.create({ data });
}

export async function addDirectories(
  data: {
    path: string;
    modifiedtime: Date;
    size: number;
  }[]
) {
  return prisma.directory.createMany({ data });
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
  return prisma.directory.deleteMany({
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
}) {
  return prisma.historic.create({
    data: {
      ...data,
      log: JSON.stringify(data.log),
    },
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
