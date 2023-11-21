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
window.ipcRenderer.on("main-process-message", (_event, message) => {
  console.log(message);
});

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
