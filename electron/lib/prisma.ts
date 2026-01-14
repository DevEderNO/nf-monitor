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

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
  log: app.isPackaged ? ['error'] : ['query', 'warn', 'error'],
});

export default prisma;
