export interface IDirectory {
  id?: number;
  path: string;
  modifiedtime: Date;
  size: number;
  createdAt?: Date;
  updatedAt?: Date;
}
