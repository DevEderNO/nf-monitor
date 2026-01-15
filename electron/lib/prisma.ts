import { PrismaClient } from '@prisma/client';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const DB_NAME = 'nfmonitor.db';

function ensureDatabaseExists() {
  if (!app.isPackaged) return;

  const userDbPath = path.join(app.getPath('userData'), DB_NAME);
  const bundledDbPath = path.join(process.resourcesPath, 'prisma', 'dev.db');

  if (!fs.existsSync(userDbPath)) {
    fs.copyFileSync(bundledDbPath, userDbPath);
  }
}

export function getDatabaseUrl(): string {
  const dbPath = app.isPackaged
    ? path.join(app.getPath('userData'), DB_NAME)
    : path.join(__dirname, '..', 'prisma', 'dev.db');

  return `file:${dbPath}`;
}

ensureDatabaseExists();

function getUserDbPath() {
  return path.join(app.getPath('userData'), DB_NAME);
}

function getBundledDbPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'prisma', 'dev.db')
    : path.join(process.cwd(), 'prisma', 'dev.db');
}

export function resetUserData(): void {
  const userDataDir = app.getPath('userData');

  try {
    prisma.$disconnect().catch(() => {});

    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, {
        recursive: true,
        force: true,
      });
    }

    fs.mkdirSync(userDataDir, { recursive: true });

    const bundledDbPath = getBundledDbPath();
    const userDbPath = getUserDbPath();

    fs.copyFileSync(bundledDbPath, userDbPath);

    console.warn('[APP] userData resetado com sucesso');
  } catch (err) {
    console.error('[APP] Falha crítica ao resetar userData', err);
  }
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
  log: app.isPackaged ? ['error'] : ['query', 'warn', 'error'],
});

export default prisma;
