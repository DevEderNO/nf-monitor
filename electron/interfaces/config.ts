export interface IConfig {
  id?: number;
  timeForProcessing: string;
  timeForConsultingSieg: string;
  directoryDownloadSieg: string | null;
  viewUploadedFiles: boolean;
  apiKeySieg: string | null;
  emailSieg: string | null;
  senhaSieg: string | null;
  directorySieg: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
