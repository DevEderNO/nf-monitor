export interface IDbHistoric {
  id?: number;
  startDate: Date;
  endDate: Date | null;
  log: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
