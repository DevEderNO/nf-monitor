export interface IDirectory {
  id: number;
  path: string;
  modifiedtime: Date;
  size: number;
  directories: number;
  xmls: number;
  pdfs: number;
  zips: number;
  createdAt: Date;
  updatedAt: Date;
}
