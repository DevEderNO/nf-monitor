import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAppState } from '@/hooks/state';
import { ActionType } from '@/hooks/state-reducer';
import { useEffect, useState } from 'react';

export function Configuration() {
  const { state, dispatch } = useAppState();
  const [historic, setHistoric] = useState([] as string[]);
  const [viewUploadedFiles, setViewUploadedFiles] = useState(false);
  const [removeUploadedFiles, setRemoveUploadedFiles] = useState(false);

  useEffect(() => {
    setHistoric(state?.historic ?? []);
    setViewUploadedFiles(state?.config?.viewUploadedFiles ?? false);
    setRemoveUploadedFiles(state?.config?.removeUploadedFiles ?? false);
  }, [state?.config?.viewUploadedFiles, state?.config?.removeUploadedFiles, state?.historic]);

  const handleTimeForProcessing = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const config = await window.ipcRenderer.invoke('change-time-for-processing', e.target.value);
    dispatch({
      type: ActionType.Config,
      payload: config,
    });
  };

  const handleCleanHistoric = () => {
    window.ipcRenderer.send('clear-historic');
    dispatch({ type: ActionType.Historic, payload: [] });
  };

  const changeViewUploadedFiles = async () => {
    const config = await window.ipcRenderer.invoke('change-view-uploaded-files', !viewUploadedFiles);
    dispatch({
      type: ActionType.Config,
      payload: config,
    });
  };

  const changeRemoveUploadedFiles = async () => {
    const config = await window.ipcRenderer.invoke('change-remove-uploaded-files', !removeUploadedFiles);
    dispatch({
      type: ActionType.Config,
      payload: config,
    });
  };

  return (
    <div className="p-4 flex flex-col gap-4 border rounded-md h-full overflow-hidden">
      <div className="flex items-center space-x-2">
        <Switch id="airplane-mode" checked={viewUploadedFiles} onClick={changeViewUploadedFiles} />
        <Label htmlFor="airplane-mode">Visualizar arquivos já enviados. (☑️)</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Switch id="airplane-mode" checked={removeUploadedFiles} onClick={changeRemoveUploadedFiles} />
        <Label htmlFor="airplane-mode">Remover arquivos que já foram enviados para o Sittax do seu computador (recomendado). (🗑️)</Label>
      </div>
      <div className="flex gap-4">
        <div className="flex flex-col gap-2">
          <Label>Hora para localizar e enviar os arquivos</Label>
          <Input
            placeholder=""
            type="time"
            className="w-fit"
            onChange={handleTimeForProcessing}
            value={state.config.timeForProcessing}
          />
        </div>
      </div>
      <h3 className="scroll-m-20 text-xl font-semibold tracking-tight transition-colors first:mt-0">
        {state?.config?.timeForProcessing?.length > 0 && state?.config?.timeForProcessing !== '00:00' && (
          <>
            Agendamento <span className="text-primary">programado</span> para ocorrer as{' '}
            <span className="text-primary">{state?.config?.timeForProcessing}</span> diariamente.
          </>
        )}
      </h3>
      <div className="flex flex-col flex-1 gap-2">
        <div className="flex items-center justify-between">
          <Label>Histórico de execuções</Label>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-primary">
                Limpar Histórico
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Absolutamente! 🚀 Vamos dar um "reset" e começar do zero! 🔄</AlertDialogTitle>
                <AlertDialogDescription>
                  Ao limpar o histórico, os dados anteriores serão removidos, então você não poderá mais acessá-los.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleCleanHistoric}>Continue</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <Textarea
          className="flex flex-1 cursor-default resize-none font-mono transition-colors "
          readOnly
          defaultValue={historic?.join('\n')}
        />
      </div>
    </div>
  );
}
