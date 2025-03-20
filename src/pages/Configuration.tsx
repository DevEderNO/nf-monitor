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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/hooks/state";
import { ActionType } from "@/hooks/state-reducer";
import { FolderIcon, TrashIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function Configuration() {
  const { state, dispatch } = useAppState();
  const [historic, setHistoric] = useState([] as string[]);
  const [viewUploadedFiles, setViewUploadedFiles] = useState(false);

  useEffect(() => {
    setHistoric(state?.historic ?? []);
    setViewUploadedFiles(state?.config?.viewUploadedFiles ?? false);
  }, [state?.config?.viewUploadedFiles, state?.historic]);

  const handleSelectDirectoryDownloadSieg = useCallback(async () => {
    const config = await window.ipcRenderer.invoke(
      "select-directory-download-sieg"
    );
    if (config) {
      dispatch({
        type: ActionType.Config,
        payload: config,
      });
    }
  }, []);

  const handleTimeForProcessing = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const config = await window.ipcRenderer.invoke(
        "change-time-for-processing",
        e.target.value
      );
      dispatch({
        type: ActionType.Config,
        payload: config,
      });
    },
    []
  );

  const handleTimeForConsultingSieg = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const config = await window.ipcRenderer.invoke(
        "change-time-for-consulting-sieg",
        e.target.value
      );
      dispatch({
        type: ActionType.Config,
        payload: config,
      });
    },
    []
  );

  const handleCleanHistoric = useCallback(() => {
    window.ipcRenderer.send("clear-historic");
    dispatch({ type: ActionType.Historic, payload: [] });
  }, [dispatch]);

  const handleCleanDirectoryDownloadSieg = useCallback(
    async (clearFiles: boolean) => {
      const config = await window.ipcRenderer.invoke(
        "clear-directory-download-sieg",
        clearFiles
      );
      dispatch({
        type: ActionType.Config,
        payload: config,
      });
    },
    [dispatch]
  );

  const changeViewUploadedFiles = useCallback(async () => {
    const config = await window.ipcRenderer.invoke(
      "change-view-uploaded-files",
      !viewUploadedFiles
    );
    dispatch({
      type: ActionType.Config,
      payload: config,
    });
  }, [dispatch, viewUploadedFiles]);

  return (
    <div className="p-4 m-4 flex flex-1 flex-col gap-4 border rounded-md">
      <div className="flex items-center space-x-2">
        <Switch
          id="airplane-mode"
          checked={viewUploadedFiles}
          onClick={changeViewUploadedFiles}
        />
        <Label htmlFor="airplane-mode">
          Visualizar arquivos já enviados. (☑️)
        </Label>
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
        {state?.config?.timeForProcessing?.length > 0 &&
          state?.config?.timeForProcessing !== "00:00" && (
            <>
              Agendamento <span className="text-primary">programado</span> para
              ocorrer as{" "}
              <span className="text-primary">
                {state?.config?.timeForProcessing}
              </span>{" "}
              diariamente.
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
                <AlertDialogTitle>
                  Absolutamente! 🚀 Vamos dar um "reset" e começar do zero! 🔄
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Ao limpar o histórico, os dados anteriores serão removidos,
                  então você não poderá mais acessá-los.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleCleanHistoric}>
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <Textarea
          className="flex flex-1 cursor-default resize-none font-mono transition-colors "
          readOnly
          defaultValue={historic?.join("\n")}
        />
      </div>
      {state.config.apiKeySieg && state.config.apiKeySieg.length > 0 ? (
        <div className="flex flex-col flex-1 gap-2">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Hora para consultar notas no SIEG</Label>
              <Input
                placeholder=""
                type="time"
                className="w-fit"
                onChange={handleTimeForConsultingSieg}
                value={state?.config?.timeForConsultingSieg}
              />
            </div>
            <div className="flex flex-col w-full gap-2">
              <Label>Diretório para download das notas do SIEG</Label>
              <div className="flex w-full items-center">
                <Button onClick={handleSelectDirectoryDownloadSieg}>
                  <FolderIcon className="w-5 h-4" />
                </Button>
                <Input
                  placeholder=""
                  type="text"
                  className="w-full"
                  value={state?.config?.directoryDownloadSieg ?? ""}
                  disabled
                />
                {state?.config?.directoryDownloadSieg && (
                  <div className="flex items-center justify-between">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="text-primary">
                          <TrashIcon className="w-5 h-4 text-foreground" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            🗑️ Quer remover os arquivos que já estão na pasta?
                            🗂️
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Se fizer a limpeza ⚠️, esses arquivos não serão enviados para o Sittax.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              handleCleanDirectoryDownloadSieg(false)
                            }
                          >
                            Quero manter
                          </AlertDialogAction>
                          <AlertDialogAction
                            onClick={() =>
                              handleCleanDirectoryDownloadSieg(true)
                            }
                          >
                            Quero limpar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h3 className="scroll-m-20 text-xl font-semibold tracking-tight transition-colors first:mt-0">
            {state?.config?.timeForConsultingSieg?.length > 0 &&
              state?.config?.timeForConsultingSieg !== "00:00" && (
                <>
                  Agendamento para consultar notas no SIEG programado para
                  ocorrer as{" "}
                  <span className="text-primary">
                    {state?.config?.timeForConsultingSieg}
                  </span>{" "}
                  diariamente.
                </>
              )}
          </h3>
        </div>
      ) : (
        <></>
      )}
    </div>
  );
}
