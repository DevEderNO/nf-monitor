export interface IDbHistoric {
  id?: number;
  startDate: Date;
  endDate: Date | null;
  filesSent: number;
  log: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
