import {
  WSMessage,
  WSMessageType,
  WSMessageTyped,
} from "../interfaces/ws-message";
import * as http from "http";
import { IUtf8Message, server as WebsocketServer, connection } from "websocket";
import {
  pauseProcess,
  resumeProcess,
  startProcess,
  stopProcess,
} from "./process-service";
import {
  pauseDiscovery,
  resumeDiscovery,
  startDiscovery,
  stopDiscovery,
} from "./discovery-service";
import { IProcessamento } from "electron/interfaces/processamento";

export function createWebsocket() {
  const port = 4444;
  const server = http.createServer();
  server.listen(port, () => {
    console.log(`Data stream server started on port ${port}`);
  });
  const wss = new WebsocketServer({ httpServer: server });

  wss.on("request", (request) => {
    console.log(
      new Date()
        .toLocaleDateString()
        .concat(" Received a new connection from origin ", request.origin, ".")
    );
    const connection = request.accept(null, request.origin);
    console.log("connected");

    connection.on("message", (message) => {
      if (message.type === "utf8") {
        const request: WSMessage = JSON.parse(message.utf8Data);
        switch (request.message.type) {
          case WSMessageType.StartDiscovery:
            startDiscovery(connection);
            break;
          case WSMessageType.PauseDiscovery:
            pauseDiscovery();
            break;
          case WSMessageType.ResumeDiscovery:
            resumeDiscovery();
            break;
          case WSMessageType.StopDiscovery:
            stopDiscovery();
            break;
          case WSMessageType.StartProcess:
            wsStartProcess(connection, message);
            break;
          case WSMessageType.PauseProcess:
            pauseProcess();
            break;
          case WSMessageType.ResumeProcess:
            resumeProcess();
            break;
          case WSMessageType.StopProcess:
            stopProcess();
            break;
          default:
            break;
        }
      }

      function wsStartProcess(connection: connection, message: IUtf8Message) {
        const {
          message: {
            data: { id },
          },
        }: WSMessageTyped<IProcessamento> = JSON.parse(message.utf8Data);
        startProcess(connection, id!);
      }
    });
  });
}
