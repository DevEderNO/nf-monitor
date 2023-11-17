import { createContext, useCallback, useContext } from "react";
import { useAppState } from "./state";
import { ActionType } from "./state-reducer";
import { AxiosError } from "axios";
import { useNavigate } from "react-router-dom";

interface SignInCredentials {
  user: string;
  password: string;
}

interface AuthContextData {
  signIn(credentials: SignInCredentials): Promise<void>;
  signOut(): void;
}

export const AuthContext = createContext<AuthContextData>(
  {} as AuthContextData
);

const AuthProvider = ({ children }: React.PropsWithChildren) => {
  const { dispatch } = useAppState();
  const navigate = useNavigate();

  const signIn = useCallback(
    async (credentials: SignInCredentials) => {
      dispatch({ type: ActionType.Loading, payload: true });
      try {
        const auth = await window.ipcRenderer.invoke("signIn", credentials);
        dispatch({
          type: ActionType.Auth,
          payload: auth,
        });
      } catch (error) {
        if (typeof error === typeof AxiosError) {
          console.log("signIn", error);
        }
        throw error;
      } finally {
        dispatch({ type: ActionType.Loading, payload: false });
      }
    },
    [dispatch]
  );

  const signOut = async () => {
    dispatch({ type: ActionType.Clear });
    dispatch({ type: ActionType.Loading, payload: false });
    navigate("/", { replace: true });
  };

  return (
    <AuthContext.Provider value={{ signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

export { useAuth, AuthProvider };
