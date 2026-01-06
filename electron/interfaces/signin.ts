import { ENivel } from './user';

export interface IUserSittax {
  Id: string;
  UserId: string;
  Nome: string;
  Sobrenome: string | null;
  Cpf: string | null;
  Email: string | null;
  PhoneNumber: string | null;
  Ativo: boolean;
  EmailConfirmed: boolean;
  AccessFailedCount: number;
  DataDeCriacao: string;
  LockoutEnd: string | null;
  EUsuarioEmpresa: boolean;
  Role: string | null;
  EPrimeiroAcesso: boolean;
  Nivel: ENivel;
}

interface IEmpresa {
  Id: string;
  Nome: string;
  Cnpj: string;
}

export interface ISignIn {
  Escritorio: {
    Id: string;
    Nome: string;
    Usuarios: IUserSittax[];
    Empresas: IEmpresa[];
  };
  Token: string;
}
