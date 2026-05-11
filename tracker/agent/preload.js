const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tracker', {
  login: (email, password) => ipcRenderer.invoke('login', email, password),
  getStatus: () => ipcRenderer.invoke('get-status'),
})
