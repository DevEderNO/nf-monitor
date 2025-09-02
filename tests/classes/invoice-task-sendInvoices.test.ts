import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { InvoiceTask } from '../../electron/classes/invoice-task';
import { IFileInfo } from '../../electron/interfaces/file-info';
import { connection, IStringified } from 'websocket';
import { validFile } from '../../electron/services/file-operation-service';
import { upload } from '../../electron/lib/axios';
import { updateFile } from '../../electron/services/database';

// Função auxiliar para acessar método privado
const callPrivateMethod = (instance: InvoiceTask, methodName: string, ...args: unknown[]) => {
  return (instance as any)[methodName](...args);
};

// Mocks
const mockConnection = {
  sendUTF: jest.fn(),
} as unknown as connection;

const mockFileInfo: IFileInfo = {
  filepath: '/test/path/file.xml',
  filename: 'file.xml',
  extension: '.xml',
  size: 1024,
  createdAt: new Date(),
  updatedAt: new Date(),
  wasSend: false,
  isDirectory: false,
  bloqued: false,
  isFile: true,
  modifiedtime: new Date(),
  isValid: true,
  dataSend: null,
};

// Mock das funções externas
jest.mock('../../electron/services/file-operation-service', () => ({
  validFile: jest.fn(),
  isFileBlocked: jest.fn(),
  listarArquivos: jest.fn(),
  unblockFile: jest.fn(),
  validZip: jest.fn(),
  validateDFileExists: jest.fn(),
}));

jest.mock('../../electron/lib/axios', () => ({
  upload: jest.fn(),
  updateFile: jest.fn(),
  signIn: jest.fn(),
}));

describe('InvoiceTask - sendInvoicesFileToSittax', () => {
  let invoiceTask: InvoiceTask;
  let mockValidFile: jest.MockedFunction<typeof validFile>;
  let mockUpload: jest.MockedFunction<typeof upload>;
  let mockUpdateFile: jest.MockedFunction<typeof updateFile>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Criar instância da classe
    invoiceTask = new InvoiceTask();
    invoiceTask.connection = mockConnection;
    invoiceTask.files = [mockFileInfo];
    invoiceTask.max = 1;
    invoiceTask.auth = {
      id: 1,
      token: 'mock-token',
      username: 'test',
      password: 'test',
      user: null,
      name: null,
    };

    // Obter referências dos mocks
    mockValidFile = validFile as jest.MockedFunction<typeof validFile>;
    mockUpload = upload as jest.MockedFunction<typeof upload>;
    mockUpdateFile = updateFile as jest.MockedFunction<typeof updateFile>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sendInvoicesFileToSittax - Arquivo Válido', () => {
    it('deve enviar arquivo válido com sucesso', async () => {
      // Arrange
      const validFileResult = {
        valid: true,
        isNotaFiscal: true,
      };
      mockValidFile.mockReturnValue(validFileResult);
      mockUpload.mockResolvedValue(undefined);
      mockUpdateFile.mockResolvedValue(0);

      // Act
      const result = await callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50);

      // Assert
      expect(result).toBe(true);
      expect(mockValidFile).toHaveBeenCalledWith(mockFileInfo, false);
      expect(mockUpload).toHaveBeenCalledWith('mock-token', '/test/path/file.xml', true);
      expect(mockUpdateFile).toHaveBeenCalledWith('/test/path/file.xml', {
        wasSend: true,
        dataSend: expect.any(Date),
      });
      expect(invoiceTask.files[0].isValid).toBe(true);
      expect(invoiceTask.files[0].wasSend).toBe(true);
      expect(invoiceTask.files[0].dataSend).toBeInstanceOf(Date);
      expect(invoiceTask.filesSendedCount).toBe(1);
      expect(invoiceTask.hasError).toBe(false);
    });

    it('deve enviar mensagens de progresso durante o envio', async () => {
      // Arrange
      const validFileResult = {
        valid: true,
        isNotaFiscal: true,
      };
      mockValidFile.mockReturnValue(validFileResult);
      mockUpload.mockResolvedValue(undefined);
      mockUpdateFile.mockResolvedValue(0);

      // Act
      await callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50);

      // Assert
      expect(mockConnection.sendUTF).toHaveBeenCalledWith(
        expect.stringContaining('🚀 Enviando /test/path/file.xml')
      );
      expect(mockConnection.sendUTF).toHaveBeenCalledWith(
        expect.stringContaining('✅ Enviado com sucesso /test/path/file.xml')
      );
    });

    it('deve usar token de autenticação correto', async () => {
      // Arrange
      const validFileResult = {
        valid: true,
        isNotaFiscal: true,
      };
      mockValidFile.mockReturnValue(validFileResult);
      mockUpload.mockResolvedValue(undefined);
      mockUpdateFile.mockResolvedValue(0);

      // Act
      await callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50);

      // Assert
      expect(mockUpload).toHaveBeenCalledWith('mock-token', '/test/path/file.xml', true);
    });

    it('deve lidar com token de autenticação nulo', async () => {
      // Arrange
      invoiceTask.auth = null;
      const validFileResult = {
        valid: true,
        isNotaFiscal: true,
      };
      mockValidFile.mockReturnValue(validFileResult);
      mockUpload.mockResolvedValue(undefined);
      mockUpdateFile.mockResolvedValue(0);

      // Act
      await callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50);

      // Assert
      expect(mockUpload).toHaveBeenCalledWith('', '/test/path/file.xml', true);
    });
  });

  describe('sendInvoicesFileToSittax - Erros de Upload', () => {
    it('deve tratar erro genérico de upload', async () => {
      // Arrange
      const validFileResult = {
        valid: true,
        isNotaFiscal: true,
      };
      mockValidFile.mockReturnValue(validFileResult);
      const uploadError = new Error('Erro de rede');
      mockUpload.mockRejectedValue(uploadError);

      // Act & Assert
      await expect(callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50)).rejects.toThrow('Erro de rede');
      expect(invoiceTask.hasError).toBe(true);
      expect(mockConnection.sendUTF).toHaveBeenCalledWith(
        expect.stringContaining('❌ Erro ao enviar /test/path/file.xml')
      );
    });

    it('deve tratar erro de arquivo muito grande', async () => {
      // Arrange
      const validFileResult = {
        valid: true,
        isNotaFiscal: true,
      };
      mockValidFile.mockReturnValue(validFileResult);
      const uploadError = new Error('Arquivo muito grande') as Error & { code: string; config: { headers: { 'Content-Length': string } } };
      uploadError.code = 'ERR_BAD_RESPONSE';
      uploadError.config = {
        headers: {
          'Content-Length': '52428800', // 50MB
        },
      };
      mockUpload.mockRejectedValue(uploadError);

      // Act & Assert
      await expect(callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50)).rejects.toThrow('Arquivo muito grande');
      expect(invoiceTask.hasError).toBe(true);
      expect(mockConnection.sendUTF).toHaveBeenCalledWith(
        expect.stringContaining('❌ Arquivo muito grande (50.00MB): /test/path/file.xml')
      );
    });

    it('deve tratar erro de servidor rejeitando arquivo (status 400)', async () => {
      // Arrange
      const validFileResult = {
        valid: true,
        isNotaFiscal: true,
      };
      mockValidFile.mockReturnValue(validFileResult);
      const uploadError = new Error('Servidor rejeitou') as Error & { code: string; response: { status: number } };
      uploadError.code = 'ERR_BAD_RESPONSE';
      uploadError.response = {
        status: 400,
      };
      mockUpload.mockRejectedValue(uploadError);

      // Act & Assert
      await expect(callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50)).rejects.toThrow('Servidor rejeitou');
      expect(invoiceTask.hasError).toBe(true);
      expect(mockConnection.sendUTF).toHaveBeenCalledWith(
        expect.stringContaining('❌ Servidor rejeitou o arquivo: /test/path/file.xml')
      );
    });

    it('deve tratar erro de upload sem config.headers', async () => {
      // Arrange
      const validFileResult = {
        valid: true,
        isNotaFiscal: true,
      };
      mockValidFile.mockReturnValue(validFileResult);
      const uploadError = new Error('Erro de rede') as Error & { code: string; config: Record<string, unknown> };
      uploadError.code = 'ERR_BAD_RESPONSE';
      uploadError.config = {};
      mockUpload.mockRejectedValue(uploadError);

      // Act & Assert
      await expect(callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50)).rejects.toThrow('Erro de rede');
      expect(invoiceTask.hasError).toBe(true);
      expect(mockConnection.sendUTF).toHaveBeenCalledWith(
        expect.stringContaining('❌ Erro ao enviar /test/path/file.xml')
      );
    });
  });

  describe('sendInvoicesFileToSittax - Arquivo Inválido', () => {
    it('deve tratar arquivo inválido (não é nota fiscal)', async () => {
      // Arrange
      const invalidFileResult = {
        valid: false,
        isNotaFiscal: false,
      };
      mockValidFile.mockReturnValue(invalidFileResult);
      mockUpdateFile.mockResolvedValue(0);

      // Act
      const result = await callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50);

      // Assert
      expect(result).toBe(true);
      expect(mockUpload).not.toHaveBeenCalled();
      expect(mockUpdateFile).toHaveBeenCalledWith('/test/path/file.xml', {
        isValid: false,
      });
      expect(invoiceTask.files[0].isValid).toBe(false);
      expect(mockConnection.sendUTF).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Arquivo não e válido para o envio /test/path/file.xml')
      );
    });

    it('deve tratar arquivo inválido (nota fiscal antiga)', async () => {
      // Arrange
      const invalidFileResult = {
        valid: false,
        isNotaFiscal: true,
      };
      mockValidFile.mockReturnValue(invalidFileResult);
      mockUpdateFile.mockResolvedValue(0);

      // Act
      const result = await callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50);

      // Assert
      expect(result).toBe(true);
      expect(mockUpload).not.toHaveBeenCalled();
      expect(mockUpdateFile).toHaveBeenCalledWith('/test/path/file.xml', {
        isValid: false,
      });
      expect(invoiceTask.files[0].isValid).toBe(false);
      expect(mockConnection.sendUTF).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Arquivo não é válido por que a data de emissão e anterior 3️⃣ messes /test/path/file.xml')
      );
    });
  });

  describe('sendInvoicesFileToSittax - Estados da Classe', () => {
    it('deve incrementar filesSendedCount apenas em caso de sucesso', async () => {
      // Arrange
      const initialCount = invoiceTask.filesSendedCount;
      const validFileResult = {
        valid: true,
        isNotaFiscal: true,
      };
      mockValidFile.mockReturnValue(validFileResult);
      mockUpload.mockResolvedValue(undefined);
      mockUpdateFile.mockResolvedValue(0);

      // Act
      await callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50);

      // Assert
      expect(invoiceTask.filesSendedCount).toBe(initialCount + 1);
    });

    it('não deve incrementar filesSendedCount em caso de arquivo inválido', async () => {
      // Arrange
      const initialCount = invoiceTask.filesSendedCount;
      const invalidFileResult = {
        valid: false,
        isNotaFiscal: false,
      };
      mockValidFile.mockReturnValue(invalidFileResult);
      mockUpdateFile.mockResolvedValue(0);

      // Act
      await callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50);

      // Assert
      expect(invoiceTask.filesSendedCount).toBe(initialCount);
    });

    it('não deve incrementar filesSendedCount em caso de erro', async () => {
      // Arrange
      const initialCount = invoiceTask.filesSendedCount;
      const validFileResult = {
        valid: true,
        isNotaFiscal: true,
      };
      mockValidFile.mockReturnValue(validFileResult);
      mockUpload.mockRejectedValue(new Error('Erro de rede'));

      // Act & Assert
      await expect(callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50)).rejects.toThrow('Erro de rede');
      expect(invoiceTask.filesSendedCount).toBe(initialCount);
    });

    it('deve definir hasError como true apenas em caso de erro de upload', async () => {
      // Arrange
      const validFileResult = {
        valid: true,
        isNotaFiscal: true,
      };
      mockValidFile.mockReturnValue(validFileResult);
      mockUpload.mockRejectedValue(new Error('Erro de rede'));

      // Act & Assert
      await expect(callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50)).rejects.toThrow('Erro de rede');
      expect(invoiceTask.hasError).toBe(true);
    });

    it('não deve definir hasError como true em caso de arquivo inválido', async () => {
      // Arrange
      const invalidFileResult = {
        valid: false,
        isNotaFiscal: false,
      };
      mockValidFile.mockReturnValue(invalidFileResult);
      mockUpdateFile.mockResolvedValue(0);

      // Act
      await callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50);

      // Assert
      expect(invoiceTask.hasError).toBe(false);
    });
  });

  describe('sendInvoicesFileToSittax - Validação de Parâmetros', () => {
    it('deve usar o índice correto para acessar o arquivo', async () => {
      // Arrange
      const secondFile = { ...mockFileInfo, filepath: '/test/path/file2.xml' };
      invoiceTask.files = [mockFileInfo, secondFile];
      const validFileResult = {
        valid: true,
        isNotaFiscal: true,
      };
      mockValidFile.mockReturnValue(validFileResult);
      mockUpload.mockResolvedValue(undefined);
      mockUpdateFile.mockResolvedValue(0);

      // Act
      await callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 1, 50);

      // Assert
      expect(mockValidFile).toHaveBeenCalledWith(secondFile, false);
      expect(mockUpload).toHaveBeenCalledWith('mock-token', '/test/path/file2.xml', true);
    });

    it('deve usar o progresso correto nas mensagens', async () => {
      // Arrange
      const validFileResult = {
        valid: true,
        isNotaFiscal: true,
      };
      mockValidFile.mockReturnValue(validFileResult);
      mockUpload.mockResolvedValue(undefined);
      mockUpdateFile.mockResolvedValue(0);

      // Act
      await callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 75);

      // Assert
      expect(mockConnection.sendUTF).toHaveBeenCalledWith(
        expect.stringContaining('🚀 Enviando /test/path/file.xml')
      );
      // Verificar se o progresso está sendo passado corretamente
      const calls = (mockConnection.sendUTF as jest.Mock).mock.calls as [IStringified, ((err?: Error | undefined) => void) | undefined][];
      expect(calls.some(call => 
        JSON.parse(call[0] as string).message.data.progress === 75
      )).toBe(true);
    });
  });

  describe('sendInvoicesFileToSittax - Tratamento de Datas', () => {
    it('deve definir dataSend corretamente no arquivo', async () => {
      // Arrange
      const validFileResult = {
        valid: true,
        isNotaFiscal: true,
      };
      mockValidFile.mockReturnValue(validFileResult);
      mockUpload.mockResolvedValue(undefined);
      mockUpdateFile.mockResolvedValue(0);

      const beforeDate = new Date();

      // Act
      await callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50);

      const afterDate = new Date();

      // Assert
      expect(invoiceTask.files[0].dataSend).toBeInstanceOf(Date);
      expect(invoiceTask.files[0].dataSend!.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
      expect(invoiceTask.files[0].dataSend!.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    });

    it('deve passar dataSend correta para updateFile', async () => {
      // Arrange
      const validFileResult = {
        valid: true,
        isNotaFiscal: true,
      };
      mockValidFile.mockReturnValue(validFileResult);
      mockUpload.mockResolvedValue(undefined);
      mockUpdateFile.mockResolvedValue(0);

      // Act
      await callPrivateMethod(invoiceTask, 'sendInvoicesFileToSittax', 0, 50);

      // Assert
      expect(mockUpdateFile).toHaveBeenCalledWith('/test/path/file.xml', {
        wasSend: true,
        dataSend: expect.any(Date),
      });
    });
  });
});
