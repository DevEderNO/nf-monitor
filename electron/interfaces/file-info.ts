export interface IFileInfo {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  filepath: string;
  extension: string;
  modifiedtime: Date;
  size: number;
  dataSend?: Date;
  wasSend: boolean;
  isValid: boolean;
}
