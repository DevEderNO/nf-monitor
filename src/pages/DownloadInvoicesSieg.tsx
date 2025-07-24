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
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useSocket } from '@/hooks/socket';
import { useAppState } from '@/hooks/state';
import { ActionType } from '@/hooks/state-reducer';
import { ProcessamentoStatus } from '@/interfaces/processamento';
import { WSMessageType } from '@/interfaces/ws-message';
import { cn } from '@/lib/utils';
import { StopIcon } from '@radix-ui/react-icons';
import { addMonths, format } from 'date-fns';
import { CalendarIcon, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DateRange } from 'react-day-picker';
import { FolderIcon, TrashIcon } from 'lucide-react';

interface IStepProcess {
  [key: string]: {
    label: string;
    icon: JSX.Element;
    onClick: () => void;
    onCancel?: () => void;
    disabled?: boolean;
  };
}

export function DownloadInvoicesSieg() {
  const {
    state: { config, processamentoSieg, auth },
    dispatch,
  } = useAppState();

  console.log(config)

  const { client } = useSocket();
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const newDate = new Date();
  const [date, setDate] = useState<DateRange | undefined>({
    from: addMonths(new Date(newDate.getFullYear(), newDate.getMonth(), 1), -1),
    to: newDate,
  });

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [processamentoSieg]);

  const hasDerectories = useCallback(() => {
    if (config.directoryDownloadSieg && config.directoryDownloadSieg?.length <= 0) {
      const messages = [
        '😊 Beleza! Só precisa selecionar onde estão os arquivos. O diretório de download das notas do SIEG pode ser configurado nas configurações, tudo certo?',
        '🤔 Poxa, precisamos que você escolha o diretório onde estão os arquivos que precisamos encontrar. Lembre-se, o diretório de download das notas do SIEG pode ser configurado nas configurações.',
        '😌🔍 Vamos nessa! Escolha o diretório onde estão os arquivos que precisamos achar. O diretório de download das notas do SIEG pode ser configurado nas configurações.',
      ];
      toast({
        title: messages[Math.floor(Math.random() * 3)],
        description: '',
        type: 'foreground',
      });
      return true;
    }
    return false;
  }, [config.directoryDownloadSieg && config.directoryDownloadSieg?.length, toast]);

  const stepStart = useCallback(
    (dateInitial: Date | undefined, dateEnd: Date | undefined) => {
      dispatch({ type: ActionType.ClearMessagesSieg });
      if (hasDerectories()) return;
      client?.send(
        JSON.stringify({
          type: 'message',
          message: {
            type: WSMessageType.StartSieg,
            data: {
              dateInitial,
              dateEnd,
            },
          },
        })
      );
    },
    [date]
  );

  const siegProcess: IStepProcess = {
    Running: {
      label: 'Consultando...',
      icon: <Pause />,
      onClick: () => {
        client?.send(
          JSON.stringify({
            type: 'message',
            message: {
              type: WSMessageType.PauseSieg,
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
              type: WSMessageType.ResumeSieg,
            },
          })
        );
      },
      onCancel: () => {
        client?.send(
          JSON.stringify({
            type: 'message',
            message: {
              type: WSMessageType.StopSieg,
            },
          })
        );
      },
    },
    Stopped: {
      label: 'Baixar Notas',
      icon: <Play />,
      onClick: () => stepStart(date?.from, date?.to),
      disabled: !config.directoryDownloadSieg,
    },
    Concluded: {
      label: 'Baixar Notas',
      icon: <Play />,
      onClick: () => stepStart(date?.from, date?.to),
      disabled: !config.directoryDownloadSieg,
    },
  };

  const handleTimeForConsultingSieg = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const config = await window.ipcRenderer.invoke('change-time-for-consulting-sieg', e.target.value);
    dispatch({
      type: ActionType.Config,
      payload: config,
    });
  }, []);

  const handleCleanDirectoryDownloadSieg = useCallback(
    async (clearFiles: boolean) => {
      const config = await window.ipcRenderer.invoke('clear-directory-download-sieg', clearFiles);
      dispatch({
        type: ActionType.Config,
        payload: config,
      });
    },
    [dispatch]
  );

  const handleSelectDirectoryDownloadSieg = useCallback(async () => {
    const config = await window.ipcRenderer.invoke('select-directory-download-sieg');
    if (config) {
      dispatch({
        type: ActionType.Config,
        payload: config,
      });
    }
  }, []);

  return (
    <div className="p-4 m-4 flex flex-1 flex-col gap-4 border rounded-md h-full basis-full overflow-y-auto">
      {auth?.user?.nivel && auth?.user?.nivel > 3 ? (
        <div className="flex flex-col gap-2">
          <Label>API Key do SIEG</Label>
          <Input placeholder="" type="text" className="" value={config?.apiKeySieg ?? ''} disabled />
        </div>
      ) : (
        <></>
      )}
      <div className="flex w-full justify-between gap-2">
        <div className="flex flex-col w-full gap-2">
          <Label>Diretório para download das notas do SIEG</Label>
          <div className="flex w-full items-center">
            <Button onClick={handleSelectDirectoryDownloadSieg}>
              <FolderIcon className="w-5 h-4" />
            </Button>
            <Input placeholder="" type="text" className="w-full" value={config?.directoryDownloadSieg ?? ''} disabled />
            <div className="flex items-center justify-between">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="text-primary">
                    <TrashIcon className="w-5 h-4 text-foreground" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>🗑️ Quer remover os arquivos que já estão na pasta? 🗂️</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se fizer a limpeza ⚠️, esses arquivos não serão enviados para o Sittax.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleCleanDirectoryDownloadSieg(true)}>
                      Quero limpar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-row gap-16">
        <div className="flex flex-col gap-2">
          <Label>Hora para consultar notas no SIEG</Label>
          <Input
            placeholder=""
            type="time"
            className="w-fit"
            onChange={handleTimeForConsultingSieg}
            value={config?.timeForConsultingSieg}
          />
        </div>
        <div>
          <div className="flex flex-col gap-2">
            <Label>Periodo de consulta</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={'outline'}
                  className={cn('w-[300px] justify-start text-left font-normal', !date && 'text-muted-foreground')}
                >
                  <CalendarIcon />
                  {date?.from ? (
                    date.to ? (
                      <>
                        {format(date.from, 'LLL dd, y')} - {format(date.to, 'LLL dd, y')}
                      </>
                    ) : (
                      format(date.from, 'LLL dd, y')
                    )
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
      <div className="row-auto flex gap-2">
        <Button
          key={siegProcess[processamentoSieg.status].label}
          className=""
          onClick={siegProcess[processamentoSieg.status].onClick}
          disabled={!date?.from || !date?.to || !config.directoryDownloadSieg}
        >
          {siegProcess[processamentoSieg.status].icon}
          {siegProcess[processamentoSieg.status].label}
        </Button>
        {processamentoSieg.status === ProcessamentoStatus.Paused && (
          <Button
            className="flex gap-1"
            variant={'destructive'}
            onClick={siegProcess[processamentoSieg.status].onCancel}
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
          value={processamentoSieg?.messages
            ?.slice(processamentoSieg?.messages?.length - 1000, processamentoSieg?.messages?.length - 1)
            ?.join('\n')}
        />
      </div>
    </div>
  );
}
