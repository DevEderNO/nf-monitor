import { IUser } from "./user";

export interface ISignIn {
  Escritorio: {
    Id: string;
    Nome: string;
    Usuarios: IUser[];
  };
  Token: string;
}
