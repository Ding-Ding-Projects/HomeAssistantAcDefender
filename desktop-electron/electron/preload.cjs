const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("controller", {
  loadConfig: () => ipcRenderer.invoke("config:load"),
  saveConfig: (values) => ipcRenderer.invoke("config:save", values),
  connect: (values) => ipcRenderer.invoke("auth:connect", values),
  disconnect: () => ipcRenderer.invoke("auth:disconnect"),
  status: () => ipcRenderer.invoke("api:status"),
  notifications: (query) => ipcRenderer.invoke("api:notifications", query),
  notificationAction: (id, action) => ipcRenderer.invoke("api:notification-action", { id, action }),
  target: (temperature) => ipcRenderer.invoke("api:target", temperature),
  defender: (enabled) => ipcRenderer.invoke("api:defender", enabled),
  command: (name) => ipcRenderer.invoke("api:command", name),
  windowControl: (action) => ipcRenderer.invoke("window:control", action),
  configureUpdater: (feedUrl) => ipcRenderer.invoke("update:configure", { feedUrl }),
  checkForUpdate: () => ipcRenderer.invoke("update:check"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdateReady: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("update-ready", listener);
    return () => ipcRenderer.removeListener("update-ready", listener);
  },
  onUpdateError: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("update-error", listener);
    return () => ipcRenderer.removeListener("update-error", listener);
  }
});
