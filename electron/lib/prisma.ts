import { PrismaClient } from '@prisma/client';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileLogger } from './file-logger';

const DB_NAME = 'nfmonitor.db';
const VERSION_FILE = 'app-version.txt';

function ensureDatabaseExists() {
  if (!app.isPackaged) return;

  const userDataPath = app.getPath('userData');
  const userDbPath = path.join(userDataPath, DB_NAME);
  const versionFilePath = path.join(userDataPath, VERSION_FILE);
  const bundledDbPath = path.join(process.resourcesPath, 'prisma', 'dev.db');
  const currentVersion = app.getVersion();

  try {
    // Ensure userData directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    let needsRecreate = false;

    // 1. Check if app version changed
    if (fs.existsSync(versionFilePath)) {
      const storedVersion = fs.readFileSync(versionFilePath, 'utf-8').trim();
      if (storedVersion !== currentVersion) {
        fileLogger.info(`Versão do app alterada de ${storedVersion} para ${currentVersion}. Recriando banco de dados.`);
        needsRecreate = true;
      }
    } else if (fs.existsSync(userDbPath)) {
      fileLogger.info('Arquivo de versão não encontrado, mas banco existe. Recriando por segurança.');
      needsRecreate = true;
    }

    // 2. Check if bundled database is newer than user database (in case version wasn't bumped)
    if (!needsRecreate && fs.existsSync(userDbPath) && fs.existsSync(bundledDbPath)) {
      const userDbStats = fs.statSync(userDbPath);
      const bundledDbStats = fs.statSync(bundledDbPath);

      if (bundledDbStats.mtime > userDbStats.mtime) {
        fileLogger.info('Banco de dados embutido é mais recente que o local. Recriando para aplicar schema novo.');
        needsRecreate = true;
      }
    }

    // Delete old database if needed
    if (needsRecreate && fs.existsSync(userDbPath)) {
      try {
        fs.unlinkSync(userDbPath);
        fileLogger.info('Banco de dados antigo removido com sucesso.');
      } catch (err) {
        fileLogger.error('Falha ao remover banco de dados antigo. Pode estar em uso.', err);
        // On Windows, if we can't delete it, we might be in trouble. 
        // We'll try to rename it as a fallback.
        try {
          const backupPath = `${userDbPath}.old.${Date.now()}`;
          fs.renameSync(userDbPath, backupPath);
          fileLogger.info(`Banco de dados antigo renomeado para ${backupPath}`);
        } catch (renameErr) {
          fileLogger.error('Falha crítica ao renomear banco de dados.', renameErr);
        }
      }
    }

    // Copy fresh database if needed
    if (!fs.existsSync(userDbPath)) {
      if (!fs.existsSync(bundledDbPath)) {
        fileLogger.error(`Banco de dados base não encontrado em: ${bundledDbPath}`);
        // No throw here, maybe it works if Prisma creates it? 
        // But Prisma needs the initial schema from dev.db usually in this setup.
        return;
      }

      fs.copyFileSync(bundledDbPath, userDbPath);
      fileLogger.info('Novo banco de dados copiado do pacote com sucesso.');
    }

    // Save current app version
    fs.writeFileSync(versionFilePath, currentVersion);
  } catch (err) {
    fileLogger.error('Erro crítico na inicialização do banco de dados:', err);
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

// Try to perform a simple query to ensure the DB is working
if (app.isPackaged) {
  prisma.user.findFirst().catch(err => {
    fileLogger.error('Falha ao validar banco de dados na inicialização:', err);
    // If it fails here, the schema is likely wrong or the file is corrupted.
    // We could trigger a force-reset for next time.
    const userDataPath = app.getPath('userData');
    const versionFilePath = path.join(userDataPath, VERSION_FILE);
    try {
      if (fs.existsSync(versionFilePath)) {
        fs.unlinkSync(versionFilePath); // Force recreation on next boot
      }
    } catch {
      // Ignore cleanup error
    }
  });
}

export default prisma;
