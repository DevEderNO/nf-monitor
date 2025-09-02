import { BrowserWindow, ipcMain, Notification } from 'electron';
import { selectDirectories } from './services/file-operation-service';
import { updateJobs } from './services/schedules';
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
  removeFilesNotSended,
  updateConfiguration,
} from './services/database';
import { IConfig } from './interfaces/config';
import { IDirectory } from './interfaces/directory';
import { IUser } from './interfaces/user';

export async function signInSittax(user: string, password: string, encripted: boolean) {
  try {
  const data = await signIn(user, password, encripted);
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
    empresas: Empresas.map(x => ({
      empresaId: x.Id,
      nome: x.Nome,
      cnpj: x.Cnpj,
    })),
    configuration: {
      apiKeySieg: ApiKeySieg ?? '',
      emailSieg: EmailSieg ?? '',
      senhaSieg: SenhaSieg ?? '',
    },
  };
    await addAuth(auth);
    return auth;
  } catch (error) {
    BrowserWindow.getAllWindows().forEach((window: any) => {
      window.webContents.send('error', JSON.stringify({
        title: 'Algo deu errado 😯.',
        message: (error as Error).message
      }));
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

  ipcMain.handle('select-directory-download-sieg', async () => {
    const directory = selectDirectories(win!, ['openDirectory']);
    const config = await getConfiguration();
    if (directory.length > 0) {
      return await updateConfiguration({
        ...config,
        directoryDownloadSieg: directory.at(0)?.path,
      } as IConfig);
    }
    return config;
  });

  ipcMain.handle('clear-directory-download-sieg', async (_, clearFiles: boolean) => {
    const data = await getConfiguration();
    if (clearFiles && data?.directoryDownloadSieg) {
      await removeFilesNotSended(data.directoryDownloadSieg.replace(/\//g, '\\'));
    }
    const config = await updateConfiguration({
      ...data,
      directoryDownloadSieg: null,
      timeForConsultingSieg: '00:00',
    } as IConfig);
    updateJobs();
    return config;
  });

  ipcMain.handle('change-view-uploaded-files', async (_, viewUploadedFiles: boolean) => {
    const data = await getConfiguration();
    return await updateConfiguration({
      ...data,
      viewUploadedFiles: viewUploadedFiles,
    } as IConfig);
  });

  ipcMain.handle('change-time-for-processing', async (_, timeForProcessing: string) => {
    const data = await getConfiguration();
    return await updateConfiguration({
      ...data,
      timeForProcessing: timeForProcessing,
    } as IConfig);
  });

  ipcMain.handle('change-time-for-consulting-sieg', async (_, timeForConsultingSieg: string) => {
    const data = await getConfiguration();
    return await updateConfiguration({
      ...data,
      timeForConsultingSieg: timeForConsultingSieg,
    } as IConfig);
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
    updateJobs();
  });

  ipcMain.on('clear-historic', async () => {
    await clearHistoric();
  });

  ipcMain.on('show-notification', async (_, { title, body }) => {
    new Notification({ title, body }).show();
  });
}
