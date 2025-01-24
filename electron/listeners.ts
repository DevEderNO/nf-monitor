import { BrowserWindow, ipcMain } from "electron";
import {
  listDirectory,
  selectDirectories,
} from "./services/file-operation-service";
import { updateJobs } from "./services/schedules";
import { encrypt } from "./lib/cryptography";
import { signIn } from "./lib/axios";
import {
  addAuth,
  addDirectories,
  clearHistoric,
  getAuth,
  getConfiguration,
  getDirectories,
  getHistoric,
  removeAuth,
  removeDirectory,
  removeFiles,
  updateConfiguration,
} from "./services/database";
import { IConfig } from "./interfaces/config";
import { IDirectory } from "./interfaces/directory";
import { IUser } from "./interfaces/user";

export async function registerListeners(win: BrowserWindow | null) {
  ipcMain.handle("get-auth", async () => {
    const auth = await getAuth();
    return auth;
  });

  ipcMain.handle(
    "signIn",
    async (_, { user, password }: { user: string; password: string }) => {
      const data = await signIn(user, password);
      const {
        Token,
        Escritorio: { Usuarios, Empresas, ApiKeySieg, EmailSieg, SenhaSieg },
      } = data;

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
        EPrimeiroAcesso,
        Nivel,
      } = Usuarios[0];

      const passwordHash = encrypt(password);

      const auth = {
        token: Token,
        username: user,
        name: Nome,
        password: passwordHash,
        user: {
          userId: Id.toString(),
          nome: Nome,
          sobrenome: Sobrenome,
          cpf: Cpf,
          email: Email,
          phoneNumber: PhoneNumber,
          ativo: Ativo,
          emailConfirmed: EmailConfirmed,
          accessFailedCount: AccessFailedCount,
          dataDeCriacao: DataDeCriacao,
          lockoutEnd: LockoutEnd,
          eUsuarioEmpresa: EUsuarioEmpresa,
          role: Role,
          ePrimeiroAcesso: EPrimeiroAcesso,
          nivel: Nivel,
        } as IUser,
        empresas: Empresas.map((x) => ({
          empresaId: x.Id,
          nome: x.Nome,
          cnpj: x.Cnpj,
        })),
        configuration: {
          apiKeySieg: ApiKeySieg ?? "",
          emailSieg: EmailSieg ?? "",
          senhaSieg: SenhaSieg ?? "",
        },
      };
      await addAuth(auth);
      return auth;
    }
  );

  ipcMain.on("remove-auth", async () => {
    await removeAuth();
  });

  ipcMain.handle("get-directories", async () => {
    const directories: Partial<IDirectory>[] = (await getDirectories()) ?? [];
    return directories;
  });

  ipcMain.handle("select-directories", async () => {
    let directories = selectDirectories(win!);
    if (directories.length > 0) {
      await addDirectories(directories);
    }
    return await getDirectories();
  });

  ipcMain.handle("select-directory-download-sieg", async () => {
    let directory = selectDirectories(win!, ["openDirectory"]);
    if (directory.length > 0) {
      return directory.at(0);
    }
    return null;
  });

  ipcMain.handle("remove-directory", async (_, directory: string) => {
    await removeDirectory(directory);
    await removeFiles(directory);
    return await getDirectories();
  });

  ipcMain.handle("list-directory", async (_, directoryPath) => {
    return listDirectory(directoryPath);
  });

  ipcMain.handle("get-config", async () => {
    const configuration: IConfig | null = await getConfiguration();
    return configuration;
  });

  ipcMain.on("set-config", async (_, config) => {
    await updateConfiguration(config);
    updateJobs();
  });

  ipcMain.handle("get-historic", async () => {
    const historic = (await getHistoric()) ?? [];
    return historic;
  });

  ipcMain.on("initialize-job", () => {
    updateJobs();
  });

  ipcMain.on("clear-historic", async () => {
    await clearHistoric();
  });
}
