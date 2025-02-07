export interface IDb {
  configuration: {
    timeForProcessing: string;
  };
  directories: {
    path: string;
    modifiedtime: Date;
    size: number;
  }[];
  directoriesAndSubDirectories: {
    path: string;
    modifiedtime: Date;
    size: number;
  }[];
  files: {
    name: string;
    isDirectory: boolean;
    isFile: boolean;
    filepath: string;
    extension: string;
    modifiedtime: Date;
    size: number;
    wasSend: boolean;
    isValid: boolean;
    bloqued: boolean;
    dataSend: Date;
  }[];
  auth: {
    credentials: {
      user: string;
      password: string;
    };
  };
  timeForProcessing: string;
}
