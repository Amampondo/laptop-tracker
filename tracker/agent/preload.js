const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tracker', {
  // Auth
  login: (email, password) => ipcRenderer.invoke('login', email, password),
  getStatus: () => ipcRenderer.invoke('get-status'),

  // Location — called from hidden renderer window
  sendLocation: (lat, lng, accuracy) => ipcRenderer.invoke('send-location', lat, lng, accuracy),
  locationError: (msg) => ipcRenderer.invoke('location-error', msg),

  // Battery — called from hidden renderer window
  reportBattery: (level, charging) => ipcRenderer.send('battery-report', level, charging),
})
