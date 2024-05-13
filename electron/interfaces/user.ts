export interface IUser {
  Id: string;
  Nome: string;
  Sobrenome: string;
  Cpf: string;
  Email: string;
  PhoneNumber: string;
  Ativo: string;
  EmailConfirmed: string;
  AccessFailedCount: string;
  DataDeCriacao: string;
  LockoutEnd: string;
  EUsuarioEmpresa: string;
  Role: string;
  EPrimeiroAcesso: string;
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
