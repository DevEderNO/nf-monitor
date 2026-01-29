import { PrismaClient } from '@prisma/client';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const DB_NAME = 'nfmonitor.db';
const SCHEMA_VERSION_FILE = 'schema-version.txt';

const CURRENT_SCHEMA_VERSION = '1';

function ensureDatabaseExists() {
  if (!app.isPackaged) return;

  const userDataPath = app.getPath('userData');
  const userDbPath = path.join(userDataPath, DB_NAME);
  const versionFilePath = path.join(userDataPath, SCHEMA_VERSION_FILE);
  const bundledDbPath = path.join(process.resourcesPath, 'prisma', 'dev.db');

  // Check if schema version changed
  let needsRecreate = false;

  if (fs.existsSync(versionFilePath)) {
    const storedVersion = fs.readFileSync(versionFilePath, 'utf-8').trim();
    if (storedVersion !== CURRENT_SCHEMA_VERSION) {
      needsRecreate = true;
    }
  } else if (fs.existsSync(userDbPath)) {
    // Database exists but no version file - old installation, needs recreation
    needsRecreate = true;
  }

  // Delete old database if schema changed
  if (needsRecreate && fs.existsSync(userDbPath)) {
    fs.unlinkSync(userDbPath);
  }

  // Copy fresh database if needed
  if (!fs.existsSync(userDbPath)) {
    fs.copyFileSync(bundledDbPath, userDbPath);
  }

  // Save current schema version
  fs.writeFileSync(versionFilePath, CURRENT_SCHEMA_VERSION);
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
