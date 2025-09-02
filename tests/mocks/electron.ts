// Mock abrangente do módulo 'electron' para ambiente de testes (Jest)

type Listener = (...args: any[]) => void;

export const app = {
  on: (_event: string, _listener: Listener) => {},
  whenReady: async () => {},
  isPackaged: false,
  getPath: (_name: string) => 'C:/tmp',
  setAppUserModelId: (_id: string) => {},
  setLoginItemSettings: (_opts: any) => {},
  requestSingleInstanceLock: () => true,
  quit: () => {},
};

export const powerSaveBlocker = {
  start: (_type: any) => 1,
  stop: (_id: number) => {},
};

export class WebContents {
  send(_channel: string, _payload?: any) {}
  isDestroyed() { return false; }
}

export class BrowserWindow {
  static windows: BrowserWindow[] = [];
  static getAllWindows(): BrowserWindow[] { return BrowserWindow.windows; }

  webContents = new WebContents();
  isDestroyed() { return false; }
  isVisible() { return true; }
  hide() {}
  show() {}
  on(_event: string, _listener: Listener) {}
  removeAllListeners(_event?: string) {}
  close() {}
  isMinimized() { return false; }
  restore() {}
  focus() {}
}

export const Menu = {
  buildFromTemplate: (_template: any[]) => ({}) as any,
  setApplicationMenu: (_menu: any) => {},
  getApplicationMenu: () => null as any,
};

export class Tray {
  constructor(_icon: any) {}
  setTitle(_title: string) {}
  setToolTip(_tip: string) {}
  setContextMenu(_menu: any) {}
  on(_event: string, _listener: Listener) {}
}

export const nativeImage = {
  createFromPath: (_path: string) => ({}),
};

export const globalShortcut = {
  register: (_accel: string, _callback: () => void) => true,
};

export const ipcMain = {
  on: (_channel: string, _listener: Listener) => {},
  handle: (_channel: string, _listener: Listener) => {},
};

export class Notification {
  constructor(_opts: any) {}
  show() {}
}

export const autoUpdater = {
  on: (_event: string, _listener: Listener) => {},
  checkForUpdatesAndNotify: async () => {},
  setFeedURL: (_cfg: any) => {},
  quitAndInstall: () => {},
};


