export interface IProcessamento {
  message: string;
  progress: number;
  value: number;
  max: number;
  status: ProcessamentoStatus;
  replace: boolean;
}

export enum ProcessamentoStatus {
  Running = "Running",
  Paused = "Paused",
  Stopped = "Stopped",
  Concluded = "Concluded",
}
