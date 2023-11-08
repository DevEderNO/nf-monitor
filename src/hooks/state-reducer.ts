import { IDirectory } from "../interfaces/directory";
import AsyncStorage from "@react-native-community/async-storage";
import {
  IProcessamento,
  ProcessamentoStatus,
} from "../interfaces/processamento";

export interface IState {
  auth: {
    token: string;
    usuario: any;
  };
  directories: IDirectory[];
  loading: boolean;
  processamento: IProcessamento;
}

export interface IAction {
  type: ActionType;
  payload?: any;
}

export const initialState: IState = {
  auth: {
    token: "",
    usuario: {},
  },
  directories: [],
  loading: false,
  processamento: {
    messages: [],
    progress: 0,
    status: ProcessamentoStatus.Stopped,
  },
};

export enum ActionType {
  Auth,
  Directories,
  Loading,
  Processamento,
  Clear,
}

export const StateReducer = (state: IState, action: IAction): IState => {
  switch (action.type) {
    case ActionType.Auth:
      AsyncStorage.setItem("@NFMonitor:token", action.payload?.token).then();
      AsyncStorage.setItem(
        "@NFMonitor:user",
        JSON.stringify(action.payload?.usuario)
      ).then();
      return { ...state, auth: action.payload };
    case ActionType.Directories:
      AsyncStorage.setItem(
        "@NFMonitor:directories",
        JSON.stringify(action.payload)
      ).then();
      return { ...state, directories: action.payload };
    case ActionType.Loading:
      return { ...state, loading: action.payload };
    case ActionType.Processamento:
      return {
        ...state,
        processamento: {
          messages: [
            ...state.processamento.messages,
            ...action.payload.messages,
          ],
          progress: action.payload.progress,
          status: action.payload.status,
        },
      };
    case ActionType.Clear:
      AsyncStorage.multiRemove(["@NFMonitor:token", "@NFMonitor:user"]).then();
      return { ...initialState };
    default:
      return state;
  }
};
