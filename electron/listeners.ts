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

export async function registerListeners(win: BrowserWindow | null) {
  ipcMain.handle("get-auth", async () => {
    const db: IDb = getDb();
    return {
      user: db.auth.user,
      token: db.auth.token,
      credentials: { user: "", password: "" },
    };
  });

  ipcMain.on("set-auth", (_, auth: IAuth) => {
    if (auth.credentials.password.length > 0) {
      const db: IDb = getDb();
      const passwordHash = encrypt(auth.credentials.password);
      auth.credentials.password = passwordHash;
      db.auth = auth;
      saveDb(db);
    }
  });

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
      directories = Array.from(new Set([...directoriesInDb, ...directories]));
    }
    saveDb({ ...db, directories });
    return directories;
  });

  ipcMain.handle("remove-directory", async (_, directory: string) => {
    const db: IDb = getDb();
    const directoriesInDb = db.directories;
    const directories = directoriesInDb.filter((x) => x.path !== directory);
    saveDb({ ...db, directories });
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
