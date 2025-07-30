import { IDirectory } from '@interfaces/directory';
import { IProcessamento, ProcessamentoStatus } from '../interfaces/processamento';
import { IAuth } from '@/interfaces/auth';
import { IConfig } from '@/interfaces/config';

export interface IState {
  auth: IAuth;
  directories: IDirectory[];
  loading: boolean;
  invoicesLog: IProcessamento;
  certificatesLog: IProcessamento;
  siegLog: IProcessamento;
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
  invoicesLog: {
    messages: [],
    progress: 0,
    value: 0,
    max: 0,
    replace: false,
    status: ProcessamentoStatus.Stopped,
  },
  certificatesLog: {
    messages: [],
    progress: 0,
    value: 0,
    max: 0,
    replace: false,
    status: ProcessamentoStatus.Stopped,
  },
  siegLog: {
    messages: [],
    progress: 0,
    value: 0,
    max: 0,
    replace: false,
    status: ProcessamentoStatus.Stopped,
  },
  historic: [],
  config: {
    viewUploadedFiles: false,
    timeForProcessing: '00:00',
    timeForConsultingSieg: '00:00',
    directoryDownloadSieg: null,
    apiKeySieg: '',
    emailSieg: null,
    senhaSieg: null,
  },
};

export enum ActionType {
  Auth,
  Directories,
  Loading,
  InvoicesLog,
  CertificatesLog,
  SiegLog,
  ClearInvoicesLog,
  ClearCertificatesLog,
  ClearSiegLog,
  Clear,
  Historic,
  Config,
}

export const StateReducer = (state: IState, action: IAction | IAction[]): IState => {
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
    case ActionType.InvoicesLog:
      return invoicesLogReducer(action);
    case ActionType.CertificatesLog:
      return certificatesLogReducer(action);
    case ActionType.SiegLog:
      return siegLogReducer(action);
    case ActionType.Historic:
      return { ...state, historic: action.payload };
    case ActionType.Config:
      return { ...state, config: { ...state.config, ...action.payload } };
    case ActionType.Clear:
      window.ipcRenderer.send('remove-auth');
      return { ...initialState };
    case ActionType.ClearInvoicesLog:
      return {
        ...state,
        invoicesLog: { ...state.invoicesLog, messages: [] },
      };
    case ActionType.ClearCertificatesLog:
      return {
        ...state,
        certificatesLog: { ...state.invoicesLog, messages: [] },
      };
    case ActionType.ClearSiegLog:
      return {
        ...state,
        siegLog: { ...state.siegLog, messages: [] },
      };
    default:
      return state;
  }

  function invoicesLogReducer(action: IAction) {
    const messages = state.invoicesLog.messages;
    if (action.payload.messages.length > 0) {
      if (action.payload.replace) {
        messages.splice(messages.length - 1, 1);
      }
      messages.push(action.payload.messages);
    }
    return {
      ...state,
      invoicesLog: {
        messages,
        progress: action.payload.progress,
        value: action.payload.value,
        max: action.payload.max,
        status: action.payload.status,
        replace: action.payload.replace,
      },
    };
  }

  function certificatesLogReducer(action: IAction) {
    const messages = state.certificatesLog.messages;
    if (action.payload.messages.length > 0) {
      if (action.payload.replace) {
        messages.splice(messages.length - 1, 1);
      }
      messages.push(action.payload.messages);
    }
    return {
      ...state,
      certificatesLog: {
        messages,
        progress: action.payload.progress,
        value: action.payload.value,
        max: action.payload.max,
        status: action.payload.status,
        replace: action.payload.replace,
      },
    };
  }

  function siegLogReducer(action: IAction) {
    const messages = state.siegLog.messages;
    if (action.payload.messages.length > 0) {
      if (action.payload.replace) {
        messages.splice(messages.length - 1, 1);
      }
      messages.push(action.payload.messages);
    }
    return {
      ...state,
      siegLog: {
        messages,
        progress: action.payload.progress,
        value: action.payload.value,
        max: action.payload.max,
        status: action.payload.status,
        replace: action.payload.replace,
      },
    };
  }
};
