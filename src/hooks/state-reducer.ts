import { IDirectory } from "@interfaces/directory";
import {
  IProcessamento,
  ProcessamentoStatus,
} from "../interfaces/processamento";
import { IAuth } from "@/interfaces/auth";
import { IConfig } from "@/interfaces/config";

export interface IState {
  auth: IAuth;
  directories: IDirectory[];
  loading: boolean;
  processamento: IProcessamento;
  historic: string[];
  config: IConfig;
}

export interface IAction {
  type: ActionType;
  payload?: any;
}

export const initialState: IState = {
  auth: {} as IAuth,
  directories: [],
  loading: false,
  processamento: {
    messages: [],
    progress: 0,
    status: ProcessamentoStatus.Stopped,
  },
  historic: [],
  config: {
    viewUploadedFiles: false,
    timeForProcessing: "00:00",
    timeForConsultingSieg: "00:00",
    directoryDownloadSieg: null,
    apiKeySieg: null,
    emailSieg: null,
    senhaSieg: null,
    directorySieg: null,
  },
};

export enum ActionType {
  Auth,
  Directories,
  Loading,
  Processamento,
  ClearMessages,
  Clear,
  Historic,
  Config,
}

export const StateReducer = (state: IState, action: IAction): IState => {
  switch (action.type) {
    case ActionType.Auth:
      return {
        ...state,
        auth: action.payload,
      };
    case ActionType.Directories:
      return { ...state, directories: action.payload };
    case ActionType.Loading:
      return { ...state, loading: action.payload };
    case ActionType.Processamento:
      return processamentoReducer();
    case ActionType.Historic:
      return { ...state, historic: action.payload };
    case ActionType.Config:
      window.ipcRenderer.send("set-config", action.payload);
      return { ...state, config: action.payload };
    case ActionType.Clear:
      window.ipcRenderer.send("remove-auth");
      return { ...initialState };
    case ActionType.ClearMessages:
      return {
        ...state,
        processamento: { ...state.processamento, messages: [] },
      };
    default:
      return state;
  }

  function processamentoReducer() {
    const messages = state.processamento.messages;
    messages.push(action.payload.messages);
    return {
      ...state,
      processamento: {
        messages,
        progress: action.payload.progress,
        status: action.payload.status,
      },
    };
  }
};
