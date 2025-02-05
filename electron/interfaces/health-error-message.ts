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

export interface HealthErrorMessage {
  $type: string;
  source: number;
  childrens: (
    | ISystemProgama
    | ISystemUser
    | ISystemInfo
    | ISystemNetwork
    | ISystemDisk
  )[];
  escritorio: string;
  message: string;
}
