export interface IProcessamento {
  messages: string[];
  progress: number;
  status: ProcessamentoStatus;
  id?: number;
}

export enum ProcessamentoStatus {
  Running = "Running",
  Paused = "Paused",
  Stopped = "Stopped",
  Concluded = "Concluded",
}
