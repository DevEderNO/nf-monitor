export interface IProcessamento {
  message: string;
  progress: number;
  value: number;
  max: number;
  status: ProcessamentoStatus;
  replace: boolean;
  id?: number;
  // Novos campos para UX melhorada
  startTime?: number;
  estimatedTimeRemaining?: number; // em segundos
  speed?: number; // arquivos por segundo
  lastFileName?: string;
}

export enum ProcessamentoStatus {
  Running = 'Running',
  Paused = 'Paused',
  Stopped = 'Stopped',
  Concluded = 'Concluded',
}
