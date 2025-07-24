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
  pfx: number;
  type: 'invoices' | 'certificates';
  totalFiles: number;
  createdAt: Date;
  updatedAt: Date;
}
