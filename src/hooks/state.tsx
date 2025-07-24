import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { ActionType, IAction, IState, StateReducer, initialState } from './state-reducer';
import { useNavigate } from 'react-router-dom';
import { IDirectory } from '@/interfaces/directory';
import { IAuth } from '@/interfaces/auth';
import { IDbHistoric } from '@/interfaces/db-historic';
import { format } from 'date-fns';
import { IConfig } from '@/interfaces/config';

interface StateContextData {
  state: IState;
  dispatch: (action: IAction | IAction[]) => void;
}

const StateContext = createContext<StateContextData>({} as StateContextData);

const StateProvider = ({ children }: React.PropsWithChildren) => {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(StateReducer, initialState);

  async function loadStoragedData() {
    dispatch({ type: ActionType.Loading, payload: true });

    const auth: IAuth = await window.ipcRenderer.invoke('get-auth');
    const config: IConfig = await window.ipcRenderer.invoke('get-config');
    const directories: IDirectory[] = await window.ipcRenderer.invoke('get-directories');
    window.ipcRenderer.send('initialize-job');
    const historic: IDbHistoric[] = await window.ipcRenderer.invoke('get-historic');

    dispatch([
      {
        type: ActionType.Auth,
        payload: auth,
      },
      {
        type: ActionType.Config,
        payload: config,
      },
      {
        type: ActionType.Directories,
        payload: directories,
      },
      {
        type: ActionType.Loading,
        payload: false,
      },
      {
        type: ActionType.Historic,
        payload: historic.map(
          x =>
            `${format(x.startDate, 'dd/MM/yyyy HH:mm:ss')}${
              x.endDate ? format(x.endDate, ' - dd/MM/yyyy HH:mm:ss') : ' - Não finalizado ou interrompido'
            }`
        ),
      },
    ]);
    if (auth?.token && auth?.user) {
      navigate('/upload-invoices');
    }
  }

  useEffect(() => {
    loadStoragedData();
  }, []);

  useEffect(() => {
    if (state.auth?.token?.length > 0) loadStoragedData();
  }, [state.auth?.token?.length]);

  return <StateContext.Provider value={{ state, dispatch }}>{children}</StateContext.Provider>;
};

function useAppState() {
  const context = useContext(StateContext);
  return context;
}

export { useAppState, StateProvider };
