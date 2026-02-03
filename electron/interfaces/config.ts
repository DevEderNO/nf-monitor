export interface IConfig {
  id?: number;
  timeForProcessing: string;
  viewUploadedFiles: boolean;
  removeUploadedFiles: boolean;
  lastCleanup?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
