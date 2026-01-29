import { PrismaClient } from '@prisma/client';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const DB_NAME = 'nfmonitor.db';
const VERSION_FILE = 'app-version.txt';

function ensureDatabaseExists() {
  if (!app.isPackaged) return;

  const userDataPath = app.getPath('userData');
  const userDbPath = path.join(userDataPath, DB_NAME);
  const versionFilePath = path.join(userDataPath, VERSION_FILE);
  const bundledDbPath = path.join(process.resourcesPath, 'prisma', 'dev.db');
  const currentVersion = app.getVersion();

  // Ensure userData directory exists
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  // Check if app version changed (schema may have changed)
  let needsRecreate = false;

  if (fs.existsSync(versionFilePath)) {
    const storedVersion = fs.readFileSync(versionFilePath, 'utf-8').trim();
    if (storedVersion !== currentVersion) {
      needsRecreate = true;
    }
  } else if (fs.existsSync(userDbPath)) {
    // Database exists but no version file - old installation, needs recreation
    needsRecreate = true;
  }

  // Delete old database if version changed
  if (needsRecreate && fs.existsSync(userDbPath)) {
    fs.unlinkSync(userDbPath);
  }

  // Copy fresh database if needed
  if (!fs.existsSync(userDbPath)) {
    if (!fs.existsSync(bundledDbPath)) {
      throw new Error(
        `Arquivo de banco de dados não encontrado em ${bundledDbPath}. ` +
          'Por favor, reinstale a aplicação ou entre em contato com o suporte.'
      );
    }
    fs.copyFileSync(bundledDbPath, userDbPath);
  }

  // Save current app version
  fs.writeFileSync(versionFilePath, currentVersion);
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
