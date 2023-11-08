import { IFileInfo } from "../interfaces/file-info";
import { IDirectory } from "./directory";

export interface IDb {
  configuration: any;
  directories: IDirectory[];
  directoriesAndSubDirectories: IDirectory[];
  files: IFileInfo[];
}
