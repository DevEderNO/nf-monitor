import { IEmpresa } from "./empresa";
import { IUser } from "./user";

export interface ISignIn {
  Escritorio: {
    Id: string;
    Nome: string;
    Usuarios: IUser[];
    Empresas: IEmpresa[];
  };
  Token: string;
}
