import { cn } from '@/lib/utils';
import { ProcessamentoStatus } from '@/interfaces/processamento';
import { Loader2, CheckCircle2, PauseCircle, XCircle, Clock, Zap } from 'lucide-react';

interface ProgressCardProps {
  progress: number;
  value: number;
  max: number;
  status: ProcessamentoStatus;
  message: string;
  estimatedTimeRemaining?: number;
  speed?: number;
  lastFileName?: string;
  className?: string;
}

// Formata segundos para string legível
function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return '--:--';

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}

// Extrai nome do arquivo de um caminho
function extractFileName(path: string): string {
  if (!path) return '';
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || '';
}

const statusConfig = {
  [ProcessamentoStatus.Running]: {
    icon: Loader2,
    iconClass: 'animate-spin text-orange-500',
    barClass: 'bg-orange-500',
    bgClass: 'bg-orange-500/10',
    label: 'Enviando',
  },
  [ProcessamentoStatus.Paused]: {
    icon: PauseCircle,
    iconClass: 'text-yellow-500',
    barClass: 'bg-yellow-500',
    bgClass: 'bg-yellow-500/10',
    label: 'Pausado',
  },
  [ProcessamentoStatus.Stopped]: {
    icon: XCircle,
    iconClass: 'text-gray-400',
    barClass: 'bg-gray-400',
    bgClass: 'bg-gray-100',
    label: 'Parado',
  },
  [ProcessamentoStatus.Concluded]: {
    icon: CheckCircle2,
    iconClass: 'text-green-500',
    barClass: 'bg-green-500',
    bgClass: 'bg-green-500/10',
    label: 'Concluído',
  },
};

export function ProgressCard({
  progress,
  value,
  max,
  status,
  message,
  estimatedTimeRemaining,
  speed,
  lastFileName,
  className,
}: ProgressCardProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const percentage = Math.round(progress);
  const fileName = extractFileName(lastFileName || '');

  return (
    <div className={cn('rounded-lg border p-4 transition-all duration-300 ease-in-out', config.bgClass, className)}>
      {/* Header com status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5 transition-all', config.iconClass)} />
          <span className="font-medium text-sm">{config.label}</span>
        </div>
        <span className="text-2xl font-bold tabular-nums transition-all duration-300">{percentage}%</span>
      </div>

      {/* Barra de progresso */}
      <div className="mb-3">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200/50">
          <div
            className={cn('h-full transition-all duration-500 ease-out rounded-full', config.barClass)}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span className="tabular-nums">
          {value} de {max} arquivo{max !== 1 ? 's' : ''}
        </span>

        {status === ProcessamentoStatus.Running && (
          <div className="flex items-center gap-3">
            {speed !== undefined && speed > 0 && (
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                <span>{speed.toFixed(1)}/s</span>
              </div>
            )}
            {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatTime(estimatedTimeRemaining)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mensagem atual */}
      <div className="min-h-[20px]">
        {message && <p className="text-sm text-muted-foreground truncate animate-in fade-in duration-300">{message}</p>}
        {fileName && status === ProcessamentoStatus.Running && (
          <p className="text-xs text-muted-foreground/70 truncate mt-1" title={fileName}>
            {fileName}
          </p>
        )}
      </div>
    </div>
  );
}
