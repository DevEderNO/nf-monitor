import { BrowserWindow, ipcMain } from "electron";
import { IDb } from "./interfaces/db";
import {
  getDb,
  getDbHistoric,
  listDirectory,
  saveDb,
  selectDirectories,
} from "./services/file-operation-service";
import { IAuth } from "./interfaces/auth";
import { IDbHistoric } from "./interfaces/db-historic";
import { initializeJob, updateJob } from "./services/schedules";
import { encrypt } from "./lib/cryptography";
import { signIn } from "./lib/axios";

export async function registerListeners(win: BrowserWindow | null) {
  ipcMain.handle("get-auth", async () => {
    const db: IDb = getDb();
    return {
      user: db.auth.user,
      token: db.auth.token,
      credentials: { user: "", password: "" },
    };
  });

  ipcMain.handle(
    "signIn",
    async (_, { user, password }: { user: string; password: string }) => {
      const db = getDb();
      const data = await signIn(user, password);
      const {
        Token,
        Escritorio: { Usuarios },
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
      } = Usuarios[0];

      const passwordHash = encrypt(password);

      db.auth = {
        token: Token,
        credentials: {
          user,
          password: passwordHash,
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
          EPrimeiroAcesso,
        },
      };
      saveDb(db);
      return db.auth;
    }
  );

  ipcMain.on("remove-auth", () => {
    const db: IDb = getDb();
    db.auth = {} as IAuth;
    saveDb(db);
  });

  ipcMain.handle("get-directories", async () => {
    const db: IDb = getDb();
    return db.directories;
  });

  ipcMain.handle("select-directories", async () => {
    const db: IDb = getDb();
    const directoriesInDb = db.directories;
    let directories = selectDirectories(win!);
    if (directories.length > 0) {
      const newDirectories = directories.filter(
        (x) => !directoriesInDb.find((y) => y.path === x.path)
      );
      directories =
        newDirectories.length > 0
          ? [...directoriesInDb, ...newDirectories]
          : directoriesInDb;
      saveDb({ ...db, directories });
      return directories;
    }
    return directoriesInDb;
  });

  ipcMain.handle("remove-directory", async (_, directory: string) => {
    const db: IDb = getDb();
    const directoriesInDb = db.directories;
    const directories = directoriesInDb.filter(
      (x) => !x.path.includes(directory)
    );
    const filesInDb = db.files;
    const files = filesInDb.filter(
      (x) => !x.filepath.includes(directory) || x.wasSend
    );
    console.log(files);
    saveDb({ ...db, directories, files });
    return directories;
  });

  ipcMain.handle("list-directory", async (_, directoryPath) => {
    return listDirectory(directoryPath);
  });

  ipcMain.on("set-timeForProcessing", async (_, timeForProcessing) => {
    const db: IDb = getDb();
    db.timeForProcessing = timeForProcessing;
    updateJob(timeForProcessing);
    saveDb(db);
  });

  ipcMain.handle("get-timeForProcessing", async () => {
    const db: IDb = getDb();
    return db.timeForProcessing;
  });

  ipcMain.handle("get-historic", async () => {
    const dbHistoric: IDbHistoric = getDbHistoric();
    return dbHistoric.executions.map(({ id, startDate, endDate }) => ({
      id,
      startDate,
      endDate,
    }));
  });

  ipcMain.on("initialize-job", () => {
    initializeJob();
  });
}
