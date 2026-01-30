import { Button } from '@components/ui/button';
import { useCallback } from 'react';
import { Play, Pause, Square, FolderOpen } from 'lucide-react';
import { useSocket } from '@hooks/socket';
import { useAppState } from '@hooks/state';
import { WSMessageType } from '../interfaces/ws-message';
import { ProcessamentoStatus } from '@/interfaces/processamento';
import { ActionType } from '@/hooks/state-reducer';
import { useToast } from '@/components/ui/use-toast';
import { ProgressCard } from '@/components/ui/progress-card';
import { cn } from '@/lib/utils';
import { IDirectory } from '@interfaces/directory';

export function Invoices() {
  const { client } = useSocket();
  const {
    state: { invoicesLog, directories },
    dispatch,
  } = useAppState();
  const { toast } = useToast();

  const invoiceDirectories = directories.filter(d => d.type === 'invoices');

  const hasDirectories = useCallback(() => {
    if (invoiceDirectories.length <= 0) {
      toast({
        title: 'Selecione um diretório',
        description: 'Escolha onde estão os arquivos que você quer enviar.',
        type: 'foreground',
      });
      return false;
    }
    return true;
  }, [invoiceDirectories.length, toast]);

  const handleSelectDirectories = async () => {
    const filepaths: IDirectory[] = await window.ipcRenderer.invoke('select-directories-invoices');
    if (filepaths) {
      dispatch({
        type: ActionType.Directories,
        payload: filepaths,
      });
    }
  };

  const handleStart = () => {
    if (!hasDirectories()) return;
    dispatch({ type: ActionType.ClearInvoicesLog });
    client?.send(
      JSON.stringify({
        type: 'message',
        message: { type: WSMessageType.StartUploadInvoices },
      })
    );
  };

  const handlePause = () => {
    client?.send(
      JSON.stringify({
        type: 'message',
        message: { type: WSMessageType.PauseUploadInvoices },
      })
    );
  };

  const handleResume = () => {
    client?.send(
      JSON.stringify({
        type: 'message',
        message: { type: WSMessageType.ResumeUploadInvoices },
      })
    );
  };

  const handleStop = () => {
    client?.send(
      JSON.stringify({
        type: 'message',
        message: { type: WSMessageType.StopUploadInvoices },
      })
    );
  };

  const isRunning = invoicesLog.status === ProcessamentoStatus.Running;
  const isPaused = invoicesLog.status === ProcessamentoStatus.Paused;
  const isStopped = invoicesLog.status === ProcessamentoStatus.Stopped;
  const isConcluded = invoicesLog.status === ProcessamentoStatus.Concluded;

  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-hidden">
      {/* Card de Progresso */}
      <ProgressCard
        progress={invoicesLog.progress}
        value={invoicesLog.value}
        max={invoicesLog.max}
        status={invoicesLog.status}
        message={invoicesLog.message}
        estimatedTimeRemaining={invoicesLog.estimatedTimeRemaining}
        speed={invoicesLog.speed}
        lastFileName={invoicesLog.lastFileName}
        className="transition-all duration-300"
      />

      {/* Botões de Controle */}
      <div className="flex gap-3">
        {(isStopped || isConcluded) && (
          <>
            <Button
              onClick={handleSelectDirectories}
              variant="outline"
              className={cn(
                'flex gap-2 transition-all duration-200',
                'hover:scale-105 active:scale-95'
              )}
            >
              <FolderOpen className="h-4 w-4" />
              Selecionar Diretórios
            </Button>
            <Button
              onClick={handleStart}
              className={cn(
                'flex gap-2 transition-all duration-200',
                'hover:scale-105 active:scale-95'
              )}
            >
              <Play className="h-4 w-4" />
              {isConcluded ? 'Enviar Novamente' : 'Enviar Notas'}
            </Button>
          </>
        )}

        {isRunning && (
          <Button
            onClick={handlePause}
            className={cn(
              'flex gap-2 transition-all duration-200',
              'hover:scale-105 active:scale-95'
            )}
          >
            <Pause className="h-4 w-4" />
            Enviando...
          </Button>
        )}

        {isPaused && (
          <>
            <Button
              onClick={handleResume}
              className={cn(
                'flex gap-2 transition-all duration-200',
                'hover:scale-105 active:scale-95'
              )}
            >
              <Play className="h-4 w-4" />
              Continuar
            </Button>
            <Button
              onClick={handleStop}
              variant="destructive"
              className={cn(
                'flex gap-2 transition-all duration-200',
                'hover:scale-105 active:scale-95'
              )}
            >
              <Square className="h-4 w-4" />
              Cancelar
            </Button>
          </>
        )}
      </div>

      {/* Dica quando não há diretórios */}
      {invoiceDirectories.length === 0 && (isStopped || isConcluded) && (
        <div className="text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-300">
          Selecione os diretórios onde estão os arquivos que você quer enviar.
        </div>
      )}
    </div>
  );
}
