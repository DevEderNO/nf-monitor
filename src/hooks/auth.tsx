import { createContext, useCallback, useContext } from "react";
import { apiAuth } from "@lib/axios";
import { useAppState } from "./state";
import { ActionType } from "./state-reducer";
import { AxiosError } from "axios";
import { IUser } from "@/interfaces/user";
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

interface ILogin {
  Escritorio: {
    Id: string;
    Nome: string;
    Usuarios: IUser[];
  };
  Token: string;
}

const AuthProvider = ({ children }: React.PropsWithChildren) => {
  const { dispatch } = useAppState();
  const navigate = useNavigate();

  const signIn = useCallback(
    async ({ user, password }: SignInCredentials) => {
      dispatch({ type: ActionType.Loading, payload: true });
      try {
        const response = await apiAuth.get<ILogin>(`auth/logar-nfe-monitor`, {
          params: {
            usuario: user,
            senha: password,
          },
        });

        const {
          Token,
          Escritorio: { Usuarios },
        } = response.data;

        const {
          Id,
          Nome,
          Sobrenome,
          Cpf,
          Email,
          PhoneNumber,
          Ativo,
          EmailConfirmed,
          AccessFailedCount,
          DataDeCriacao,
          LockoutEnd,
          EUsuarioEmpresa,
          Role,
        } = Usuarios[0];
        dispatch({
          type: ActionType.Auth,
          payload: {
            token: Token,
            credentials: {
              user, password
            },
            user: {
              Id,
              Nome,
              Sobrenome,
              Cpf,
              Email,
              PhoneNumber,
              Ativo,
              EmailConfirmed,
              AccessFailedCount,
              DataDeCriacao,
              LockoutEnd,
              EUsuarioEmpresa,
              Role,
            },
          },
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
