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
  processamentoSieg: IProcessamento;
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
    replace: false,
    status: ProcessamentoStatus.Stopped,
  },
  processamentoSieg: {
    messages: [],
    progress: 0,
    replace: false,
    status: ProcessamentoStatus.Stopped,
  },
  historic: [],
  config: {
    viewUploadedFiles: false,
    timeForProcessing: "00:00",
    timeForConsultingSieg: "00:00",
    directoryDownloadSieg: null,
    apiKeySieg: "",
    emailSieg: null,
    senhaSieg: null,
  },
};

export enum ActionType {
  Auth,
  Directories,
  Loading,
  Processamento,
  ProcessamentoSieg,
  ClearMessages,
  ClearMessagesSieg,
  Clear,
  Historic,
  Config,
}

export const StateReducer = (
  state: IState,
  action: IAction | IAction[]
): IState => {
  if (Array.isArray(action)) {
    return action.reduce((acc, curr) => {
      return StateReducer(acc, curr);
    }, state);
  }
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
      return processamentoReducer(action);
    case ActionType.ProcessamentoSieg:
      return processamentoSiegReducer(action);
    case ActionType.Historic:
      return { ...state, historic: action.payload };
    case ActionType.Config:
      window.ipcRenderer.send("set-config", {
        ...state.config,
        ...action.payload,
      });
      return { ...state, config: { ...state.config, ...action.payload } };
    case ActionType.Clear:
      window.ipcRenderer.send("remove-auth");
      return { ...initialState };
    case ActionType.ClearMessages:
      return {
        ...state,
        processamento: { ...state.processamento, messages: [] },
      };
    case ActionType.ClearMessagesSieg:
      return {
        ...state,
        processamentoSieg: { ...state.processamentoSieg, messages: [] },
      };
    default:
      return state;
  }

  function processamentoReducer(action: IAction) {
    const messages = state.processamento.messages;
    if (action.payload.messages.length > 0) {
      if (action.payload.replace) {
        messages.splice(messages.length - 1, 1);
      }
      messages.push(action.payload.messages);
    }
    return {
      ...state,
      processamento: {
        messages,
        progress: action.payload.progress,
        status: action.payload.status,
        replace: action.payload.replace,
      },
    };
  }

  function processamentoSiegReducer(action: IAction) {
    const messages = state.processamentoSieg.messages;
    if (action.payload.messages.length > 0) {
      if (action.payload.replace) {
        messages.splice(messages.length - 1, 1);
      }
      messages.push(action.payload.messages);
    }
    return {
      ...state,
      processamentoSieg: {
        messages,
        progress: action.payload.progress,
        status: action.payload.status,
        replace: action.payload.replace,
      },
    };
  }
};
