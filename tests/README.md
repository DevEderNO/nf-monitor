# Testes Unitários - NF Monitor

Este diretório contém os testes unitários para o projeto NF Monitor.

## Estrutura

```
tests/
├── setup.ts                    # Configurações globais e mocks
├── classes/
│   └── invoice-task.test.ts    # Testes para a classe InvoiceTask
└── README.md                   # Este arquivo
```

## Como Executar os Testes

### Executar todos os testes
```bash
npm test
# ou
yarn test
```

### Executar testes em modo watch (desenvolvimento)
```bash
npm run test:watch
# ou
yarn test:watch
```

### Executar testes com cobertura
```bash
npm run test:coverage
# ou
yarn test:coverage
```

### Executar testes específicos
```bash
# Executar apenas testes da InvoiceTask
npm test -- --testNamePattern="InvoiceTask"

# Executar apenas testes do método processFileWithRetry
npm test -- --testNamePattern="processFileWithRetry"
```

## Testes Implementados

### InvoiceTask - processFileWithRetry

O método `processFileWithRetry` é responsável por processar arquivos com retry automático em caso de falha. Os testes cobrem:

#### Cenários de Sucesso
- ✅ Processamento de arquivo XML na primeira tentativa
- ✅ Processamento de arquivo PDF na primeira tentativa  
- ✅ Processamento de arquivo TXT na primeira tentativa
- ✅ Processamento de arquivo ZIP na primeira tentativa
- ✅ Retry com sucesso na segunda tentativa após falha inicial

#### Cenários de Falha
- ❌ Falha após número máximo de tentativas
- ❌ Tratamento de erros persistentes

#### Estados da Tarefa
- ⏸️ Parada quando tarefa está pausada
- 🛑 Parada quando tarefa está cancelada
- 🔄 Verificação de estado antes de cada tentativa

#### Configurações
- ⚙️ Configurações personalizadas de retry (maxRetries, retryDelay)
- 📝 Mensagens de retry e falha definitiva
- 🔤 Tratamento de extensões em maiúsculas/minúsculas

#### Extensões de Arquivo
- 📄 Arquivos XML, PDF, TXT (processados por `sendInvoicesFileToSittax`)
- 📦 Arquivos ZIP (processados por `extractAndProcessZip`)
- ❓ Arquivos com extensão desconhecida (processados como sucesso)

## Mocks Utilizados

Os testes utilizam mocks para isolar a funcionalidade testada:

- **WebSocket Connection**: Mock da conexão para verificar mensagens enviadas
- **File Operations**: Mock das operações de arquivo para evitar I/O real
- **Database Operations**: Mock das operações de banco de dados
- **HTTP Requests**: Mock das requisições HTTP (axios)
- **Time Utils**: Mock das funções de tempo para testes mais rápidos

## Padrões de Teste

Os testes seguem o padrão **Arrange-Act-Assert**:

```typescript
it('deve processar arquivo XML com sucesso na primeira tentativa', async () => {
  // Arrange - Preparar dados e mocks
  const xmlFile = { ...mockFileInfo, extension: '.xml' };
  invoiceTask.files[0] = xmlFile;
  mockSendInvoicesFileToSittax.mockResolvedValue(true);

  // Act - Executar a ação testada
  await invoiceTask.processFileWithRetry(0, 50);

  // Assert - Verificar resultados
  expect(mockSendInvoicesFileToSittax).toHaveBeenCalledTimes(1);
  expect(mockSendInvoicesFileToSittax).toHaveBeenCalledWith(0, 50);
});
```

## Próximos Passos

Para expandir a cobertura de testes, considere adicionar testes para:

1. **Outros métodos da InvoiceTask**:
   - `authenticate()`
   - `sendInvoicesFileToSittax()`
   - `extractAndProcessZip()`
   - `run()`

2. **Outras classes**:
   - `CertificateTask`
   - `SiegTask`

3. **Serviços**:
   - `FileOperationService`
   - `DatabaseService`
   - `HealthBrokerService`

4. **Utilitários**:
   - `TimeUtils`
   - `CryptographyUtils`
   - `NfseUtils`
