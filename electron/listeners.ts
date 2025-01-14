import { BrowserWindow, ipcMain } from "electron";
import {
  listDirectory,
  selectDirectories,
} from "./services/file-operation-service";
import { initializeJob, updateJob } from "./services/schedules";
import { encrypt } from "./lib/cryptography";
import { signIn } from "./lib/axios";
import {
  addAuth,
  addDirectories,
  clearHistoric,
  existsDirectory,
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
    return {
      user: auth?.username,
      token: auth?.token,
      credentials: { user: "", password: "" },
    };
  });

  ipcMain.handle(
    "signIn",
    async (_, { user, password }: { user: string; password: string }) => {
      const data = await signIn(user, password);
      const {
        Token,
        Escritorio: { Usuarios, Empresas },
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
          userId: Id,
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
        } as IUser,
        empresas: Empresas.map((x) => ({
          empresaId: x.Id,
          nome: x.Nome,
          cnpj: x.Cnpj,
        })),
      };
      addAuth(auth);
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
      const newDirectories = directories.filter((x) => existsDirectory(x.path));
      if (newDirectories) {
        await addDirectories(newDirectories);
      }
    }
    return await getDirectories();
  });

  ipcMain.handle("remove-directory", async (_, directory: string) => {
    await removeDirectory(directory);
    await removeFiles(directory);
    return await getDirectories();
  });

  ipcMain.handle("list-directory", async (_, directoryPath) => {
    return listDirectory(directoryPath);
  });

  ipcMain.on("set-timeForProcessing", async (_, timeForProcessing) => {
    const configuration: IConfig | null = await getConfiguration();
    updateJob(timeForProcessing);
    if (configuration) {
      configuration.timeForProcessing = timeForProcessing;
      await updateConfiguration(configuration);
    }
  });

  ipcMain.on("set-viewUploadedFiles", async (_, viewUploadedFiles) => {
    const configuration: IConfig | null = await getConfiguration();
    if (configuration) {
      configuration.viewUploadedFiles = viewUploadedFiles;
      await updateConfiguration(configuration);
    }
  });

  ipcMain.handle("get-timeForProcessing", async () => {
    const configuration: IConfig | null = await getConfiguration();
    return configuration?.timeForProcessing ?? "00:00";
  });

  ipcMain.handle("get-viewUploadedFiles", async () => {
    const configuration: IConfig | null = await getConfiguration();
    return configuration?.viewUploadedFiles ?? false;
  });

  ipcMain.handle("get-historic", async () => {
    return await getHistoric();
  });

  ipcMain.on("initialize-job", () => {
    initializeJob();
  });

  ipcMain.on("clear-historic", async () => {
    await clearHistoric();
  });
}
