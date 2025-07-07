export interface IDirectory {
  id: number;
  path: string;
  modifiedtime: Date;
  size: number;
  directories: number;
  xmls: number;
  pdfs: number;
  zips: number;
  txts: number;
  totalFiles: number;
  createdAt: Date;
  updatedAt: Date;
}
