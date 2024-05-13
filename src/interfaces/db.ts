import { IFileInfo } from "../interfaces/file-info";
import { IAuth } from "./auth";
import { IConfig } from "./config";
import { IDirectory } from "./directory";

export interface IDb {
  configuration: IConfig;
  directories: IDirectory[];
  directoriesAndSubDirectories: IDirectory[];
  files: IFileInfo[];
  auth: IAuth;
  timeForProcessing: string;
}
