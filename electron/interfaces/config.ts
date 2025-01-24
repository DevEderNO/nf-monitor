export interface IConfig {
  id?: number;
  timeForProcessing: string;
  timeForConsultingSieg: string;
  directoryDownloadSieg: string | null;
  viewUploadedFiles: boolean;
  apiKeySieg: string;
  emailSieg: string | null;
  senhaSieg: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
