export interface WSMessage {
  type: "message";
  message: {
    type: WSMessageType;
  };
}
export interface WSMessageTyped<T> extends WSMessage {
  message: {
    type: WSMessageType;
    data: T;
  };
}

export enum WSMessageType {
  StartDiscovery,
  PauseDiscovery,
  ResumeDiscovery,
  StopDiscovery,

  StartUploadInvoices,
  PauseUploadInvoices,
  ResumeUploadInvoices,
  StopUploadInvoices,

  StartUploadCertificates,
  PauseUploadCertificates,
  ResumeUploadCertificates,
  StopUploadCertificates,

  StartSieg,
  PauseSieg,
  ResumeSieg,
  StopSieg,

  Discovery,
  Process,
  Sieg,
}
