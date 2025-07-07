export interface IDirectory {
  id?: number;
  path: string;
  modifiedtime: Date;
  size: number;
  directories: number;
  xmls: number;
  pdfs: number;
  txts: number;
  zips: number;
  totalFiles: number;
  createdAt?: Date;
  updatedAt?: Date;
}
