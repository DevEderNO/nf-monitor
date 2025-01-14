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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/hooks/state";
import { ActionType } from "@/hooks/state-reducer";
import { ENivel } from "@/interfaces/user";
import { zodResolver } from "@hookform/resolvers/zod";
import { TrashIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const formSchema = z.object({
  hora: z.string().min(5, { message: "A hora e obrigatória" }),
});

export function Configuration() {
  const { state, dispatch } = useAppState();
  const [historic, setHistoric] = useState([] as string[]);
  const [viewUploadedFiles, setViewUploadedFiles] = useState(false);

  useEffect(() => {
    setHistoric(state?.historic ?? []);
    setViewUploadedFiles(state?.config?.viewUploadedFiles ?? false);
  }, [state?.config?.viewUploadedFiles, state?.historic]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      hora: state?.timeForProcessing,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    dispatch({
      type: ActionType.TimeForProcessing,
      payload: values.hora,
    });
  }

  const handleCleanHistoric = useCallback(() => {
    window.ipcRenderer.send("clear-historic");
    dispatch({ type: ActionType.Historic, payload: [] });
  }, [dispatch]);

  const changeViewUploadedFiles = useCallback(() => {
    dispatch({
      type: ActionType.ViewUploadedFiles,
      payload: !viewUploadedFiles,
    });
  }, [dispatch, viewUploadedFiles]);

  return (
    <div className="p-4 m-4 flex flex-col gap-4 flex-1 border rounded-md">
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
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 w-full"
        >
          <div className="flex gap-4">
            <FormField
              control={form.control}
              name="hora"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>
                    Hora para localizar e enviar os arquivos
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder=""
                      type="time"
                      className="w-fit"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button type="submit">Salvar</Button>
        </form>
      </Form>
      <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight transition-colors first:mt-0">
        {state?.timeForProcessing?.length > 0 &&
          state?.timeForProcessing !== "00:00" && (
            <>
              Agendamento <span className="text-primary">programado</span> para
              ocorrer as{" "}
              <span className="text-primary">{state?.timeForProcessing}</span>{" "}
              diariamente.
            </>
          )}
      </h2>
      <div className="flex flex-col flex-1 gap-2">
        <div className="flex items-center justify-between">
          <Label>Histórico de execuções</Label>
          {state.auth.user?.Nivel?.valueOf() <= ENivel.Suporte.valueOf() ? (
            <Button
              variant={"destructive"}
              size={"sm"}
              className="px-1 py-0.5"
              onClick={() => {}}
            >
              <TrashIcon className="w-5 h-4" />
            </Button>
          ) : (
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
          )}
        </div>
        <Textarea
          className="flex flex-1 cursor-default resize-none font-mono transition-colors "
          readOnly
          defaultValue={historic?.join("\n")}
        />
      </div>
    </div>
  );
}
