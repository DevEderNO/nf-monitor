import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAppState } from './state';
import { w3cwebsocket } from 'websocket';
import { WSMessageType, WSMessageTyped } from '@interfaces/ws-message';
import { ActionType } from './state-reducer';
import { IProcessamento, ProcessamentoStatus } from '@interfaces/processamento';
import { format } from 'date-fns';
import { IDbHistoric } from '@/interfaces/db-historic';

interface SocketContextData {
  client: w3cwebsocket | undefined;
}

export const SocketContext = createContext<SocketContextData>({} as SocketContextData);

// Função auxiliar para formatar histórico
const formatHistoric = (x: IDbHistoric) => {
  const startFormatted = format(x.startDate, 'dd/MM/yyyy HH:mm:ss');
  const endFormatted = x.endDate ? format(x.endDate, 'HH:mm:ss') : null;

  let duration = '';
  if (x.endDate) {
    const diffMs = new Date(x.endDate).getTime() - new Date(x.startDate).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSecs / 3600);
    const minutes = Math.floor((diffSecs % 3600) / 60);
    const seconds = diffSecs % 60;
    if (hours > 0) {
      duration = `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      duration = `${minutes}m ${seconds}s`;
    } else {
      duration = `${seconds}s`;
    }
  }

  const status = x.endDate ? '✓' : '⏸';
  const filesInfo = x.filesSent > 0 ? `${x.filesSent} arquivo(s)` : 'Nenhum arquivo';
  const durationInfo = duration ? ` | Duração: ${duration}` : '';
  const endInfo = endFormatted ? ` → ${endFormatted}` : '';

  return `${status} ${startFormatted}${endInfo} | ${filesInfo}${durationInfo}`;
};

const SocketProvider = ({ children }: React.PropsWithChildren) => {
  const { dispatch } = useAppState();
  const [client, setClient] = useState<w3cwebsocket>();

  // Handler genérico para mensagens de processamento
  const handleProcessamentoMessage = useCallback(
    (actionType: ActionType.InvoicesLog | ActionType.CertificatesLog, data: IProcessamento) => {
      if ([ProcessamentoStatus.Concluded, ProcessamentoStatus.Stopped].includes(data.status)) {
        window.ipcRenderer.invoke('get-historic').then((historic: IDbHistoric[]) => {
          if (historic.length > 0) {
            dispatch({
              type: ActionType.Historic,
              payload: historic.map(formatHistoric),
            });
          }
        });
      }
      dispatch({
        type: actionType,
        payload: data,
      });
    },
    [dispatch]
  );

  useEffect(() => {
    if (!client) return;
    client.onmessage = message => {
      if (typeof message.data === 'string') {
        const response: WSMessageTyped<IProcessamento> = JSON.parse(message.data);

        if (response.message.type === WSMessageType.Invoice) {
          handleProcessamentoMessage(ActionType.InvoicesLog, response.message.data);
        }

        if (response.message.type === WSMessageType.Certificates) {
          handleProcessamentoMessage(ActionType.CertificatesLog, response.message.data);
        }
      }
    };
  }, [client, handleProcessamentoMessage]);

  const connectWebSocket = useCallback(() => {
    const cli = new w3cwebsocket('ws://127.0.0.1:4444');

    cli.onopen = () => {
      // Conectado
    };

    cli.onclose = () => {
      setTimeout(connectWebSocket, 3000);
    };

    cli.onerror = () => {
      setTimeout(connectWebSocket, 3000);
    };

    setClient(cli);
  }, []);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (client) {
        client.close();
      }
    };
  }, []);

  return <SocketContext.Provider value={{ client }}>{children}</SocketContext.Provider>;
};

function useSocket() {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error('useSocket must be used within an SocketProvider');
  }

  return context;
}

export { useSocket, SocketProvider };
