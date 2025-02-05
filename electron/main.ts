import { app, BrowserWindow, Menu, nativeImage, Tray } from "electron";
import path from "node:path";
import { registerListeners } from "./listeners";
import { createWebsocket } from "./websocket";
import { autoUpdater } from "electron-updater";
import {
  acceptStreamsEula,
  applyMigrations,
  copyMigrations,
} from "./services/file-operation-service";
import { logError } from "./services/error-service";
import { ErrorType } from "@prisma/client";

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, "../dist");
const envVitePublic = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, "../public");
process.env.VITE_PUBLIC = envVitePublic;

let win: BrowserWindow | null;
let tray: Tray;
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];

app.setAppUserModelId("Monitor");

function createWindow() {
  win = new BrowserWindow({
    height: 600,
    width: 800,
    minHeight: 600,
    minWidth: 800,
    icon: path.join(process.env.VITE_PUBLIC ?? "", "sittax.png"),
    show: !VITE_DEV_SERVER_URL ? false : true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST ?? "", "index.html"));
    // const menu = Menu.buildFromTemplate([]);
    // Menu.setApplicationMenu(menu);
  }

  const icon = nativeImage.createFromPath(
    path.join(envVitePublic, "sittax.png")
  );

  tray = new Tray(icon);
  tray.setTitle("NFMonitor");
  tray.setToolTip("NFMonitor");
  const contextMenu = Menu.buildFromTemplate([{ label: "Sair", role: "quit" }]);
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (win) {
      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
      }
    }
  });

  win.on("close", (event) => {
    if (win) {
      event.preventDefault();
      win.hide();
    }
  });

  app.on("before-quit", () => {
    if (win) {
      win.removeAllListeners("close");
      win.close();
    }
  });

  app.on("activate", () => {
    if (win) {
      win.show();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
      win = null;
    }
  });

  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      app.quit();
    }
  });

  // Intercepta erros não tratados
  process.on("uncaughtException", async (error) => {
    await logError(error, ErrorType.UncaughtException);
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send("main-process-message", error);
    });
  });

  // Intercepta promessas rejeitadas não tratadas
  process.on("unhandledRejection", async (reason) => {
    if (reason instanceof Error) {
      await logError(reason, ErrorType.UnhandledRejection);
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send("main-process-message", reason);
      });
    } else {
      await logError(new Error(String(reason)), ErrorType.UnhandledRejection);
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send("main-process-message", reason);
      });
    }
  });

  // Intercepta erros de renderização
  app.on("render-process-gone", async (_event, _webContents, details) => {
    await logError(
      new Error(`Render process gone: ${details.reason}`),
      ErrorType.RenderProcessGone
    );
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send("main-process-message", details.reason);
    });
  });

  // Intercepta erros de GPU
  app.on("child-process-gone", async (_event, details) => {
    await logError(
      new Error(`GPU process gone: ${details.type}`),
      ErrorType.GPUProcessGone
    );
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send("main-process-message", details.type);
    });
  });

  if (!VITE_DEV_SERVER_URL) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath("exe"),
    });
  }
}

app.on("ready", async () => {
  const isSecondInstance = app.requestSingleInstanceLock();
  if (isSecondInstance) {
    await copyMigrations();
    await applyMigrations();
    acceptStreamsEula();
    createWebsocket();
    createWindow();
    registerListeners(win);
    autoUpdater.checkForUpdatesAndNotify();
  } else {
    app.quit();
  }
});

autoUpdater.setFeedURL({
  provider: "github",
  owner: "DevEderNO",
  repo: "nf-monitor",
  releaseType: "release",
});

setInterval(() => {
  autoUpdater.checkForUpdatesAndNotify();
}, 60000);

autoUpdater.on("update-available", () => {
  win?.webContents.send("update-available", "⚙️ Identificada uma nova versão.");
});

autoUpdater.on("update-downloaded", () => {
  win?.webContents.send(
    "update-downloaded",
    "🚀 Atualização começará em 5 segundos"
  );
  setInterval(() => {}, 5000);
  autoUpdater.quitAndInstall();
});
