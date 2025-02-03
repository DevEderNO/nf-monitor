import { createContext, useContext, useEffect, useState } from "react";
import { useAppState } from "./state";
import { w3cwebsocket } from "websocket";
import {
  WSMessage,
  WSMessageType,
  WSMessageTyped,
} from "@interfaces/ws-message";
import { ActionType } from "./state-reducer";
import { IProcessamento, ProcessamentoStatus } from "@interfaces/processamento";
import { format } from "date-fns";
import { IDbHistoric } from "@/interfaces/db-historic";

interface SocketContextData {
  client: w3cwebsocket | undefined;
  processTask: "discovery" | "send";
}

export const SocketContext = createContext<SocketContextData>(
  {} as SocketContextData
);

const SocketProvider = ({ children }: React.PropsWithChildren) => {
  const { dispatch } = useAppState();
  const [client, setClient] = useState<w3cwebsocket>();
  const [processTask, setProcessStatus] = useState<"discovery" | "send">(
    "discovery"
  );
  const [, setIsConnected] = useState(false);

  useEffect(() => {
    if (!client) return;
    client.onmessage = (message) => {
      if (typeof message.data === "string") {
        const response: WSMessage = JSON.parse(message.data);
        if (response.message.type === WSMessageType.Discovery) {
          setProcessStatus("discovery");
          const {
            message: {
              data: { messages, progress, status, id },
            },
          }: WSMessageTyped<IProcessamento> = JSON.parse(message.data);
          if (ProcessamentoStatus.Concluded === status) {
            const request: WSMessageTyped<IProcessamento> = {
              type: "message",
              message: {
                type: WSMessageType.StartProcess,
                data: { id } as IProcessamento,
              },
            };
            client?.send(JSON.stringify(request));
          }
          dispatch({
            type: ActionType.Processamento,
            payload: {
              messages,
              progress,
              status,
            },
          });
        }
        if (response.message.type === WSMessageType.Process) {
          setProcessStatus("send");
          const {
            message: {
              data: { messages, progress, status },
            },
          }: WSMessageTyped<IProcessamento> = JSON.parse(message.data);
          if (
            [
              ProcessamentoStatus.Concluded,
              ProcessamentoStatus.Stopped,
            ].includes(status)
          ) {
            setProcessStatus("discovery");
            window.ipcRenderer
              .invoke("get-historic")
              .then((historic: IDbHistoric[]) => {
                if (historic.length > 0) {
                  dispatch({
                    type: ActionType.Historic,
                    payload: historic.map(
                      (x) =>
                        `${format(x.startDate, "dd/MM/yyyy HH:mm:ss")}${
                          x.endDate
                            ? format(x.endDate, " - dd/MM/yyyy HH:mm:ss")
                            : " - Não finalizado ou interrompido"
                        }`
                    ),
                  });
                }
              });
          }
          dispatch({
            type: ActionType.Processamento,
            payload: {
              messages,
              progress,
              status,
            },
          });
        }
        if (response.message.type === WSMessageType.Sieg) {
          const {
            message: {
              data: { messages, progress, status },
            },
          }: WSMessageTyped<IProcessamento> = JSON.parse(message.data);
          dispatch({
            type: ActionType.ProcessamentoSieg,
            payload: {
              messages,
              progress,
              status,
            },
          });
        }
      }
    };
  }, [client, dispatch]);

  useEffect(() => {
    const connectWebSocket = () => {
      const cli = new w3cwebsocket("ws://127.0.0.1:4444");

      cli.onopen = () => {
        setIsConnected(true);
        console.log("Conectado ao WebSocket");
      };

      cli.onclose = () => {
        setIsConnected(false);
        console.log("Conexão perdida. Tentando reconectar...");
        // Tenta reconectar após 3 segundos
        setTimeout(connectWebSocket, 3000);
      };

      cli.onerror = (error) => {
        setIsConnected(false);
        console.error("Erro na conexão WebSocket", error);
        connectWebSocket();
      };

      setClient(cli);
    };

    // Inicia a conexão WebSocket
    connectWebSocket();

    return () => {
      if (client) {
        client.close();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ client, processTask }}>
      {children}
    </SocketContext.Provider>
  );
};

function useSocket() {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error("useSocket must be used within an SocketProvider");
  }

  return context;
}

export { useSocket, SocketProvider };
