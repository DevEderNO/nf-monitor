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
import { IDbHistoric } from "@/interfaces/db-historic";
import { format } from "date-fns";

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
    console.log("auth", auth);
    const directories: IDirectory[] = await window.ipcRenderer.invoke(
      "get-directories"
    );
    const timeForProcessing: IDirectory[] = await window.ipcRenderer.invoke(
      "get-timeForProcessing"
    );
    const viewUploadedFiles: boolean = await window.ipcRenderer.invoke(
      "get-viewUploadedFiles"
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

    dispatch({
      type: ActionType.ViewUploadedFiles,
      payload: viewUploadedFiles,
    });

    const historic: IDbHistoric[] = await window.ipcRenderer.invoke(
      "get-historic"
    );

    if (historic.length > 0) {
      console.log("historic", historic);
      console.log(
        historic.map(
          (x) =>
            `${format(x.startDate, "dd/MM/yyyy HH:mm:ss")}${
              x.endDate ? format(x.endDate, " - dd/MM/yyyy HH:mm:ss") : ""
            }`
        )
      );
      dispatch({
        type: ActionType.Historic,
        payload: historic.map(
          (x) =>
            `${format(x.startDate, "dd/MM/yyyy HH:mm:ss")} | ${
              x.endDate
                ? format(x.endDate, " - dd/MM/yyyy HH:mm:ss")
                : "Não finalizado ou interrompido"
            }`
        ),
      });
    }

    if (auth.token && auth.user) {
      console.log("auth", auth);
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
