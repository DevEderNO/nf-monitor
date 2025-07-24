import { Button } from '@components/ui/button';
import { useCallback, useEffect, useRef } from 'react';
import { Textarea } from '@components/ui/textarea';
import { Progress } from '@components/ui/progress';
import { Play, Pause } from 'lucide-react';
import { useSocket } from '@hooks/socket';
import { useAppState } from '@hooks/state';
import { WSMessageType } from '../interfaces/ws-message';
import { ProcessamentoStatus } from '@/interfaces/processamento';
import { StopIcon } from '@radix-ui/react-icons';
import { ActionType } from '@/hooks/state-reducer';
import { useToast } from '@/components/ui/use-toast';

interface IStepProcess {
  [key: string]: {
    label: string;
    icon: JSX.Element;
    onClick: () => void;
    onCancel?: () => void;
  };
}

export function Certificates() {
  const { client } = useSocket();
  const {
    state: { processamento, directories },
    dispatch,
  } = useAppState();
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [processamento]);

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
              type: WSMessageType.PauseProcess,
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
              type: WSMessageType.ResumeProcess,
            },
          })
        );
      },
      onCancel: () => {
        client?.send(
          JSON.stringify({
            type: 'message',
            message: {
              type: WSMessageType.StopProcess,
            },
          })
        );
      },
    },
    Stopped: {
      label: 'Enviar',
      icon: <Play />,
      onClick: () => {
        if (hasDerectories()) return;
        dispatch({ type: ActionType.ClearMessages });
        client?.send(
          JSON.stringify({
            type: 'message',
            message: {
              type: WSMessageType.StartProcess,
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
              type: WSMessageType.StartProcess,
            },
          })
        );
      },
    },
  };

  return (
    <div className="p-4 m-4 flex flex-col gap-4 border rounded-md flex-1">
      <div className="flex gap-3">
        <Button className="flex gap-1" onClick={send[processamento.status].onClick}>
          {send[processamento.status].icon}
          {send[processamento.status].label}
        </Button>
        {processamento.status === ProcessamentoStatus.Paused && (
          <Button className="flex gap-1" variant={'destructive'} onClick={send[processamento.status].onCancel}>
            <StopIcon />
            Parar
          </Button>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <Textarea
          ref={textareaRef}
          className="flex flex-1 h-full cursor-default resize-none"
          readOnly
          value={processamento?.messages.map(message => message).join('\n')}
        />
        <Progress value={processamento?.progress} />
        <span className="text-xs text-muted-foreground text-right">
          {processamento?.value} / {processamento?.max}
        </span>
      </div>
    </div>
  );
}
