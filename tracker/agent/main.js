const { app, BrowserWindow, screen, ipcMain, powerMonitor, session } = require('electron');
const path = require('path');
const axios = require('axios');
const Store = require('electron-store');

const store = new Store();
const API_URL = process.env.API_URL || 'https://tracker-api-b3jc.onrender.com';
const REAL_BATTERY_LIMIT = 15; // 15% real battery triggers lockdown

let mainWindow = null;
let lockdownWindow = null;

function createMainWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = 500;
  const winHeight = 600;

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: width - winWidth, // Position at top right
    y: 0,
    frame: true, // Show frame so user can interact with the map
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'login.html'));
}

// Battery Lockdown: 15% real = 1% user experience
function triggerLockdown() {
  if (lockdownWindow) return;
  lockdownWindow = new BrowserWindow({
    fullscreen: true,
    alwaysOnTop: true,
    kiosk: true, // Prevents user from escaping
    backgroundColor: '#000000'
  });
  lockdownWindow.loadURL('data:text/html,<body style="background:black;cursor:none;"></body>');
}

app.whenReady().then(() => {
  // Silent approval for subsequent requests once user grants first one
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'geolocation') return callback(true);
    callback(false);
  });

  app.setLoginItemSettings({ openAtLogin: true }); // Auto-start feature
  createMainWindow();
});

ipcMain.handle('login', async (_event, email, password) => {
  try {
    const { data } = await axios.post(`${API_URL}/auth/login`, { email, password });
    store.set('token', data.access_token);
    mainWindow.loadFile(path.join(__dirname, 'geo.html')); // Transition to Map
    return data;
  } catch (err) {
    throw new Error('Login failed');
  }
});

ipcMain.on('geo-location', async (_event, coords) => {
  const token = store.get('token');
  if (!token) return;
  try {
    await axios.post(`${API_URL}/locations/`, coords, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (err) { console.error("Tracking update failed"); }
});

ipcMain.handle('battery-report', (_event, percent) => {
  if (percent <= REAL_BATTERY_LIMIT && powerMonitor.isOnBatteryPower()) {
    triggerLockdown();
  } else if (!powerMonitor.isOnBatteryPower() && lockdownWindow) {
    lockdownWindow.destroy();
    lockdownWindow = null;
  }
});