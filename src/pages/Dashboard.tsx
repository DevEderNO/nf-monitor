import { Button } from "@components/ui/button";
import { useEffect, useRef } from "react";
import { Textarea } from "@components/ui/textarea";
import { Progress } from "@components/ui/progress";
import { Play, Pause } from "lucide-react";
import { useSocket } from "@hooks/socket";
import { useAppState } from "@hooks/state";
import { WSMessageType } from "../interfaces/ws-message";
import { ProcessamentoStatus } from "@/interfaces/processamento";
import { StopIcon } from "@radix-ui/react-icons";
import { ActionType } from "@/hooks/state-reducer";

interface IStepProcess {
  [key: string]: {
    label: string;
    icon: JSX.Element;
    onClick: () => void;
    onCancel?: () => void;
  };
}

export function Dashboard() {
  const { client, processTask } = useSocket();
  const {
    state: { processamento, directories },
    dispatch,
  } = useAppState();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [processamento]);

  const discovery: IStepProcess = {
    Running: {
      label: "Localizando...",
      icon: <Pause />,
      onClick: () => {
        client?.send(
          JSON.stringify({
            type: "message",
            message: {
              type: WSMessageType.PauseDiscovery,
            },
          })
        );
      },
    },
    Paused: {
      label: "Continuar",
      icon: <Play />,
      onClick: () => {
        client?.send(
          JSON.stringify({
            type: "message",
            message: {
              type: WSMessageType.ResumeDiscovery,
            },
          })
        );
      },
      onCancel: () => {
        client?.send(
          JSON.stringify({
            type: "message",
            message: {
              type: WSMessageType.StopDiscovery,
            },
          })
        );
      },
    },
    Stopped: {
      label: "Localizar",
      icon: <Play />,
      onClick: () => {
        client?.send(
          JSON.stringify({
            type: "message",
            message: {
              type: WSMessageType.StartDiscovery,
              data: directories,
            },
          })
        );
      },
    },
    Concluded: {
      label: "Re-localizar",
      icon: <Play />,
      onClick: () => {
        dispatch({ type: ActionType.ClearMessages });
        client?.send(
          JSON.stringify({
            type: "message",
            message: {
              type: WSMessageType.StartDiscovery,
              data: directories,
            },
          })
        );
      },
    },
  };

  const send: IStepProcess = {
    Running: {
      label: "Enviando...",
      icon: <Pause />,
      onClick: () => {
        client?.send(
          JSON.stringify({
            type: "message",
            message: {
              type: WSMessageType.PauseProcess,
            },
          })
        );
      },
    },
    Paused: {
      label: "Continuar",
      icon: <Play />,
      onClick: () => {
        client?.send(
          JSON.stringify({
            type: "message",
            message: {
              type: WSMessageType.ResumeProcess,
            },
          })
        );
      },
      onCancel: () => {
        client?.send(
          JSON.stringify({
            type: "message",
            message: {
              type: WSMessageType.StopProcess,
            },
          })
        );
      },
    },
    Stopped: {
      label: "Enviar",
      icon: <Play />,
      onClick: () => {
        dispatch({ type: ActionType.ClearMessages });
        client?.send(
          JSON.stringify({
            type: "message",
            message: {
              type: WSMessageType.StartProcess,
              data: directories,
            },
          })
        );
      },
    },
    Concluded: {
      label: "Re-enviar",
      icon: <Play />,
      onClick: () => {
        client?.send(
          JSON.stringify({
            type: "message",
            message: {
              type: WSMessageType.StartProcess,
              data: directories,
            },
          })
        );
      },
    },
  };

  return (
    <div className="p-4 m-4 flex flex-col gap-4 border rounded-md flex-1">
      <div className="flex gap-3">
        <Button
          className="flex gap-1"
          onClick={
            processTask === "discovery"
              ? discovery[processamento.status].onClick
              : send[processamento.status].onClick
          }
        >
          {processTask === "discovery"
            ? discovery[processamento.status].icon
            : send[processamento.status].icon}
          {processTask === "discovery"
            ? discovery[processamento.status].label
            : send[processamento.status].label}
        </Button>
        {processamento.status === ProcessamentoStatus.Paused && (
          <Button
            className="flex gap-1"
            variant={"destructive"}
            onClick={
              processTask === "discovery"
                ? discovery[processamento.status].onCancel
                : send[processamento.status].onCancel
            }
          >
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
          value={processamento?.messages
            ?.slice(
              processamento?.messages?.length - 1000,
              processamento?.messages?.length - 1
            )
            ?.join("\n")}
        />
        <Progress value={processamento?.progress} />
      </div>
    </div>
  );
}
