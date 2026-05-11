const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron')
const path = require('path')
const axios = require('axios')
const Store = require('electron-store')

const store = new Store()
const API_URL = process.env.API_URL || 'https://your-api.onrender.com'
const POLL_INTERVAL_MS = 5 * 60 * 1000  // 5 minutes

let tray = null
let loginWindow = null
let pollTimer = null


// ── Location polling ──────────────────────────────────────────────────────────

function getLocation() {
  return new Promise((resolve, reject) => {
    // Use Node.js geolocation via IP-based fallback (device geolocation is only
    // available in renderer. For a production build with GPS, use the renderer
    // to get coords via navigator.geolocation and send via IPC — shown below.)
    // Here we use ip-api.com as a fallback for non-GPS environments.
    axios.get('http://ip-api.com/json').then(res => {
      resolve({ latitude: res.data.lat, longitude: res.data.lon, accuracy_metres: 5000 })
    }).catch(reject)
  })
}

async function postLocation(coords) {
  const token = store.get('token')
  if (!token) return
  try {
    await axios.post(`${API_URL}/locations/`, {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy_metres: coords.accuracy_metres,
      recorded_at: new Date().toISOString(),
    }, { headers: { Authorization: `Bearer ${token}` } })
  } catch (err) {
    if (err.response?.status === 401) logout()
  }
}

async function tick() {
  try {
    const coords = await getLocation()
    await postLocation(coords)
  } catch (e) {
    console.error('Location tick failed:', e.message)
  }
}

function startPolling() {
  tick()  // immediate first ping
  pollTimer = setInterval(tick, POLL_INTERVAL_MS)
  tray?.setToolTip('Laptop Tracker — tracking active')
}

function stopPolling() {
  clearInterval(pollTimer)
  pollTimer = null
}


// ── Auth ──────────────────────────────────────────────────────────────────────

async function doLogin(email, password) {
  const { data } = await axios.post(`${API_URL}/auth/login`, { email, password })
  store.set('token', data.access_token)
  store.set('role', data.role)
  return data
}

function logout() {
  stopPolling()
  store.delete('token')
  store.delete('role')
  showLoginWindow()
}


// ── Tray ──────────────────────────────────────────────────────────────────────

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Laptop Tracker', enabled: false },
    { type: 'separator' },
    { label: 'Status: tracking', enabled: false },
    { type: 'separator' },
    { label: 'Sign out', click: logout },
    { label: 'Quit', click: () => app.quit() },
  ])
}

function setupTray() {
  const icon = nativeImage.createEmpty()  // Replace with a real icon in production
  tray = new Tray(icon)
  tray.setContextMenu(buildTrayMenu())
  tray.setToolTip('Laptop Tracker')
}


// ── Login window ──────────────────────────────────────────────────────────────

function showLoginWindow() {
  if (loginWindow) { loginWindow.show(); return }
  loginWindow = new BrowserWindow({
    width: 400, height: 480,
    resizable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  })
  loginWindow.loadFile(path.join(__dirname, 'login.html'))
  loginWindow.on('closed', () => { loginWindow = null })
}

ipcMain.handle('login', async (_event, email, password) => {
  const data = await doLogin(email, password)
  loginWindow?.hide()
  startPolling()
  return data
})

ipcMain.handle('get-status', () => ({
  loggedIn: !!store.get('token'),
  polling: !!pollTimer,
}))


// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  app.dock?.hide()  // macOS: hide from dock, live in tray only
  setupTray()
  if (store.get('token')) {
    startPolling()
  } else {
    showLoginWindow()
  }
})

app.on('window-all-closed', e => e.preventDefault())  // keep running in tray
