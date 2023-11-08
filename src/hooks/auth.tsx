import { createContext, useCallback, useContext } from "react";
import { apiAuth } from "@lib/axios";
import { useAppState } from "./state";
import { ActionType } from "./state-reducer";
import { AxiosError } from "axios";

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

  const signIn = useCallback(
    async ({ user, password }: SignInCredentials) => {
      dispatch({ type: ActionType.Loading, payload: true });
      try {
        const response = await apiAuth.post("/api/auth/login", {
          usuario: user,
          senha: password,
        });

        const { token, usuario } = response.data;

        dispatch({
          type: ActionType.Auth,
          payload: { token, usuario },
        });
      } catch (error) {
        if (typeof error === typeof AxiosError) {
          console.log(error);
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
