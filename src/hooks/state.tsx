import React, { createContext, useContext, useEffect, useReducer } from "react";
import {
  ActionType,
  IAction,
  IState,
  StateReducer,
  initialState,
} from "./state-reducer";
import AsyncStorage from "@react-native-community/async-storage";
import { useNavigate } from "react-router-dom";

interface StateContextData {
  state: IState;
  dispatch: (action: IAction) => void;
}

const StateContext = createContext<StateContextData>({} as StateContextData);

const StateProvider = ({ children }: React.PropsWithChildren) => {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(StateReducer, initialState);

  useEffect(() => {
    async function loadStoragedData() {
      dispatch({ type: ActionType.Loading, payload: true });
      const [[, token], [, user], [, directories]] =
        await AsyncStorage.multiGet([
          "@NFMonitor:token",
          "@NFMonitor:user",
          "@NFMonitor:directories",
        ]);

      if (directories) {
        dispatch({
          type: ActionType.Directories,
          payload: JSON.parse(directories),
        });
      }

      if (token && user) {
        dispatch({
          type: ActionType.Auth,
          payload: { ...initialState.auth, token, usuario: JSON.parse(user) },
        });
        navigate("/dashboard");
      }

      dispatch({ type: ActionType.Loading, payload: false });
    }

    loadStoragedData();
  }, []);

  useEffect(() => {
    async function loadStoragedData() {
      dispatch({ type: ActionType.Loading, payload: true });
      const [[, directories]] = await AsyncStorage.multiGet([
        "@NFMonitor:directories",
      ]);

      if (directories && state?.auth?.token) {
        dispatch({
          type: ActionType.Directories,
          payload: JSON.parse(directories),
        });
      }
      dispatch({ type: ActionType.Loading, payload: false });
    }

    loadStoragedData();
  }, [state?.auth?.token]);

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
