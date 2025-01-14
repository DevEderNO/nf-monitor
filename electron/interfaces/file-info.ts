export interface IFileInfo {
  id?: number;
  filepath: string;
  filename: string;
  extension: string;
  wasSend: boolean;
  dataSend: Date | null;
  isValid: boolean;
  isDirectory: boolean;
  bloqued: boolean;
  isFile: boolean;
  modifiedtime: Date | null;
  size: number;
  createdAt?: Date;
  updatedAt?: Date;
}
