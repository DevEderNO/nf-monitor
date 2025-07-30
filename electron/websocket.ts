import { WSMessage, WSMessageType, WSMessageTyped } from './interfaces/ws-message';
import * as http from 'http';
import { IUtf8Message, server as WebsocketServer, connection } from 'websocket';
import {
  pauseInvoiceProcess,
  resumeInvoiceProcess,
  startInvoiceProcess,
  stopInvoiceProcess,
} from './services/invoice-service';
import { pauseSieg, resumeSieg, startSieg, stopSieg } from './services/sieg-service';
import { parseISO } from 'date-fns';
import {
  pauseCertificateProcess,
  resumeCertificateProcess,
  startCertificateProcess,
  stopCertificateProcess,
} from './services/certificate-service';

let wsConnection: connection;

function createWebsocket() {
  const port = 4444;
  const server = http.createServer();
  server.listen(port, () => {
    console.log(`Data stream server started on port ${port}`);
  });
  const wss = new WebsocketServer({ httpServer: server });

  wss.on('request', request => {
    console.log(new Date().toLocaleDateString().concat(' Received a new connection from origin ', request.origin, '.'));

    wsConnection = request.accept(null, request.origin);

    wsConnection.on('message', message => {
      if (message.type === 'utf8') {
        const request: WSMessage = JSON.parse(message.utf8Data);
        switch (request.message.type) {
          case WSMessageType.StartUploadInvoices:
            wsStartUploadInvoices(wsConnection);
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

          case WSMessageType.StartSieg:
            wsStartSieg(wsConnection, message);
            break;
          case WSMessageType.PauseSieg:
            pauseSieg();
            break;
          case WSMessageType.ResumeSieg:
            resumeSieg();
            break;
          case WSMessageType.StopSieg:
            stopSieg();
            break;

          case WSMessageType.StartUploadCertificates:
            wsStartUploadCertificates(wsConnection);
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
          default:
            break;
        }
      }

      function wsStartUploadInvoices(connection: connection) {
        startInvoiceProcess(connection);
      }

      function wsStartUploadCertificates(connection: connection) {
        startCertificateProcess(connection);
      }

      function wsStartSieg(connection: connection, message: IUtf8Message) {
        const {
          message: {
            data: { dateInitial, dateEnd },
          },
        }: WSMessageTyped<{ dateInitial: string; dateEnd: string }> = JSON.parse(message.utf8Data);
        startSieg(connection, parseISO(dateInitial), parseISO(dateEnd));
      }
    });
  });
}

export { wsConnection, createWebsocket };
