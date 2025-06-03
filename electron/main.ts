import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  nativeImage,
  Tray,
} from "electron";
import path from "node:path";
import { registerListeners } from "./listeners";
import { createWebsocket } from "./websocket";
import { autoUpdater } from "electron-updater";
import {
  applyMigrations,
  copyMigrations,
  recicleDb,
} from "./services/file-operation-service";
import { logError } from "./services/error-service";
import { ErrorType } from "@prisma/client";
import { powerSaveBlocker } from "electron";

process.env.DIST = path.join(__dirname, "../dist");
const envVitePublic = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, "../public");
process.env.VITE_PUBLIC = envVitePublic;

let win: BrowserWindow | null;
let tray: Tray;

const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];

app.setAppUserModelId("Monitor");

const id = powerSaveBlocker.start("prevent-app-suspension");
let triedAzure = false;
let triedGitHub = false;
let updateCheckInProgress = false;

function resetUpdateFlags() {
  triedAzure = false;
  triedGitHub = false;
  updateCheckInProgress = false;
}

function checkForUpdatesWithFallback() {
  if (updateCheckInProgress) return;

  updateCheckInProgress = true;

  if (!triedAzure) {
    triedAzure = true;
    autoUpdater.setFeedURL({
      provider: "generic",
      url: "https://dev.azure.com/Sittax/Sittax/nf-monitor/releases:latest",
    });
    autoUpdater.checkForUpdatesAndNotify();
  } else if (!triedGitHub) {
    triedGitHub = true;
    autoUpdater.setFeedURL({
      provider: "github",
      owner: "DevEderNO",
      repo: "nf-monitor",
      releaseType: "release",
    });
    autoUpdater.checkForUpdatesAndNotify();
  } else {
    updateCheckInProgress = false;
  }
}

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
      backgroundThrottling: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST ?? "", "index.html"));
    Menu.setApplicationMenu(null);
    const toggleMenu = () => {
      if (Menu.getApplicationMenu()) {
        Menu.setApplicationMenu(null);
      } else {
        const defaultMenu = Menu.buildFromTemplate([
          { role: "fileMenu" },
          { role: "editMenu" },
          { role: "viewMenu" },
          { role: "windowMenu" },
          { role: "help" },
        ]);
        Menu.setApplicationMenu(defaultMenu);
      }
    };

    globalShortcut.register("Ctrl+Q", toggleMenu);
  }

  const icon = nativeImage.createFromPath(
    path.join(envVitePublic, "sittax.png"),
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
      powerSaveBlocker.stop(id);
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

  process.on("uncaughtException", async (error) => {
    await logError(error, ErrorType.UncaughtException);
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send("main-process-message", error);
    });
  });

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

  app.on("render-process-gone", async (_event, _webContents, details) => {
    await logError(
      new Error(`Render process gone: ${details.reason}`),
      ErrorType.RenderProcessGone,
    );
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send("main-process-message", details.reason);
    });
  });

  app.on("child-process-gone", async (_event, details) => {
    await logError(
      new Error(`GPU process gone: ${details.type}`),
      ErrorType.GPUProcessGone,
    );
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send("main-process-message", details.type);
    });
  });

  if (!VITE_DEV_SERVER_URL) {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
      path: app.getPath("exe"),
    });
  }
}

autoUpdater.on("checking-for-update", () => {
  win?.webContents.send("update-checking", "🔍 Verificando atualizações...");
});

autoUpdater.on("update-available", () => {
  updateCheckInProgress = false;
  win?.webContents.send("update-available", "⚙️ Identificada uma nova versão.");
});

autoUpdater.on("update-not-available", (info) => {
  console.log("Update not available:", info);
  updateCheckInProgress = false;
  win?.webContents.send(
    "update-not-available",
    "✅ Aplicação está atualizada.",
  );
});

autoUpdater.on("error", () => {
  if (!triedGitHub) {
    setTimeout(() => {
      checkForUpdatesWithFallback();
    }, 1000);
  } else {
    updateCheckInProgress = false;
    win?.webContents.send(
      "update-error",
      "❌ Falha ao buscar atualizações em ambos os servidores.",
    );
  }
});

autoUpdater.on("download-progress", (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + " - Downloaded " + progressObj.percent + "%";
  log_message =
    log_message +
    " (" +
    progressObj.transferred +
    "/" +
    progressObj.total +
    ")";
  console.log(log_message);

  win?.webContents.send("update-download-progress", {
    percent: Math.round(progressObj.percent),
    transferred: progressObj.transferred,
    total: progressObj.total,
    bytesPerSecond: progressObj.bytesPerSecond,
  });
});

autoUpdater.on("update-downloaded", (info) => {
  console.log("Update downloaded:", info);
  updateCheckInProgress = false;

  win?.webContents.send(
    "update-downloaded",
    "🚀 Atualização baixada! Reiniciando em 5 segundos...",
  );

  setTimeout(() => {
    autoUpdater.quitAndInstall();
  }, 5000);
});

app.on("ready", async () => {
  const isSecondInstance = app.requestSingleInstanceLock();
  if (isSecondInstance) {
    await copyMigrations();
    await applyMigrations();
    await recicleDb();
    createWebsocket();
    createWindow();
    registerListeners(win);

    setTimeout(() => {
      checkForUpdatesWithFallback();
    }, 3000);
  } else {
    app.quit();
  }
});

setInterval(() => {
  resetUpdateFlags();
  checkForUpdatesWithFallback();
}, 60000);

app.on("web-contents-created", (_, webContents) => {
  webContents.on("ipc-message", (_, channel) => {
    if (channel === "check-for-updates") {
      resetUpdateFlags();
      checkForUpdatesWithFallback();
    }
  });
});
