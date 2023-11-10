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
  token: string;
  usuario: IUser;
}

const AuthProvider = ({ children }: React.PropsWithChildren) => {
  const { dispatch } = useAppState();
  const navigate = useNavigate();

  const signIn = useCallback(
    async ({ user, password }: SignInCredentials) => {
      dispatch({ type: ActionType.Loading, payload: true });
      try {
        const response = await apiAuth.post<ILogin>("auth/login", {
          usuario: user,
          senha: password,
        });

        const {
          token,
          usuario: {
            id,
            nome,
            sobrenome,
            cpf,
            email,
            phoneNumber,
            ativo,
            emailConfirmed,
            accessFailedCount,
            dataDeCriacao,
            lockoutEnd,
            eUsuarioEmpresa,
            role,
            termoPendente,
            temQueVotarNps,
          },
        } = response.data;

        dispatch({
          type: ActionType.Auth,
          payload: {
            token,
            user: {
              id,
              nome,
              sobrenome,
              cpf,
              email,
              phoneNumber,
              ativo,
              emailConfirmed,
              accessFailedCount,
              dataDeCriacao,
              lockoutEnd,
              eUsuarioEmpresa,
              role: { name: role.name },
              termoPendente,
              temQueVotarNps,
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
