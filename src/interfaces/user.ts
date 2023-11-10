export interface IUser {
  id: string;
  nome: string;
  sobrenome: string;
  cpf: string;
  email: string;
  phoneNumber: string;
  ativo: boolean;
  emailConfirmed: boolean;
  accessFailedCount: number;
  dataDeCriacao: Date;
  lockoutEnd: Date;
  eUsuarioEmpresa: boolean;
  role: {
    name: string;
  };
  termoPendente: boolean;
  temQueVotarNps: boolean;
}
