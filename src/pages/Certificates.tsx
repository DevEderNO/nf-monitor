import { Button } from '@components/ui/button';
import { useCallback } from 'react';
import { Play, Pause, Square, FolderOpen } from 'lucide-react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { TrashIcon } from '@radix-ui/react-icons';
import { useSocket } from '@hooks/socket';
import { useAppState } from '@hooks/state';
import { WSMessageType } from '../interfaces/ws-message';
import { ProcessamentoStatus } from '@/interfaces/processamento';
import { ActionType } from '@/hooks/state-reducer';
import { useToast } from '@/components/ui/use-toast';
import { ProgressCard } from '@/components/ui/progress-card';
import { cn } from '@/lib/utils';
import { IDirectory } from '@interfaces/directory';

export function Certificates() {
  const { client } = useSocket();
  const {
    state: { certificatesLog, directories },
    dispatch,
  } = useAppState();
  const { toast } = useToast();

  const certificateDirectories = directories.filter(d => d.type === 'certificates');

  const hasDirectories = useCallback(() => {
    if (certificateDirectories.length <= 0) {
      toast({
        title: 'Selecione um diretório',
        description: 'Escolha onde estão os documentos que você quer enviar.',
        type: 'foreground',
      });
      return false;
    }
    return true;
  }, [certificateDirectories.length, toast]);

  const handleSelectDirectories = async () => {
    const filepaths: IDirectory[] = await window.ipcRenderer.invoke('select-directories-certificates');
    if (filepaths) {
      dispatch({
        type: ActionType.Directories,
        payload: filepaths,
      });
    }
  };

  const handleRemoveCertificatesDirectory = async (item: string) => {
    const directories = await window.ipcRenderer.invoke('remove-directory', item, 'certificates');
    dispatch({
      type: ActionType.Directories,
      payload: directories,
    });
  };

  const handleStart = () => {
    if (!hasDirectories()) return;
    dispatch({ type: ActionType.ClearCertificatesLog });
    client?.send(
      JSON.stringify({
        type: 'message',
        message: { type: WSMessageType.StartUploadCertificates },
      })
    );
  };

  const handlePause = () => {
    client?.send(
      JSON.stringify({
        type: 'message',
        message: { type: WSMessageType.PauseUploadCertificates },
      })
    );
  };

  const handleResume = () => {
    client?.send(
      JSON.stringify({
        type: 'message',
        message: { type: WSMessageType.ResumeUploadCertificates },
      })
    );
  };

  const handleStop = () => {
    client?.send(
      JSON.stringify({
        type: 'message',
        message: { type: WSMessageType.StopUploadCertificates },
      })
    );
  };

  const isRunning = certificatesLog.status === ProcessamentoStatus.Running;
  const isPaused = certificatesLog.status === ProcessamentoStatus.Paused;
  const isStopped = certificatesLog.status === ProcessamentoStatus.Stopped;
  const isConcluded = certificatesLog.status === ProcessamentoStatus.Concluded;

  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-hidden">
      {/* Card de Progresso */}
      <ProgressCard
        progress={certificatesLog.progress}
        value={certificatesLog.value}
        max={certificatesLog.max}
        status={certificatesLog.status}
        message={certificatesLog.message}
        estimatedTimeRemaining={certificatesLog.estimatedTimeRemaining}
        speed={certificatesLog.speed}
        lastFileName={certificatesLog.lastFileName}
        className="transition-all duration-300"
      />

      {/* Botões de Controle */}
      <div className="flex gap-3">
        {(isStopped || isConcluded) && (
          <>
            <Button
              onClick={handleSelectDirectories}
              variant="outline"
              className={cn('flex gap-2 transition-all duration-200', 'hover:scale-105 active:scale-95')}
            >
              <FolderOpen className="h-4 w-4" />
              Selecionar Diretórios
            </Button>
            <Button
              onClick={handleStart}
              className={cn('flex gap-2 transition-all duration-200', 'hover:scale-105 active:scale-95')}
            >
              <Play className="h-4 w-4" />
              {isConcluded ? 'Enviar Novamente' : 'Enviar Documentos'}
            </Button>
          </>
        )}

        {isRunning && (
          <Button
            onClick={handlePause}
            className={cn('flex gap-2 transition-all duration-200', 'hover:scale-105 active:scale-95')}
          >
            <Pause className="h-4 w-4" />
            Enviando...
          </Button>
        )}

        {isPaused && (
          <>
            <Button
              onClick={handleResume}
              className={cn('flex gap-2 transition-all duration-200', 'hover:scale-105 active:scale-95')}
            >
              <Play className="h-4 w-4" />
              Continuar
            </Button>
            <Button
              onClick={handleStop}
              variant="destructive"
              className={cn('flex gap-2 transition-all duration-200', 'hover:scale-105 active:scale-95')}
            >
              <Square className="h-4 w-4" />
              Cancelar
            </Button>
          </>
        )}
      </div>

      {/* Dica quando não há diretórios */}
      {certificateDirectories.length === 0 && (isStopped || isConcluded) && (
        <div className="text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-300">
          Selecione os diretórios onde estão os documentos que você quer enviar.
        </div>
      )}

      <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 190px)' }}>
        <Table className="overflow-auto">
          <TableCaption>Lista dos diretórios para envio de documentos de cadastro</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Diretório</TableHead>
              <TableHead>Modificação</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {directories.length > 0 &&
              directories
                ?.filter(item => item.type === 'certificates')
                ?.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-sm text-ellipsis overflow-hidden">{item.path}</TableCell>
                    <TableCell>{new Date(item.modifiedtime).toLocaleDateString()}</TableCell>
                    <TableCell className="w-8 ">
                      <Button
                        variant={'destructive'}
                        size={'sm'}
                        className="px-1 py-0.5"
                        onClick={() => handleRemoveCertificatesDirectory(item.path)}
                      >
                        <TrashIcon className="w-5 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
