import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Lista de canais permitidos para segurança
const ALLOWED_INVOKE_CHANNELS = [
  'get-auth',
  'signIn',
  'get-directories',
  'select-directories-invoices',
  'select-directories-certificates',
  'remove-directory',
  'get-config',
  'get-historic',
  'change-view-uploaded-files',
  'change-remove-uploaded-files',
  'change-time-for-processing',
  'get-sittax-token',
] as const;

const ALLOWED_SEND_CHANNELS = [
  'remove-auth',
  'initialize-job',
  'clear-historic',
  'show-notification',
] as const;

const ALLOWED_RECEIVE_CHANNELS = ['update-available', 'update-downloaded', 'error'] as const;

type InvokeChannel = (typeof ALLOWED_INVOKE_CHANNELS)[number];
type SendChannel = (typeof ALLOWED_SEND_CHANNELS)[number];
type ReceiveChannel = (typeof ALLOWED_RECEIVE_CHANNELS)[number];

// API segura exposta ao renderer
const secureIpcRenderer = {
  invoke: (channel: InvokeChannel, ...args: unknown[]) => {
    if (ALLOWED_INVOKE_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Canal IPC não permitido: ${channel}`);
  },

  send: (channel: SendChannel, ...args: unknown[]) => {
    if (ALLOWED_SEND_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else {
      throw new Error(`Canal IPC não permitido: ${channel}`);
    }
  },

  on: (channel: ReceiveChannel, callback: (event: IpcRendererEvent, ...args: unknown[]) => void) => {
    if (ALLOWED_RECEIVE_CHANNELS.includes(channel)) {
      ipcRenderer.on(channel, callback);
      return () => ipcRenderer.removeListener(channel, callback);
    }
    throw new Error(`Canal IPC não permitido: ${channel}`);
  },

  removeListener: (channel: ReceiveChannel, callback: (...args: unknown[]) => void) => {
    if (ALLOWED_RECEIVE_CHANNELS.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },

  removeAllListeners: (channel: ReceiveChannel) => {
    if (ALLOWED_RECEIVE_CHANNELS.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
};

// Expõe API segura ao renderer
contextBridge.exposeInMainWorld('ipcRenderer', secureIpcRenderer);

// --------- Preload scripts loading ---------
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise(resolve => {
    if (condition.includes(document.readyState)) {
      resolve(true);
    } else {
      document.addEventListener(
        'readystatechange',
        () => {
          if (condition.includes(document.readyState)) {
            resolve(true);
          }
        },
        { once: true }
      );
    }
  });
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(e => e === child)) {
      parent.appendChild(child);
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(e => e === child)) {
      parent.removeChild(child);
    }
  },
};

function useLoading() {
  const className = `loading-container`;
  const styleContent = `
  .loading-container {
    position: absolute;
    justify-content: center;
    align-items: center;
    opacity: 0.7;
  }

  .loading-image {
    display: block;
    margin: 0 auto;
    width: 100px;
    height: 100px;
    height: auto;
    animation: bounceIn infinite;
    animation-duration: calc(var(--animate-duration) * 0.75);
    animation-duration: 1s;
  }

  .app-loading-wrap {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9;
  }

  @keyframes bounceIn {
    from,
    20%,
    40%,
    60%,
    80%,
    to {
      animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
    }

    0% {
      opacity: 0;
      transform: scale3d(0.3, 0.3, 0.3);
    }

    20% {
      transform: scale3d(1.1, 1.1, 1.1);
    }

    40% {
      transform: scale3d(0.9, 0.9, 0.9);
    }

    60% {
      opacity: 1;
      transform: scale3d(1.03, 1.03, 1.03);
    }

    80% {
      transform: scale3d(0.97, 0.97, 0.97);
    }

    to {
      opacity: 1;
      transform: scale3d(1, 1, 1);
    }
  }
    `;
  const oStyle = document.createElement('style');
  const oDiv = document.createElement('div');

  oStyle.id = 'app-loading-style';
  oStyle.innerHTML = styleContent;
  oDiv.className = 'app-loading-wrap';
  oDiv.innerHTML = `<div class="${className}"><img src="/sittax.png" alt="loading image" class="loading-image"></div>`;

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle);
      safeDOM.append(document.body, oDiv);
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle);
      safeDOM.remove(document.body, oDiv);
    },
  };
}

// eslint-disable-next-line react-hooks/rules-of-hooks
const { appendLoading, removeLoading } = useLoading();
domReady().then(appendLoading);

window.onmessage = ev => {
  ev.data.payload === 'removeLoading' && removeLoading();
};

setTimeout(removeLoading, 4999);
