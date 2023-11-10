import { Button } from "@components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@components/ui/form";
import { Input } from "@components/ui/input";
import { useAuth } from "@hooks/auth";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@hooks/state";
import { ReloadIcon } from "@radix-ui/react-icons";
import { useToast } from "@components/ui/use-toast";
import { Toaster } from "@components/ui/toaster";
import logoMonitor from "@images/logo-monitor.png";
import logoWoman from "@images/logo-woman.png";

const formSchema = z.object({
  user: z.string(),
  password: z.string().min(6, {
    message: "Deve conter mais de 6 caracteres",
  }),
});

export function Signin() {
  const { signIn } = useAuth();
  const { state } = useAppState();
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      user: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await signIn(values);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast({
        title: "Algo deu errado 😯 verifique suas credências",
        description: "",
        type: "foreground",
      });
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 w-full h-full">
        <div className="col grid auto-rows-auto">
          <div className="pl-6 pt-6 h-fit">
            <img
              src={logoMonitor}
              alt="logo"
              className="rounded-md object-cover h-7"
            />
          </div>

          <div className="p-6 place-self-center w-full">
            <div className="flex flex-col gap-4 max-w-sm w-full justify-center">
              <div className="text-3xl font-bold h-min">Portal</div>
              <div className="h-min">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="h-fit space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="user"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Usuário</FormLabel>
                          <FormControl>
                            <Input placeholder="Usuário" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Senha"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button disabled={state?.loading}>
                      {state?.loading ? (
                        <>
                          <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                          Acessando
                        </>
                      ) : (
                        <>Acessar</>
                      )}
                    </Button>
                  </form>
                </Form>
              </div>
            </div>
          </div>
          <div className="px-6 w-[220px]">
            <h1 className="text-2xl font-semibold">
              Gerenciar <span className="text-primary">notas fiscais</span>{" "}
              nunca foi tão <span className="text-primary">fácil_</span>
            </h1>
          </div>
        </div>
        <div className="col flex items-end w-11/12">
          <img
            src={logoWoman}
            alt="logo-woman"
            style={{ maxHeight: "calc(100vh - 10px)" }}
          />
        </div>
      </div>
      <Toaster />
    </>
  );
}
