import { IUser } from "./user";

interface IEmpresa {
  Id: string;
  Nome: string;
  Cnpj: string;
}

export interface ISignIn {
  Escritorio: {
    Id: string;
    Nome: string;
    Usuarios: IUser[];
    Empresas: IEmpresa[];
    ApiKeySieg: string;
    EmailSieg: string;
    SenhaSieg: string;
  };
  Token: string;
}
