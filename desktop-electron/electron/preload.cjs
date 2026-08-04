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
  command: (name) => ipcRenderer.invoke("api:command", name)
});
