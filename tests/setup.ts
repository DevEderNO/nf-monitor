// Configurações globais para os testes
import { jest } from '@jest/globals';

// Mock do módulo fs para evitar operações reais de arquivo
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmdirSync: jest.fn(),
}));

// Mock do módulo path
jest.mock('path', () => ({
  join: jest.fn(),
  dirname: jest.fn(),
  basename: jest.fn(),
  extname: jest.fn(),
}));

// Mock do módulo AdmZip
jest.mock('adm-zip', () => {
  return jest.fn().mockImplementation(() => ({
    extractAllTo: jest.fn(),
  }));
});

// Mock das funções de serviço
jest.mock('../electron/services/file-operation-service', () => ({
  isFileBlocked: jest.fn(),
  listarArquivos: jest.fn(),
  unblockFile: jest.fn(),
  validFile: jest.fn(),
  validZip: jest.fn(),
  validateDFileExists: jest.fn(),
}));

jest.mock('../electron/services/database', () => ({
  addFiles: jest.fn(),
  addHistoric: jest.fn(),
  getAuth: jest.fn(),
  getConfiguration: jest.fn(),
  getCountFilesSended: jest.fn(),
  getDirectories: jest.fn(),
  getFiles: jest.fn(),
  removeFiles: jest.fn(),
  updateAuth: jest.fn(),
  updateFile: jest.fn(),
  updateHistoric: jest.fn(),
}));

jest.mock('../electron/lib/axios', () => ({
  signIn: jest.fn(),
  upload: jest.fn(),
}));

jest.mock('../electron/services/health-broker-service', () => ({
  healthBrokerComunication: jest.fn(),
}));

jest.mock('../electron/lib/time-utils', () => ({
  getTimestamp: jest.fn(() => '2024-01-01 00:00:00'),
  timeout: jest.fn(() => Promise.resolve()),
}));

// Configurações globais
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};
