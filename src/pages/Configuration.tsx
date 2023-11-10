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
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/hooks/state";
import { ActionType } from "@/hooks/state-reducer";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

const formSchema = z.object({
  hora: z.string().min(5, { message: "A hora e obrigatória" }),
});

export function Configuration() {
  const { state, dispatch } = useAppState();
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
  return (
    <div className="p-4 m-4 flex flex-col gap-4 flex-1 border rounded-md">
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
              <span className="text-primary">{state?.timeForProcessing}h</span>{" "}
              diariamente.
            </>
          )}
      </h2>
      <div className="flex flex-col flex-1 gap-2">
        <Label>Histórico de execuções</Label>
        <Textarea
          className="flex flex-1 cursor-default resize-none font-mono transition-colors "
          readOnly
          defaultValue={state?.historic?.join("\n")}
        />
      </div>
    </div>
  );
}
