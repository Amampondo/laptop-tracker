const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tracker', {
    login: (email, password) => ipcRenderer.invoke('login', email, password),
    reportBattery: (percent) => ipcRenderer.invoke('battery-report', percent),
    reportLocation: (coords) => ipcRenderer.send('geo-location', coords),
    onAuthSuccess: (callback) => ipcRenderer.on('auth-success', callback)
});

// Battery listener
window.addEventListener('DOMContentLoaded', () => {
    if (navigator.getBattery) {
        navigator.getBattery().then(battery => {
            const report = () => {
                const actualLevel = Math.round(battery.level * 100);
                ipcRenderer.invoke('battery-report', actualLevel);
            };
            battery.addEventListener('levelchange', report);
            report(); // Initial report
        });
    }
});