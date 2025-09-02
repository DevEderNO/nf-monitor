// Verificar se estamos em ambiente de teste ou se o Electron está disponível
let BrowserWindow: any;

try {
  BrowserWindow = require('electron').BrowserWindow;
} catch (error) {
  // Em ambiente de teste, BrowserWindow não está disponível
  BrowserWindow = null;
}

export async function sendError(error: Error) {
  if (BrowserWindow) {
    // Em ambiente de produção (Electron)
    BrowserWindow.getAllWindows().forEach((window: any) => {
      window.webContents.send('error', JSON.stringify({
        title: 'Algo deu errado 😯.',
        message: (error as Error).message
      }));
    });
  } else {
    // Em ambiente de teste, apenas logar o erro
    console.error('Error in test environment:', error.message);
  }
}