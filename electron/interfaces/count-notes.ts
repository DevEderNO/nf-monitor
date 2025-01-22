import { RoleTypeSieg } from "@prisma/client";

export interface ICountedNotes {
  id?: number;
  dataInicio: Date;
  dataFim: Date;
  nfe: number;
  nfce: number;
  cte: number;
  cfe: number;
  nfse: number;
  role: RoleTypeSieg;
  createdAt?: Date;
  updatedAt?: Date;
}
