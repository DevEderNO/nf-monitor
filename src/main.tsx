import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { HashRouter } from "react-router-dom";
import { Toaster } from "./components/ui/toaster.tsx";
import { toast } from "./components/ui/use-toast.ts";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <HashRouter>
    <App />
    <Toaster />
  </HashRouter>
);

// Remove Preload scripts loading
postMessage({ payload: "removeLoading" }, "*");

// Use contextBridge
// Recebe mensagens do processo principal
window.ipcRenderer.on("main-process-message", (_event, message) => {
  console.log(message);
});

// Para enviar uma mensagem do processo principal (electron) para o renderer:
// No arquivo electron/main.ts ou outro arquivo do processo principal, use:
// win?.webContents.send("main-process-message", "Sua mensagem aqui");

window.ipcRenderer.on("update-available", (_event, message) => {
  toast({
    title: message,
    description: "",
    type: "foreground",
  });
});

window.ipcRenderer.on("update-downloaded", (_event, message) => {
  toast({
    title: message,
    description: "",
    type: "foreground",
  });
});

window.ipcRenderer.on("error", (_event, message) => {
  const parsedMessage = JSON.parse(message);
  toast({
    title: parsedMessage.title,
    description: parsedMessage.message,
    type: "foreground",
  });
});