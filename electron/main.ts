import { app, BrowserWindow, globalShortcut, Menu, nativeImage, Tray } from 'electron';
import path from 'node:path';
import { registerListeners } from './listeners';
import { createWebsocket } from './websocket';
import { autoUpdater } from 'electron-updater';
import { logError } from './services/error-service';
import { ErrorType } from '@prisma/client';
import { stopPowerSaveBlocker } from './lib/power-save';

process.env.DIST = path.join(__dirname, '../dist');
const envVitePublic = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');
process.env.VITE_PUBLIC = envVitePublic;

let win: BrowserWindow | null;
let tray: Tray;
let menuVisible = false;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

app.setAppUserModelId('Monitor');

// Função utilitária para enviar erros ao renderer
function sendErrorToRenderer(title: string, message: string) {
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      try {
        window.webContents.send('error', JSON.stringify({ title, message }));
      } catch (err) {
        console.error('Erro ao enviar mensagem para renderer:', err);
      }
    }
  });
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
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST ?? '', 'index.html'));
    Menu.setApplicationMenu(null);

    // Toggle menu com único registro de shortcut
    globalShortcut.register('CommandOrControl+Shift+Alt+I', () => {
      if (menuVisible) {
        Menu.setApplicationMenu(null);
      } else {
        const defaultMenu = Menu.buildFromTemplate([
          { role: 'fileMenu' },
          { role: 'editMenu' },
          { role: 'viewMenu' },
          { role: 'windowMenu' },
          { role: 'help' },
        ]);
        Menu.setApplicationMenu(defaultMenu);
      }
      menuVisible = !menuVisible;
    });
  }

  const icon = nativeImage.createFromPath(path.join(envVitePublic, 'sittax.png')).resize({ width: 32, height: 32 });

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
      stopPowerSaveBlocker();
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
    sendErrorToRenderer('Erro não tratado', error.message);
  });

  // Intercepta promessas rejeitadas não tratadas
  process.on('unhandledRejection', async reason => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    await logError(error, ErrorType.UnhandledRejection);
    sendErrorToRenderer('Erro não tratado', error.message);
  });

  // Intercepta erros de renderização
  app.on('render-process-gone', async (_event, _webContents, details) => {
    await logError(new Error(`Render process gone: ${details.reason}`), ErrorType.RenderProcessGone);
    sendErrorToRenderer('Erro de renderização', details.reason);
  });

  // Intercepta erros de GPU
  app.on('child-process-gone', async (_event, details) => {
    await logError(new Error(`GPU process gone: ${details.type}`), ErrorType.GPUProcessGone);
    sendErrorToRenderer('Erro de GPU', details.type);
  });

}

app.on('ready', async () => {
  const isSecondInstance = app.requestSingleInstanceLock();
  if (isSecondInstance) {
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
});

// Verificar atualizações a cada 4 horas
setInterval(() => {
  autoUpdater.checkForUpdatesAndNotify();
}, 4 * 60 * 60 * 1000);

autoUpdater.on('update-available', () => {
  win?.webContents.send('update-available', '⚙️ Identificada uma nova versão.');
});

autoUpdater.on('update-downloaded', () => {
  win?.webContents.send('update-downloaded', '🚀 Atualização começará em 5 segundos');
  setTimeout(() => {
    autoUpdater.quitAndInstall();
  }, 5000);
});
