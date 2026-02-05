import { BrowserWindow, ipcMain, Notification, shell } from 'electron';
import { selectDirectories } from './services/file-operation-service';
import { encrypt } from './lib/cryptography';
import { signIn } from './lib/axios';
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
} from './services/database';
import { IConfig } from './interfaces/config';
import { IDirectory } from './interfaces/directory';
import { IUser } from './interfaces/user';
import { initializeJob } from './services/schedules';

export async function signInSittax(user: string, password: string, encripted: boolean) {
  try {
    const data = await signIn(user, password, encripted);
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
      empresas: Empresas.map(x => ({
        empresaId: x.Id,
        nome: x.Nome,
        cnpj: x.Cnpj,
      })),
    };
    await addAuth(auth);
    return auth;
  } catch (error) {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send(
        'error',
        JSON.stringify({
          title: 'Algo deu errado 😯.',
          message: (error as Error).message,
        })
      );
    });
    return null;
  }
}

export async function registerListeners(win: BrowserWindow | null) {
  ipcMain.handle('get-auth', async () => {
    const auth = await getAuth();
    return auth;
  });

  ipcMain.handle('signIn', async (_, { user, password }: { user: string; password: string }) => {
    return await signInSittax(user, password, false);
  });

  ipcMain.on('remove-auth', async () => {
    await removeAuth();
  });

  ipcMain.handle('get-directories', async () => {
    const directories: Partial<IDirectory>[] = await getDirectories();
    return directories;
  });

  ipcMain.handle('select-directories-invoices', async () => {
    const directories = selectDirectories(win!);
    if (directories.length > 0) {
      directories.forEach(directory => {
        directory.type = 'invoices';
      });
      await addDirectories(directories);
    }
    return await getDirectories();
  });

  ipcMain.handle('select-directories-certificates', async () => {
    const directories = selectDirectories(win!);
    if (directories.length > 0) {
      directories.forEach(directory => {
        directory.type = 'certificates';
      });
      await addDirectories(directories);
    }
    return await getDirectories();
  });

  ipcMain.handle('change-view-uploaded-files', async (_, viewUploadedFiles: boolean) => {
    const data = await getConfiguration();
    return await updateConfiguration({
      ...data,
      viewUploadedFiles: viewUploadedFiles,
    } as IConfig);
  });

  ipcMain.handle('change-remove-uploaded-files', async (_, removeUploadedFiles: boolean) => {
    const data = await getConfiguration();
    return await updateConfiguration({
      ...data,
      removeUploadedFiles: removeUploadedFiles,
    } as IConfig);
  });

  ipcMain.handle('change-time-for-processing', async (_, timeForProcessing: string) => {
    const data = await getConfiguration();

    const config = await updateConfiguration({
      ...data,
      timeForProcessing: timeForProcessing,
    } as IConfig);

    initializeJob();

    return config;
  });

  ipcMain.handle('remove-directory', async (_, directory: string, type: 'invoices' | 'certificates') => {
    await removeDirectory(directory, type);
    await removeFiles(directory);
    return await getDirectories();
  });

  ipcMain.handle('get-config', async () => {
    const configuration: IConfig | null = await getConfiguration();
    return configuration;
  });

  ipcMain.handle('get-historic', async () => {
    const historic = (await getHistoric()) ?? [];
    return historic;
  });

  ipcMain.on('initialize-job', () => {
    initializeJob();
  });

  ipcMain.on('clear-historic', async () => {
    await clearHistoric();
  });

  ipcMain.on('show-notification', async (_, { title, body }) => {
    new Notification({ title, body }).show();
  });

  ipcMain.handle('open-sittax-web', async () => {
    const auth = await getAuth();
    if (auth?.token) {
      const url = `https://app.sittax.com.br/autologin?token=${encodeURIComponent(auth.token)}`;
      await shell.openExternal(url);
      return true;
    }
    return false;
  });
}
