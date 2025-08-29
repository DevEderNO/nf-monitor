export interface IUser {
  id?: number;
  userId: string;
  nome: string;
  sobrenome: string | null;
  cpf: string | null;
  email: string | null;
  phoneNumber: string | null;
  ativo: boolean;
  emailConfirmed: boolean;
  accessFailedCount: number;
  dataDeCriacao: string;
  lockoutEnd: string | null;
  eUsuarioEmpresa: boolean;
  role: string | null;
  ePrimeiroAcesso: boolean;
  nivel: ENivel;
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
