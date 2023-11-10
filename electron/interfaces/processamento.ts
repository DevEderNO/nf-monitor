export interface IProcessamento {
  messages: string[];
  progress: number;
  status: ProcessamentoStatus;
  id?: string;
}

export enum ProcessamentoStatus {
  Running = "Running",
  Paused = "Paused",
  Stopped = "Stopped",
  Concluded = "Concluded",
}
