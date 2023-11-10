export interface IDbHistoric {
  executions: IExecution[];
}

export interface IExecution {
  id: string;
  startDate: Date;
  endDate?: Date;
  log?: string[];
}
