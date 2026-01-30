import { WSMessage, WSMessageType } from './interfaces/ws-message';
import * as http from 'http';
import { server as WebsocketServer, connection } from 'websocket';
import {
  pauseInvoiceProcess,
  resumeInvoiceProcess,
  startInvoiceProcess,
  stopInvoiceProcess,
} from './services/invoice-service';
import {
  pauseCertificateProcess,
  resumeCertificateProcess,
  startCertificateProcess,
  stopCertificateProcess,
} from './services/certificate-service';

let wsConnection: connection | null = null;

function createWebsocket() {
  const port = 4444;
  const server = http.createServer();
  server.listen(port);
  const wss = new WebsocketServer({ httpServer: server });

  wss.on('request', request => {
    wsConnection = request.accept(null, request.origin);

    wsConnection.on('message', message => {
      if (message.type === 'utf8' && wsConnection) {
        const request: WSMessage = JSON.parse(message.utf8Data);

        switch (request.message.type) {
          // Invoices
          case WSMessageType.StartUploadInvoices:
            startInvoiceProcess(wsConnection);
            break;
          case WSMessageType.PauseUploadInvoices:
            pauseInvoiceProcess();
            break;
          case WSMessageType.ResumeUploadInvoices:
            resumeInvoiceProcess();
            break;
          case WSMessageType.StopUploadInvoices:
            stopInvoiceProcess();
            break;

          // Certificates
          case WSMessageType.StartUploadCertificates:
            startCertificateProcess(wsConnection);
            break;
          case WSMessageType.PauseUploadCertificates:
            pauseCertificateProcess();
            break;
          case WSMessageType.ResumeUploadCertificates:
            resumeCertificateProcess();
            break;
          case WSMessageType.StopUploadCertificates:
            stopCertificateProcess();
            break;
        }
      }
    });

    wsConnection.on('close', () => {
      wsConnection = null;
    });
  });
}

export { wsConnection, createWebsocket };
