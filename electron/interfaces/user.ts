export interface IUser {
  Id: string;
  userId: string;
  Nome: string;
  Sobrenome: string;
  Cpf: string;
  Email: string;
  PhoneNumber: string;
  Ativo: boolean;
  EmailConfirmed: boolean;
  AccessFailedCount: string;
  DataDeCriacao: string;
  LockoutEnd: string;
  EUsuarioEmpresa: boolean;
  Role: string;
  EPrimeiroAcesso: boolean;
  Nivel: ENivel;
}

export enum ENivel {
  Empresa = 1,
  Usuario = 2,
  AdministradorEscritorio = 3,
  Financeiro = 4,
  Suporte = 5,
  Revenda = 6,

  Desenvolvedor = 9,
  Administrador = 10,
}
