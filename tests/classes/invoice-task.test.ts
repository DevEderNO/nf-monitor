import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { IFileInfo } from '../../electron/interfaces/file-info';
import { InvoiceTask } from '../../electron/classes/invoice-task';
import { connection } from 'websocket';

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

describe('InvoiceTask - processFileWithRetry', () => {
  let invoiceTask: InvoiceTask;
  let mockSendInvoicesFileToSittax: jest.MockedFunction<any>;
  let mockExtractAndProcessZip: jest.MockedFunction<any>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Criar instância da classe
    invoiceTask = new InvoiceTask();
    invoiceTask.connection = mockConnection;
    invoiceTask.files = [mockFileInfo];
    invoiceTask.max = 1;
    invoiceTask.maxRetries = 3;
    invoiceTask.retryDelay = 100; // Reduzir delay para testes mais rápidos

    // Mock dos métodos privados
    mockSendInvoicesFileToSittax = jest.fn();
    mockExtractAndProcessZip = jest.fn();

    // Substituir métodos privados usando prototype
    (invoiceTask as any).sendInvoicesFileToSittax = mockSendInvoicesFileToSittax;
    (invoiceTask as any).extractAndProcessZip = mockExtractAndProcessZip;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('processFileWithRetry - Arquivo XML', () => {
    it('deve processar arquivo XML com sucesso na primeira tentativa', async () => {
      // Arrange
      const xmlFile = { ...mockFileInfo, extension: '.xml' };
      invoiceTask.files[0] = xmlFile;
      mockSendInvoicesFileToSittax.mockResolvedValue(true);

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockSendInvoicesFileToSittax).toHaveBeenCalledTimes(1);
      expect(mockSendInvoicesFileToSittax).toHaveBeenCalledWith(0, 50);
      expect(mockExtractAndProcessZip).not.toHaveBeenCalled();
    });

    it('deve processar arquivo PDF com sucesso na primeira tentativa', async () => {
      // Arrange
      const pdfFile = { ...mockFileInfo, extension: '.pdf' };
      invoiceTask.files[0] = pdfFile;
      mockSendInvoicesFileToSittax.mockResolvedValue(true);

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockSendInvoicesFileToSittax).toHaveBeenCalledTimes(1);
      expect(mockSendInvoicesFileToSittax).toHaveBeenCalledWith(0, 50);
    });

    it('deve processar arquivo TXT com sucesso na primeira tentativa', async () => {
      // Arrange
      const txtFile = { ...mockFileInfo, extension: '.txt' };
      invoiceTask.files[0] = txtFile;
      mockSendInvoicesFileToSittax.mockResolvedValue(true);

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockSendInvoicesFileToSittax).toHaveBeenCalledTimes(1);
      expect(mockSendInvoicesFileToSittax).toHaveBeenCalledWith(0, 50);
    });

    it('deve processar arquivo ZIP com sucesso na primeira tentativa', async () => {
      // Arrange
      const zipFile = { ...mockFileInfo, extension: '.zip' };
      invoiceTask.files[0] = zipFile;
      mockExtractAndProcessZip.mockResolvedValue(true);

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockExtractAndProcessZip).toHaveBeenCalledTimes(1);
      expect(mockExtractAndProcessZip).toHaveBeenCalledWith(0, 50);
      expect(mockSendInvoicesFileToSittax).not.toHaveBeenCalled();
    });

    it('deve retryar quando falhar na primeira tentativa e ter sucesso na segunda', async () => {
      // Arrange
      const xmlFile = { ...mockFileInfo, extension: '.xml' };
      invoiceTask.files[0] = xmlFile;
      mockSendInvoicesFileToSittax.mockRejectedValueOnce(new Error('Erro temporário')).mockResolvedValueOnce(true);

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockSendInvoicesFileToSittax).toHaveBeenCalledTimes(2);
      expect(mockSendInvoicesFileToSittax).toHaveBeenCalledWith(0, 50);
      expect(invoiceTask.hasError).toBe(false);
    });

    it('deve falhar após o número máximo de tentativas', async () => {
      // Arrange
      const xmlFile = { ...mockFileInfo, extension: '.xml' };
      invoiceTask.files[0] = xmlFile;
      const error = new Error('Erro persistente');
      mockSendInvoicesFileToSittax.mockRejectedValue(error);

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockSendInvoicesFileToSittax).toHaveBeenCalledTimes(3);
      expect(invoiceTask.hasError).toBe(true);
    });

    it('deve parar o processamento quando a tarefa for cancelada', async () => {
      // Arrange
      const xmlFile = { ...mockFileInfo, extension: '.xml' };
      invoiceTask.files[0] = xmlFile;
      invoiceTask.isCancelled = true;
      mockSendInvoicesFileToSittax.mockResolvedValue(true);

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockSendInvoicesFileToSittax).not.toHaveBeenCalled();
    });

    it('deve parar o processamento quando a tarefa for pausada', async () => {
      // Arrange
      const xmlFile = { ...mockFileInfo, extension: '.xml' };
      invoiceTask.files[0] = xmlFile;
      invoiceTask.isPaused = true;
      mockSendInvoicesFileToSittax.mockResolvedValue(true);

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockSendInvoicesFileToSittax).not.toHaveBeenCalled();
    });

    it('deve processar arquivo com extensão desconhecida como sucesso', async () => {
      // Arrange
      const unknownFile = { ...mockFileInfo, extension: '.unknown' };
      invoiceTask.files[0] = unknownFile;

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockSendInvoicesFileToSittax).not.toHaveBeenCalled();
      expect(mockExtractAndProcessZip).not.toHaveBeenCalled();
    });

    it('deve enviar mensagem de retry quando houver múltiplas tentativas', async () => {
      // Arrange
      const xmlFile = { ...mockFileInfo, extension: '.xml' };
      invoiceTask.files[0] = xmlFile;
      mockSendInvoicesFileToSittax.mockRejectedValueOnce(new Error('Erro temporário')).mockResolvedValueOnce(true);

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockConnection.sendUTF).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Tentativa 2/3 para /test/path/file.xml')
      );
    });

    it('deve enviar mensagem de falha definitiva após todas as tentativas', async () => {
      // Arrange
      const xmlFile = { ...mockFileInfo, extension: '.xml' };
      invoiceTask.files[0] = xmlFile;
      const error = new Error('Erro persistente');
      mockSendInvoicesFileToSittax.mockRejectedValue(error);

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockConnection.sendUTF).toHaveBeenCalledWith(
        expect.stringContaining('❌ Falha definitiva após 3 tentativas: /test/path/file.xml')
      );
    });

    it('deve lidar com extensões em maiúsculas', async () => {
      // Arrange
      const xmlFile = { ...mockFileInfo, extension: '.XML' };
      invoiceTask.files[0] = xmlFile;
      mockSendInvoicesFileToSittax.mockResolvedValue(true);

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockSendInvoicesFileToSittax).toHaveBeenCalledTimes(1);
    });

    it('deve lidar com extensões ZIP em maiúsculas', async () => {
      // Arrange
      const zipFile = { ...mockFileInfo, extension: '.ZIP' };
      invoiceTask.files[0] = zipFile;
      mockExtractAndProcessZip.mockResolvedValue(true);

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockExtractAndProcessZip).toHaveBeenCalledTimes(1);
    });
  });

  describe('processFileWithRetry - Configurações de retry', () => {
    it('deve usar configurações personalizadas de retry', async () => {
      // Arrange
      invoiceTask.maxRetries = 5;
      invoiceTask.retryDelay = 500;
      const xmlFile = { ...mockFileInfo, extension: '.xml' };
      invoiceTask.files[0] = xmlFile;
      mockSendInvoicesFileToSittax
        .mockRejectedValueOnce(new Error('Erro 1'))
        .mockRejectedValueOnce(new Error('Erro 2'))
        .mockRejectedValueOnce(new Error('Erro 3'))
        .mockRejectedValueOnce(new Error('Erro 4'))
        .mockResolvedValueOnce(true);

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockSendInvoicesFileToSittax).toHaveBeenCalledTimes(5);
    });

    it('deve falhar após o número máximo de tentativas personalizado', async () => {
      // Arrange
      invoiceTask.maxRetries = 2;
      const xmlFile = { ...mockFileInfo, extension: '.xml' };
      invoiceTask.files[0] = xmlFile;
      const error = new Error('Erro persistente');
      mockSendInvoicesFileToSittax.mockRejectedValue(error);

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockSendInvoicesFileToSittax).toHaveBeenCalledTimes(2);
      expect(invoiceTask.hasError).toBe(true);
    });
  });

  describe('processFileWithRetry - Estados da tarefa', () => {
    it('deve verificar se está pausado antes de cada tentativa', async () => {
      // Arrange
      const xmlFile = { ...mockFileInfo, extension: '.xml' };
      invoiceTask.files[0] = xmlFile;
      mockSendInvoicesFileToSittax
        .mockImplementationOnce(() => {
          invoiceTask.isPaused = true;
          throw new Error('Erro');
        })
        .mockResolvedValueOnce(true);

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockSendInvoicesFileToSittax).toHaveBeenCalledTimes(1);
    });

    it('deve verificar se está cancelado antes de cada tentativa', async () => {
      // Arrange
      const xmlFile = { ...mockFileInfo, extension: '.xml' };
      invoiceTask.files[0] = xmlFile;
      mockSendInvoicesFileToSittax
        .mockImplementationOnce(() => {
          invoiceTask.isCancelled = true;
          throw new Error('Erro');
        })
        .mockResolvedValueOnce(true);

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockSendInvoicesFileToSittax).toHaveBeenCalledTimes(1);
    });
  });

  describe('processFileWithRetry - Deve Evitar RangeError: Maximum call stack size exceeded', () => {
    it('deve evitar RangeError: Maximum call stack size exceeded', async () => {
      // Arrange
      const xmlFile = { ...mockFileInfo, extension: '.xml' };
      invoiceTask.files[0] = xmlFile;
      mockSendInvoicesFileToSittax.mockRejectedValue(new Error('RangeError: Maximum call stack size exceeded'));

      // Act
      await invoiceTask.processFileWithRetry(0, 50);

      // Assert
      expect(mockSendInvoicesFileToSittax).toHaveBeenCalledTimes(3); // maxRetries = 3
      expect(invoiceTask.hasError).toBe(true);
    });
  });
});
