import { IAuth } from "./auth";
import { IDirectory } from "./directory";
import { IFileInfo } from "@interfaces/file-info";

export interface IDb {
  configuration: any;
  directories: IDirectory[];
  directoriesAndSubDirectories: IDirectory[];
  files: IFileInfo[];
  auth: IAuth;
  timeForProcessing: string;
}
