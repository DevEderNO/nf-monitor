import { Button } from '@components/ui/button';
import { useCallback, useEffect, useState } from 'react';
import { Progress } from '@components/ui/progress';
import { Play, Pause } from 'lucide-react';
import { useSocket } from '@hooks/socket';
import { useAppState } from '@hooks/state';
import { WSMessageType } from '../interfaces/ws-message';
import { ProcessamentoStatus } from '@/interfaces/processamento';
import { StopIcon } from '@radix-ui/react-icons';
import { ActionType } from '@/hooks/state-reducer';
import { useToast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';

interface IStepProcess {
  [key: string]: {
    label: string;
    icon: JSX.Element;
    onClick: () => void;
    onCancel?: () => void;
  };
}

export function Invoices() {
  const { client } = useSocket();
  const {
    state: { invoicesLog, directories },
    dispatch,
  } = useAppState();
  const { toast } = useToast();
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    if (invoicesLog.message.length === 0) return;
    setMessages(prev => [invoicesLog.message, ...prev]);
  }, [invoicesLog.message]);

  const hasDerectories = useCallback(() => {
    if (directories.length <= 0) {
      const messages = [
        '😊 Beleza! Só precisa selecionar onde estão os arquivos, tudo certo?',
        '🤔 Poxa, precisamos que você escolha o diretório onde estão os arquivos que precisamos encontrar.',
        '😌🔍 Vamos nessa! Escolha o diretório onde estão os arquivos que precisamos achar.',
      ];
      toast({
        title: messages[Math.floor(Math.random() * 3)],
        description: '',
        type: 'foreground',
      });
      return true;
    }
    return false;
  }, [directories.length, toast]);

  const send: IStepProcess = {
    Running: {
      label: 'Enviando...',
      icon: <Pause />,
      onClick: () => {
        client?.send(
          JSON.stringify({
            type: 'message',
            message: {
              type: WSMessageType.PauseUploadInvoices,
            },
          })
        );
      },
    },
    Paused: {
      label: 'Continuar',
      icon: <Play />,
      onClick: () => {
        client?.send(
          JSON.stringify({
            type: 'message',
            message: {
              type: WSMessageType.ResumeUploadInvoices,
            },
          })
        );
      },
      onCancel: () => {
        client?.send(
          JSON.stringify({
            type: 'message',
            message: {
              type: WSMessageType.StopUploadInvoices,
            },
          })
        );
      },
    },
    Stopped: {
      label: 'Enviar Notas',
      icon: <Play />,
      onClick: () => {
        if (hasDerectories()) return;
        dispatch({ type: ActionType.ClearInvoicesLog });
        client?.send(
          JSON.stringify({
            type: 'message',
            message: {
              type: WSMessageType.StartUploadInvoices,
            },
          })
        );
      },
    },
    Concluded: {
      label: 'Re-enviar',
      icon: <Play />,
      onClick: () => {
        if (hasDerectories()) return;
        client?.send(
          JSON.stringify({
            type: 'message',
            message: {
              type: WSMessageType.StartUploadInvoices,
            },
          })
        );
      },
    },
  };

  return (
    <div className="p-4 flex flex-col gap-4 border rounded-md h-full overflow-hidden">
      <div className="flex gap-3">
        <Button className="flex gap-1" onClick={send[invoicesLog.status].onClick}>
          {send[invoicesLog.status].icon}
          {send[invoicesLog.status].label}
        </Button>
        {invoicesLog.status === ProcessamentoStatus.Paused && (
          <Button className="flex gap-1" variant={'destructive'} onClick={send[invoicesLog.status].onCancel}>
            <StopIcon />
            Parar
          </Button>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 min-h-0 overflow-hidden">
        <Textarea className="flex flex-1 h-full cursor-default resize-none" readOnly value={messages.join('\n')} />
        <Progress value={invoicesLog?.progress} />
        <span className="text-xs text-muted-foreground text-right">
          {invoicesLog?.value} / {invoicesLog?.max}
        </span>
      </div>
    </div>
  );
}
