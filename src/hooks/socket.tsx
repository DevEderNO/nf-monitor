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
import { format, parseISO } from "date-fns";
import { IExecution } from "@/interfaces/db-historic";

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

  useEffect(() => {
    if (client?._connection?.connected) return;
    const cli = new w3cwebsocket("ws://127.0.0.1:4444");
    cli.onopen = () => {
      console.log("WebSocket client connected");
    };
    cli.onmessage = (message) => {
      if (typeof message.data === "string") {
        const response: WSMessage = JSON.parse(message.data);
        if (response.message.type === WSMessageType.Discovery) {
          setProcessStatus("discovery");
          const {
            message: {
              data: { messages, progress, status, id },
            },
          }: WSMessageTyped<IProcessamento> = JSON.parse(message.data);
          dispatch({
            type: ActionType.Processamento,
            payload: {
              messages,
              progress,
              status,
            },
          });
          if (status === ProcessamentoStatus.Concluded) {
            const request: WSMessageTyped<IProcessamento> = {
              type: "message",
              message: {
                type: WSMessageType.StartProcess,
                data: { id } as IProcessamento,
              },
            };
            cli?.send(JSON.stringify(request));
          }
        }
        if (response.message.type === WSMessageType.Process) {
          setProcessStatus("send");
          const {
            message: {
              data: { messages, progress, status },
            },
          }: WSMessageTyped<IProcessamento> = JSON.parse(message.data);
          dispatch({
            type: ActionType.Processamento,
            payload: {
              messages,
              progress,
              status,
            },
          });
          if (status === ProcessamentoStatus.Concluded) {
            window.ipcRenderer
              .invoke("get-historic")
              .then((historic: IExecution[]) => {
                if (historic.length > 0) {
                  dispatch({
                    type: ActionType.Historic,
                    payload: historic.map(
                      (x) =>
                        `${format(
                          parseISO(x.startDate.toString()),
                          "dd/MM/yyyy HH:mm:ss"
                        )}${
                          x.endDate
                            ? format(
                                parseISO(x.endDate.toString()),
                                " - dd/MM/yyyy HH:mm:ss"
                              )
                            : ""
                        }`
                    ),
                  });
                }
              });
          }
        }
      }
    };
    setClient(cli);
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
