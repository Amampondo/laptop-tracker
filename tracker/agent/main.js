const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, powerMonitor, dialog } = require('electron')
const path = require('path')
const axios = require('axios')
const Store = require('electron-store')

const store = new Store()
const API_URL = process.env.API_URL || 'https://tracker-api-b3jc.onrender.com'
const POLL_INTERVAL_MS = 30 * 1000  // 30 seconds
const BATTERY_RESERVE  = 10         // percent — lock below this

let tray         = null
let loginWindow  = null
let trackWindow  = null  // hidden renderer for geolocation
let lockWindow   = null  // battery lock overlay
let pollTimer    = null
let lastCoords   = null

// ── AUTO START ────────────────────────────────────────────────────────────────
function enableAutoStart() {
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,   // no window on startup
    name: 'RecoverSoft',
  })
}

// ── LOCATION (via hidden renderer — Google accuracy) ─────────────────────────
function createTrackWindow() {
  trackWindow = new BrowserWindow({
    show: false,          // completely hidden
    width: 1, height: 1,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    }
  })

  // Inline HTML that uses navigator.geolocation
  trackWindow.loadURL('data:text/html,<!DOCTYPE html><html><body><script>' +
    'function getLocation(){' +
    '  navigator.geolocation.getCurrentPosition(' +
    '    p=>window.tracker.sendLocation(p.coords.latitude,p.coords.longitude,p.coords.accuracy),' +
    '    e=>window.tracker.locationError(e.message),' +
    '    {enableHighAccuracy:true,timeout:15000,maximumAge:30000}' +
    '  )' +
    '}' +
    'setInterval(getLocation,' + POLL_INTERVAL_MS + ');' +
    'getLocation();' +  // immediate first call
    '</script></body></html>'
  )
}

// ── BATTERY LOCK ──────────────────────────────────────────────────────────────
function getBatteryLevel() {
  // powerMonitor doesn't give battery % directly
  // Use a small renderer to get navigator.getBattery()
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      show: false, width: 1, height: 1,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
    })
    win.loadURL('data:text/html,<!DOCTYPE html><html><body><script>' +
      'navigator.getBattery().then(b=>{' +
      '  window.tracker.reportBattery(Math.round(b.level*100), b.charging);' +
      '}).catch(()=>window.tracker.reportBattery(null,false));' +
      '</script></body></html>'
    )
    ipcMain.once('battery-report', (_e, level, charging) => {
      win.destroy()
      resolve({ level, charging })
    })
    setTimeout(() => { win.destroy(); resolve({ level: null, charging: false }) }, 5000)
  })
}

function showBatteryLock() {
  if (lockWindow) return
  lockWindow = new BrowserWindow({
    fullscreen: true,
    alwaysOnTop: true,
    frame: false,
    skipTaskbar: true,
    webPreferences: { contextIsolation: true }
  })
  lockWindow.loadURL('data:text/html,' + encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
    <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{background:#0f1117;color:#fff;display:flex;align-items:center;
         justify-content:center;height:100vh;flex-direction:column;gap:20px;
         font-family:-apple-system,sans-serif;user-select:none;}
    .icon{font-size:80px;}
    h1{font-size:28px;font-weight:700;}
    p{font-size:16px;color:#6c7280;text-align:center;max-width:400px;line-height:1.6;}
    .bar{width:200px;height:8px;background:#2a2d3a;border-radius:4px;overflow:hidden;}
    .fill{height:100%;width:10%;background:#ef4444;border-radius:4px;}
    </style>
    </head>
    <body>
    <div class="icon">🔋</div>
    <h1>Battery Critically Low</h1>
    <p>This device has been locked to protect your data.<br>
       Please plug in your charger to continue.</p>
    <div class="bar"><div class="fill"></div></div>
    </body>
    </html>
  `))

  // Block all keyboard shortcuts
  lockWindow.webContents.on('before-input-event', (event, input) => {
    event.preventDefault()
  })

  lockWindow.on('closed', () => { lockWindow = null })
}

function hideBatteryLock() {
  if (lockWindow) {
    lockWindow.destroy()
    lockWindow = null
  }
}

async function checkBattery() {
  const { level, charging } = await getBatteryLevel()
  if (level === null) return  // can't determine — don't lock

  if (level <= BATTERY_RESERVE && !charging) {
    showBatteryLock()
  } else if (lockWindow) {
    hideBatteryLock()  // charger plugged in — unlock
  }
}

// ── LOCATION POSTING ──────────────────────────────────────────────────────────
async function postLocation(lat, lng, accuracy) {
  const token = store.get('token')
  if (!token) return
  lastCoords = { lat, lng, accuracy }
  try {
    await axios.post(`${API_URL}/locations/`, {
      latitude: lat,
      longitude: lng,
      accuracy_metres: accuracy,
      recorded_at: new Date().toISOString(),
    }, { headers: { Authorization: `Bearer ${token}` } })
    tray?.setToolTip(`RecoverSoft — last ping ${new Date().toLocaleTimeString()}`)
  } catch (err) {
    if (err.response?.status === 401) logout()
  }
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
async function doLogin(email, password) {
  const { data } = await axios.post(`${API_URL}/auth/login`, { email, password })
  store.set('token', data.access_token)
  store.set('role', data.role)
  return data
}

function logout() {
  store.delete('token')
  store.delete('role')
  trackWindow?.destroy()
  trackWindow = null
  showLoginWindow()
}

// ── TRAY ──────────────────────────────────────────────────────────────────────
function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'RecoverSoft', enabled: false },
    { type: 'separator' },
    { label: lastCoords
        ? `Last location: ${lastCoords.lat.toFixed(4)}, ${lastCoords.lng.toFixed(4)}`
        : 'Waiting for location...', enabled: false },
    { type: 'separator' },
    { label: 'Sign out', click: logout },
  ])
}

function setupTray() {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setContextMenu(buildTrayMenu())
  tray.setToolTip('RecoverSoft — tracking active')
  // Refresh menu periodically
  setInterval(() => tray?.setContextMenu(buildTrayMenu()), 30000)
}

// ── LOGIN WINDOW ──────────────────────────────────────────────────────────────
function showLoginWindow() {
  if (loginWindow) { loginWindow.show(); return }
  loginWindow = new BrowserWindow({
    width: 400, height: 480,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    },
  })
  loginWindow.loadFile(path.join(__dirname, 'login.html'))
  loginWindow.on('closed', () => { loginWindow = null })
}

function startTracking() {
  createTrackWindow()
  // Battery check every 60 seconds
  setInterval(checkBattery, 60 * 1000)
  checkBattery()  // immediate check
  tray?.setToolTip('RecoverSoft — tracking active')
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.handle('login', async (_event, email, password) => {
  const data = await doLogin(email, password)
  loginWindow?.hide()
  startTracking()
  return data
})

ipcMain.handle('get-status', () => ({
  loggedIn: !!store.get('token'),
  lastCoords,
}))

// Location from renderer
ipcMain.handle('send-location', (_e, lat, lng, accuracy) => {
  postLocation(lat, lng, accuracy)
})

ipcMain.handle('location-error', (_e, msg) => {
  console.error('Location error:', msg)
})

// Battery from renderer
ipcMain.on('battery-report', (_e, level, charging) => {
  // handled in getBatteryLevel promise
})

// ── APP LIFECYCLE ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  app.dock?.hide()    // macOS: hide from dock
  enableAutoStart()   // register startup on all platforms
  setupTray()

  if (store.get('token')) {
    startTracking()
  } else {
    showLoginWindow()
  }
})

app.on('window-all-closed', e => e.preventDefault())  // keep running in tray
