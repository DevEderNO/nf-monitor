import { BrowserWindow } from 'electron';

type IpcPayload = {
  title: string;
  message: string;
  type: 'foreground' | 'background';
};

export function sendToAllRenderers(channel: string, payload: IpcPayload): void {
  BrowserWindow.getAllWindows().forEach(window => {
    try {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
        window.webContents.send(channel, JSON.stringify(payload));
      }
    } catch (_err) {
      // Ignore enviar para renderers destruídos
    }
  });
}

export function sendToRenderer(win: BrowserWindow | null | undefined, channel: string, payload: IpcPayload): void {
  if (!win) return;
  try {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, JSON.stringify(payload));
    }
  } catch (_err) {
    // Ignore falhas de envio
  }
}


