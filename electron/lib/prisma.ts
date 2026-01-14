import { PrismaClient } from '@prisma/client';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

export function getDatabaseUrl(): string {
  const dbPath = app.isPackaged
    ? path.join(app.getPath('userData'), 'nfmonitor.db')
    : path.join(__dirname, '..', 'prisma', 'dev.db');
  return `file:${dbPath}`;
}

function getPrismaEnginesPath() {
  if (!app.isPackaged) {
    return {};
  }

  const platform = process.platform;
  const resourcesPath = process.resourcesPath;

  let queryEngineFileName: string;
  let schemaEngineFileName: string;

  if (platform === 'win32') {
    queryEngineFileName = 'query_engine-windows.dll.node';
    schemaEngineFileName = 'schema-engine-windows.exe';
  } else if (platform === 'darwin') {
    const arch = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin';
    queryEngineFileName = `libquery_engine-${arch}.dylib.node`;
    schemaEngineFileName = 'schema-engine-darwin';
  } else {
    queryEngineFileName = 'libquery_engine-debian-openssl-3.0.x.so.node';
    schemaEngineFileName = 'schema-engine-debian-openssl-3.0.x';
  }

  const enginesPath = path.join(resourcesPath, 'prisma-engines');

  const queryEnginePath = path.join(enginesPath, queryEngineFileName);
  const schemaEnginePath = path.join(enginesPath, schemaEngineFileName);

  if (fs.existsSync(queryEnginePath)) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = queryEnginePath;
  }

  if (fs.existsSync(schemaEnginePath)) {
    process.env.PRISMA_QUERY_ENGINE_BINARY = queryEnginePath;
    process.env.PRISMA_MIGRATION_ENGINE_BINARY = schemaEnginePath;
    process.env.PRISMA_INTROSPECTION_ENGINE_BINARY = schemaEnginePath;
    process.env.PRISMA_FMT_BINARY = schemaEnginePath;
  }

  return {};
}

getPrismaEnginesPath();

process.env.DATABASE_URL = getDatabaseUrl();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
  log: app.isPackaged ? ['error'] : ['query', 'error', 'warn'],
});

export default prisma;
