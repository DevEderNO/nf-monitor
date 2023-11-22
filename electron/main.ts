import { app, BrowserWindow, Menu, nativeImage, Tray } from "electron";
import path from "node:path";
import { registerListeners } from "./listeners";
import { createWebsocket } from "./websocket";
import { autoUpdater } from "electron-updater";

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
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, "../public");

let win: BrowserWindow | null;
let tray: Tray;
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];

function createWindow() {
  win = new BrowserWindow({
    height: 600,
    width: 800,
    minHeight: 600,
    minWidth: 800,
    icon: path.join(process.env.VITE_PUBLIC, "sittax.ico"),
    show: !VITE_DEV_SERVER_URL ? false : true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      webSecurity: false,
    },
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST, "index.html"));
    const menu = Menu.buildFromTemplate([]);
    Menu.setApplicationMenu(menu);
  }

  const icon = nativeImage.createFromPath(
    path.join(process.env.VITE_PUBLIC, "sittax.png")
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

  if (!VITE_DEV_SERVER_URL) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath("exe"),
    });
  }
}

app.on("ready", () => {
  registerListeners(win);
  createWindow();
  createWebsocket();
});

autoUpdater.setFeedURL({
  provider: "github",
  owner: "DevEderNO",
  repo: "nf-monitor",
  token: import.meta.env.VITE_GITHUB_TOKEN,
  releaseType: "release",
});

setInterval(() => {
  autoUpdater.checkForUpdatesAndNotify();
}, 300000);

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

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
