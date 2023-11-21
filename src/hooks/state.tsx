import React, { createContext, useContext, useEffect, useReducer } from "react";
import {
  ActionType,
  IAction,
  IState,
  StateReducer,
  initialState,
} from "./state-reducer";
import { useNavigate } from "react-router-dom";
import { IDirectory } from "@/interfaces/directory";
import { IAuth } from "@/interfaces/auth";
import { IExecution } from "@/interfaces/db-historic";
import { format, parseISO } from "date-fns";

interface StateContextData {
  state: IState;
  dispatch: (action: IAction) => void;
}

const StateContext = createContext<StateContextData>({} as StateContextData);

const StateProvider = ({ children }: React.PropsWithChildren) => {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(StateReducer, initialState);

  async function loadStoragedData() {
    dispatch({ type: ActionType.Loading, payload: true });

    const auth: IAuth = await window.ipcRenderer.invoke("get-auth");
    const directories: IDirectory[] = await window.ipcRenderer.invoke(
      "get-directories"
    );
    const timeForProcessing: IDirectory[] = await window.ipcRenderer.invoke(
      "get-timeForProcessing"
    );

    if (directories) {
      dispatch({
        type: ActionType.Directories,
        payload: directories,
      });
    }

    if (timeForProcessing) {
      dispatch({
        type: ActionType.TimeForProcessing,
        payload: timeForProcessing,
      });
      window.ipcRenderer.send("initialize-job");
    }

    const historic: IExecution[] = await window.ipcRenderer.invoke(
      "get-historic"
    );

    if (historic.length > 0) {
      dispatch({
        type: ActionType.Historic,
        payload: historic.map(
          (x) =>
            `${format(
              parseISO(x.startDate.toString()),
              "dd/MM/yyyy HH:mm:ss"
            )}${
              x.endDate
                ? format(
                    parseISO(x.endDate.toString()),
                    " - dd/MM/yyyy HH:mm:ss"
                  )
                : ""
            }`
        ),
      });
    }

    if (auth.token && auth.user) {
      dispatch({
        type: ActionType.Auth,
        payload: auth,
      });
      navigate("/dashboard");
    }

    dispatch({ type: ActionType.Loading, payload: false });
  }

  useEffect(() => {
    loadStoragedData();
  }, []);
  
  useEffect(() => {
    if (state.auth?.token?.length > 0) loadStoragedData();
  }, [state.auth?.token?.length]);

  return (
    <StateContext.Provider value={{ state, dispatch }}>
      {children}
    </StateContext.Provider>
  );
};

function useAppState() {
  const context = useContext(StateContext);
  return context;
}

export { useAppState, StateProvider };
