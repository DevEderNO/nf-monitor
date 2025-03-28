import {
  WSMessage,
  WSMessageType,
  WSMessageTyped,
} from "./interfaces/ws-message";
import * as http from "http";
import { IUtf8Message, server as WebsocketServer, connection } from "websocket";
import {
  pauseProcess,
  resumeProcess,
  startProcess,
  stopProcess,
} from "./services/process-service";
import {
  pauseSieg,
  resumeSieg,
  startSieg,
  stopSieg,
} from "./services/sieg-service";
import { parseISO } from "date-fns";

let wsConnection: connection;

function createWebsocket() {
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

    wsConnection = request.accept(null, request.origin);

    wsConnection.on("message", (message) => {
      if (message.type === "utf8") {
        const request: WSMessage = JSON.parse(message.utf8Data);
        switch (request.message.type) {
          case WSMessageType.StartProcess:
            wsStartProcess(wsConnection);
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
          default:
            break;
        }
      }

      function wsStartProcess(connection: connection) {
        startProcess(connection);
      }

      function wsStartSieg(connection: connection, message: IUtf8Message) {
        const {
          message: {
            data: { dateInitial, dateEnd },
          },
        }: WSMessageTyped<{ dateInitial: string; dateEnd: string }> =
          JSON.parse(message.utf8Data);
        startSieg(connection, parseISO(dateInitial), parseISO(dateEnd));
      }
    });
  });
}

export { wsConnection, createWebsocket };
