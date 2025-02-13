export interface IBaseHealthMessage {
  $type: string;
  childrens?: IBaseHealthMessage[];
}

export interface ISystemDisk extends IBaseHealthMessage {
  $type: string;
  name: string;
  free: string;
  total: string;
}

export interface ISystemNetwork extends IBaseHealthMessage {
  $type: string;
  name: string;
  address: string;
  mac: string;
}

export interface ISystemInfo extends IBaseHealthMessage {
  $type: string;
  platform: string;
  arch: string;
  hostname: string;
  cpus: number;
  totalRam: string;
  freeRam: string;
  uptime: string;
  externalIp: string | null;
}

export interface ISystemUser extends IBaseHealthMessage {
  $type: string;
  id: string;
  name: string;
  email: string;
}

export interface ISystemProgama extends IBaseHealthMessage {
  $type: string;
  name: string;
  folder: string;
}

export enum XHealthType {
  None = 0,
  Success = 1,
  Warning = 2,
  Error = 3,
  Info = 4,
  Debug = 5,
}

export interface NFMoniotorHealth {
  $type: string;
  type: XHealthType;
  source: number;
  data: Date;
  childrens: (
    | ISystemProgama
    | ISystemUser
    | ISystemInfo
    | ISystemNetwork
    | ISystemDisk
  )[];
  escritorio: string;
  usuario: string;
  maquina: string;
  message: string;
}
