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
  StartProcess,
  PauseProcess,
  ResumeProcess,
  StopProcess,
  Discovery,
  Process,
}
