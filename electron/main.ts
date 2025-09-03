import { app, BrowserWindow, globalShortcut, Menu, MenuItemConstructorOptions, nativeImage, Tray } from 'electron';
import path from 'node:path';
import { registerListeners } from './listeners';
import { createWebsocket } from './websocket';
import { autoUpdater } from 'electron-updater';
import { acceptStreamsEula, applyMigrations, copyMigrations, recicleDb } from './services/file-operation-service';
import { logError } from './services/error-service';
import { ErrorType } from '@prisma/client';
import { powerSaveBlocker } from 'electron';
import { sendToAllRenderers } from './lib/ipc';

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist');
const envVitePublic = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');
process.env.VITE_PUBLIC = envVitePublic;

let win: BrowserWindow | null;
let tray: Tray;
let menuAtivo = false;
const isMac = process.platform === 'darwin';

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

app.setAppUserModelId('Monitor');

// Impede que o sistema entre em suspensão
const id = powerSaveBlocker.start('prevent-app-suspension');

const criarMenuPadrao = () => Menu.buildFromTemplate([
  ...(isMac ? [{ role: 'appMenu' }] : []) as MenuItemConstructorOptions[],
  { role: 'fileMenu' },
  { role: 'editMenu' },
  { role: 'viewMenu' },
  { role: 'windowMenu' },
  { role: 'help' },
]);

const criarMenuMinimoMac = () => Menu.buildFromTemplate([
  {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ]
  }
]);

function aplicarEstadoDoMenu() {
  if (menuAtivo) {
    Menu.setApplicationMenu(criarMenuPadrao());
    if (!isMac) {
      BrowserWindow.getAllWindows().forEach(w => {
        w.setAutoHideMenuBar(false);
        w.setMenuBarVisibility(true);
      });
    }
    sendToAllRenderers('info', { title: 'Menu ativado', message: 'O menu da aplicação foi ativado', type: 'background' });
  } else {
    if (isMac) {
      Menu.setApplicationMenu(criarMenuMinimoMac()); // “remover” no mac = menu mínimo
    } else {
      Menu.setApplicationMenu(null);
      BrowserWindow.getAllWindows().forEach(w => {
        w.setAutoHideMenuBar(true);   // Alt não exibe mais
        w.setMenuBarVisibility(false);
      });
    }
    sendToAllRenderers('info', { title: 'Menu desativado', message: 'O menu da aplicação foi desativado', type: 'background' });
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1280,
    minHeight: 720,
    icon: path.join(process.env.VITE_PUBLIC ?? '', 'sittax.png'),
    show: !VITE_DEV_SERVER_URL ? false : true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      backgroundThrottling: false,
      devTools: true,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    menuAtivo = true;
  }
  
  win.loadFile(path.join(process.env.DIST ?? '', 'index.html'));
  Menu.setApplicationMenu(null);

  globalShortcut.register('CommandOrControl+Shift+I', () => {
    menuAtivo = !menuAtivo;
    aplicarEstadoDoMenu();
  });

  const icon = nativeImage.createFromPath(path.join(envVitePublic, 'sittax.png'));

  tray = new Tray(icon);
  tray.setTitle('NFMonitor');
  tray.setToolTip('NFMonitor');
  const contextMenu = Menu.buildFromTemplate([{ label: 'Sair', role: 'quit' }]);
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (win) {
      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
      }
    }
  });

  win.on('close', event => {
    if (win) {
      event.preventDefault();
      win.hide();
    }
  });

  app.on('before-quit', () => {
    if (win) {
      win.removeAllListeners('close');
      win.close();
    }
  });

  app.on('activate', () => {
    if (win) {
      win.show();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      powerSaveBlocker.stop(id);
      app.quit();
      win = null;
    }
  });

  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      app.quit();
    }
  });

  // Intercepta erros não tratados
  process.on('uncaughtException', async error => {
    await logError(error, ErrorType.UncaughtException);
    sendToAllRenderers('error', {
      title: 'Erro não tratado',
      message: (error as Error).message,
      type: 'background',
    });
  });

  // Intercepta promessas rejeitadas não tratadas
  process.on('unhandledRejection', async reason => {
    if (reason instanceof Error) {
      await logError(reason, ErrorType.UnhandledRejection);
      sendToAllRenderers('error', {
        title: 'Erro não tratado',
        message: (reason as Error).message,
        type: 'background',
      });
    } else {
      await logError(new Error(String(reason)), ErrorType.UnhandledRejection);
      sendToAllRenderers('error', {
        title: 'Erro não tratado',
        message: (reason as Error).message,
        type: 'background',
      });
    }
  });

  // Intercepta erros de renderização
  app.on('render-process-gone', async (_event, _webContents, details) => {
    await logError(new Error(`Render process gone: ${details.reason}`), ErrorType.RenderProcessGone);
    sendToAllRenderers('error', {
      title: 'Erro de renderização',
      message: details.reason,
      type: 'background',
    });
  });

  // Intercepta erros de GPU
  app.on('child-process-gone', async (_event, details) => {
    await logError(new Error(`GPU process gone: ${details.type}`), ErrorType.GPUProcessGone);
    sendToAllRenderers('error', {
      title: 'Erro de GPU',
      message: details.type,
      type: 'background',
    });
  });

  if (!VITE_DEV_SERVER_URL) {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true, // Mantém oculto no início
      path: app.getPath('exe'),
    });
  }

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });
}

app.on('ready', async () => {
  await copyMigrations();
  await applyMigrations();
  await recicleDb();

  const isSecondInstance = app.requestSingleInstanceLock();
  if (isSecondInstance) {
    if (process.platform === 'win32') {
      acceptStreamsEula();
    }

    createWebsocket();
    createWindow();
    registerListeners(win);
    autoUpdater.checkForUpdatesAndNotify();
  } else {
    app.quit();
  }
});

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'DevEderNO',
  repo: 'nf-monitor',
  releaseType: 'release',
});

setInterval(() => {
  autoUpdater.checkForUpdatesAndNotify();
}, 60000);

autoUpdater.on('update-available', () => {
  sendToAllRenderers('update-available', {
    title: '⚙️ Identificada uma nova versão.',
    message: '⚙️ Identificada uma nova versão.',
    type: 'foreground',
  });
});

autoUpdater.on('update-downloaded', () => {
  sendToAllRenderers('update-downloaded', {
    title: '🚀 Atualização começará em 5 segundos',
    message: '🚀 Atualização começará em 5 segundos',
    type: 'foreground',
  });
  setInterval(() => {}, 5000);
  autoUpdater.quitAndInstall();
});
