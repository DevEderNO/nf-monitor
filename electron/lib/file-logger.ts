import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = app.isPackaged ? path.join(app.getPath('userData'), 'logs') : path.join(__dirname, '../../logs');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_LOG_FILES = 5;

// Garante que o diretório de logs existe
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

// Rotaciona logs antigos
function rotateLogs(baseName: string) {
  const files = fs.readdirSync(LOG_DIR)
    .filter(f => f.startsWith(baseName))
    .sort()
    .reverse();

  if (files.length >= MAX_LOG_FILES) {
    // Remove o mais antigo
    fs.unlinkSync(path.join(LOG_DIR, files[files.length - 1]));
  }
}

// Obtém o nome do arquivo de log atual
function getLogFileName(type: 'error' | 'info'): string {
  const date = new Date().toISOString().split('T')[0];
  return `${type}-${date}.log`;
}

// Formata a data para o log
function formatDate(): string {
  return new Date().toLocaleString('pt-BR');
}

// Escreve no arquivo de log
function writeToLog(type: 'error' | 'info', message: string, details?: unknown) {
  try {
    ensureLogDir();

    const fileName = getLogFileName(type);
    const filePath = path.join(LOG_DIR, fileName);

    // Verifica se precisa rotacionar
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > MAX_LOG_SIZE) {
        rotateLogs(type);
      }
    }

    let logEntry = `[${formatDate()}] ${message}`;

    if (details) {
      if (details instanceof Error) {
        logEntry += `\n  Stack: ${details.stack}`;
      } else if (typeof details === 'object') {
        logEntry += `\n  Details: ${JSON.stringify(details, null, 2)}`;
      } else {
        logEntry += `\n  Details: ${details}`;
      }
    }

    logEntry += '\n---\n';

    fs.appendFileSync(filePath, logEntry, 'utf8');
  } catch {
    // Falha silenciosa - não queremos crashar por causa de log
    console.error('Falha ao escrever log:', message);
  }
}

// API pública
export const fileLogger = {
  error: (message: string, details?: unknown) => writeToLog('error', message, details),
  info: (message: string, details?: unknown) => writeToLog('info', message, details),
  getLogPath: () => LOG_DIR,
};

// Mensagens amigáveis para o usuário (sem detalhes técnicos)
export const userMessages = {
  // Erros de arquivo
  fileNotFound: 'Arquivo não encontrado',
  fileInvalid: 'Arquivo inválido para envio',
  fileTooLarge: 'Arquivo muito grande',
  fileRemoved: 'Arquivo removido',

  // Erros de rede
  networkError: 'Erro de conexão. Tentando novamente...',
  serverError: 'Servidor temporariamente indisponível',
  authError: 'Sessão expirada. Reconectando...',

  // Status
  discovering: 'Buscando arquivos...',
  starting: 'Iniciando envio...',
  sending: (current: number, total: number) => `Enviando arquivo ${current} de ${total}`,
  sent: 'Arquivo enviado',
  paused: 'Envio pausado',
  cancelled: 'Envio cancelado',
  completed: (count: number) => `Concluído! ${count} arquivo${count !== 1 ? 's' : ''} enviado${count !== 1 ? 's' : ''}`,
  completedWithErrors: (sent: number, errors: number) =>
    `Concluído com alertas: ${sent} enviado${sent !== 1 ? 's' : ''}, ${errors} não enviado${errors !== 1 ? 's' : ''}`,
  noFiles: 'Nenhum arquivo novo encontrado',
  retrying: 'Tentando novamente...',
  authenticating: 'Autenticando...',
  authenticated: 'Autenticado',
};
