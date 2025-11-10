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
    message: '',
    progress: 0,
    value: 0,
    max: 0,
    replace: false,
    status: ProcessamentoStatus.Stopped,
  },
  certificatesLog: {
    message: '',
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
  },
};

export enum ActionType {
  Auth,
  Directories,
  Loading,
  InvoicesLog,
  CertificatesLog,
  ClearInvoicesLog,
  ClearCertificatesLog,
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
      return { ...state, invoicesLog: { ...action.payload } };
    case ActionType.CertificatesLog:
      return {
        ...state,
        certificatesLog: { ...action.payload },
      };
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
        invoicesLog: { ...state.invoicesLog, message: '' },
      };
    case ActionType.ClearCertificatesLog:
      return {
        ...state,
        certificatesLog: { ...state.invoicesLog, message: '' },
      };
    default:
      return state;
  }
};
