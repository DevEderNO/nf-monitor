import { app, BrowserWindow, globalShortcut, Menu, nativeImage, Tray } from 'electron';
import path from 'node:path';
import { registerListeners } from './listeners';
import { createWebsocket } from './websocket';
import { autoUpdater } from 'electron-updater';
import { logError } from './services/error-service';
import { ErrorType } from '@prisma/client';
import { powerSaveBlocker } from 'electron';

process.env.DIST = path.join(__dirname, '../dist');
const envVitePublic = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');
process.env.VITE_PUBLIC = envVitePublic;

let win: BrowserWindow | null;
let tray: Tray;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

app.setAppUserModelId('Monitor');

const id = powerSaveBlocker.start('prevent-app-suspension');

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
  } else {
    win.loadFile(path.join(process.env.DIST ?? '', 'index.html'));
    Menu.setApplicationMenu(null);

    globalShortcut.register('CommandOrControl+Shift+Alt+I', () => {
      const defaultMenu = Menu.buildFromTemplate([
        { role: 'fileMenu' },
        { role: 'editMenu' },
        { role: 'viewMenu' },
        { role: 'windowMenu' },
        { role: 'help' },
      ]);
      Menu.setApplicationMenu(defaultMenu);
    });

    globalShortcut.register('CommandOrControl+Shift+Alt+I', () => {
      Menu.setApplicationMenu(null);
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
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
        try {
          window.webContents.send(
            'error',
            JSON.stringify({
              title: 'Erro não tratado',
              message: (error as Error).message,
            })
          );
        } catch (err) {
          console.error('Erro ao enviar mensagem para renderer:', err);
        }
      }
    });
  });

  // Intercepta promessas rejeitadas não tratadas
  process.on('unhandledRejection', async reason => {
    if (reason instanceof Error) {
      await logError(reason, ErrorType.UnhandledRejection);
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
          try {
            window.webContents.send(
              'error',
              JSON.stringify({
                title: 'Erro não tratado',
                message: (reason as Error).message,
              })
            );
          } catch (err) {
            console.error('Erro ao enviar mensagem para renderer:', err);
          }
        }
      });
    } else {
      await logError(new Error(String(reason)), ErrorType.UnhandledRejection);
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
          try {
            window.webContents.send(
              'error',
              JSON.stringify({
                title: 'Erro não tratado',
                message: (reason as Error).message,
              })
            );
          } catch (err) {
            console.error('Erro ao enviar mensagem para renderer:', err);
          }
        }
      });
    }
  });

  // Intercepta erros de renderização
  app.on('render-process-gone', async (_event, _webContents, details) => {
    await logError(new Error(`Render process gone: ${details.reason}`), ErrorType.RenderProcessGone);
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send(
        'error',
        JSON.stringify({
          title: 'Erro de renderização',
          message: details.reason,
        })
      );
    });
  });

  // Intercepta erros de GPU
  app.on('child-process-gone', async (_event, details) => {
    await logError(new Error(`GPU process gone: ${details.type}`), ErrorType.GPUProcessGone);
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send(
        'error',
        JSON.stringify({
          title: 'Erro de GPU',
          message: details.type,
        })
      );
    });
  });

  if (!VITE_DEV_SERVER_URL) {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: false,
      path: app.getPath('exe'),
    });
  }
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

setInterval(() => {
  autoUpdater.checkForUpdatesAndNotify();
}, 60000);

autoUpdater.on('update-available', () => {
  win?.webContents.send('update-available', '⚙️ Identificada uma nova versão.');
});

autoUpdater.on('update-downloaded', () => {
  win?.webContents.send('update-downloaded', '🚀 Atualização começará em 5 segundos');
  setInterval(() => {}, 5000);
  autoUpdater.quitAndInstall();
});
