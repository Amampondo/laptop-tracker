/**
 * Laptop Tracker — Service Worker
 *
 * Runs in the background regardless of which tab is active.
 * Wakes up every 5 minutes via a sync-like alarm, grabs GPS coords,
 * and POSTs them to the API using the token stored in IndexedDB.
 */

const REPORT_INTERVAL_MS = 5 * 60 * 1000
const DB_NAME            = 'tracker-sw'
const DB_STORE           = 'config'

// ── IndexedDB helpers (SW has no localStorage) ───────────────────────────────

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE)
    req.onsuccess  = e => resolve(e.target.result)
    req.onerror    = e => reject(e.target.error)
  })
}

async function dbGet(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(DB_STORE, 'readonly')
    const req = tx.objectStore(DB_STORE).get(key)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

async function dbSet(key, value) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(DB_STORE, 'readwrite')
    const req = tx.objectStore(DB_STORE).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror   = e => reject(e.target.error)
  })
}


// ── Geolocation from SW (uses clients as a proxy) ────────────────────────────
// Service workers can't call navigator.geolocation directly.
// We ask an open client (tab) to get coords and message them back.

function getLocationFromClient() {
  return new Promise(async (resolve, reject) => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (!clients.length) { reject(new Error('no active clients')); return }

    const channel = new MessageChannel()
    const timeout = setTimeout(() => reject(new Error('geo timeout')), 20_000)

    channel.port1.onmessage = e => {
      clearTimeout(timeout)
      if (e.data.error) reject(new Error(e.data.error))
      else resolve(e.data)
    }

    clients[0].postMessage({ type: 'GET_LOCATION' }, [channel.port2])
  })
}


// ── POST location to API ──────────────────────────────────────────────────────

async function reportLocation() {
  const token   = await dbGet('token')
  const apiUrl  = await dbGet('apiUrl')
  if (!token || !apiUrl) return   // not registered yet

  let coords
  try {
    coords = await getLocationFromClient()
  } catch (err) {
    console.warn('[tracker-sw] Could not get location:', err.message)
    return
  }

  try {
    await fetch(`${apiUrl}/locations/`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        latitude:        coords.latitude,
        longitude:       coords.longitude,
        accuracy_metres: Math.round(coords.accuracy),
        recorded_at:     new Date().toISOString(),
      }),
    })
    console.log('[tracker-sw] Location reported')
  } catch (err) {
    console.warn('[tracker-sw] POST failed:', err.message)
  }
}


// ── Alarm loop (setInterval inside SW is unreliable; use periodic wake-ups) ──

async function scheduleNext() {
  await reportLocation()
  // Re-schedule via setTimeout — SW stays alive as long as there's pending work
  setTimeout(scheduleNext, REPORT_INTERVAL_MS)
}


// ── SW lifecycle ──────────────────────────────────────────────────────────────

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Main thread messages to SW
self.addEventListener('message', async e => {
  if (e.data?.type === 'INIT') {
    // Dashboard sends token + apiUrl on every page load
    await dbSet('token',  e.data.token)
    await dbSet('apiUrl', e.data.apiUrl)
    console.log('[tracker-sw] Credentials stored')
  }

  if (e.data?.type === 'REPORT_NOW') {
    await reportLocation()
  }
})
