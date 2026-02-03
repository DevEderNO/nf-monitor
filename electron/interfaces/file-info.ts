export interface IFileInfo {
  id?: number;
  basePathId?: number;
  basePath?: string;
  filepath: string; // Computed: basePath + filename
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
