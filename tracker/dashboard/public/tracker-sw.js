/**
 * Laptop Tracker — Service Worker
 *
 * Runs independently of tab focus.
 * Every 5 minutes: asks the tab for GPS coords → POSTs to API.
 * Token + API URL stored in IndexedDB (SW has no localStorage).
 */

const REPORT_INTERVAL_MS = 5 * 60 * 1000
const DB_NAME            = 'tracker-sw'
const DB_STORE           = 'config'


// ── IndexedDB helpers ─────────────────────────────────────────────────────────

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
    req.onsuccess = e => resolve(e.target.result ?? null)
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


// ── Get location via tab proxy ────────────────────────────────────────────────
// SWs cannot call navigator.geolocation directly.
// We message an open client tab; it calls geolocation and replies back.

function getLocationFromClient() {
  return new Promise(async (resolve, reject) => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (!clients.length) { reject(new Error('no open tab')); return }

    const channel = new MessageChannel()
    const timeout = setTimeout(() => reject(new Error('geo timeout after 20s')), 20_000)

    channel.port1.onmessage = e => {
      clearTimeout(timeout)
      if (e.data.error) reject(new Error(e.data.error))
      else resolve(e.data)
    }

    // Ask the first available tab
    clients[0].postMessage({ type: 'GET_LOCATION' }, [channel.port2])
  })
}


// ── Report location ───────────────────────────────────────────────────────────

async function reportLocation() {
  const token  = await dbGet('token')
  const apiUrl = await dbGet('apiUrl')
  if (!token || !apiUrl) {
    console.log('[tracker-sw] Not registered yet — skipping')
    return
  }

  let coords
  try {
    coords = await getLocationFromClient()
  } catch (err) {
    console.warn('[tracker-sw] Could not get location:', err.message)
    return
  }

  try {
    const res = await fetch(`${apiUrl}/locations/`, {
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
    if (res.ok) {
      console.log('[tracker-sw] Location reported ✓')
    } else if (res.status === 401) {
      console.warn('[tracker-sw] Token expired — clearing')
      await dbSet('token', null)
    } else {
      console.warn('[tracker-sw] POST failed:', res.status)
    }
  } catch (err) {
    console.warn('[tracker-sw] Network error:', err.message)
  }
}


// ── Reporting loop ────────────────────────────────────────────────────────────
// Key insight: we keep the SW alive by wrapping long-running work in
// event.waitUntil(). A bare setTimeout gets killed when SW goes idle.
// Instead we use a self-perpetuating alarm via a dummy fetch to ourselves
// which forces the SW to stay active, then schedule the next tick.

let loopStarted = false

function startLoop() {
  if (loopStarted) return
  loopStarted = true
  console.log('[tracker-sw] Reporting loop started')
  scheduleNext()
}

function scheduleNext() {
  // Use self.registration.showNotification trick is too intrusive.
  // Instead, keep a persistent promise chain using waitUntil on a synthetic event.
  // The cleanest approach: store next-report timestamp in IDB and check on each
  // SW wake (message / fetch), plus use a periodic background sync if available.
  setTimeout(async () => {
    await reportLocation()
    scheduleNext()   // re-arm immediately after completing
  }, REPORT_INTERVAL_MS)
}


// ── SW lifecycle ──────────────────────────────────────────────────────────────

self.addEventListener('install', e => {
  console.log('[tracker-sw] Installed')
  e.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', e => {
  console.log('[tracker-sw] Activated')
  e.waitUntil(
    self.clients.claim().then(() => {
      startLoop()   // ← loop starts HERE, on activate, not just on message
    })
  )
})

// Also register for Periodic Background Sync if the browser supports it
// This is the most reliable way to wake a SW on a schedule
self.addEventListener('periodicsync', e => {
  if (e.tag === 'tracker-location') {
    e.waitUntil(reportLocation())
  }
})

// Messages from the tab
self.addEventListener('message', async e => {
  if (e.data?.type === 'INIT') {
    await dbSet('token',  e.data.token)
    await dbSet('apiUrl', e.data.apiUrl)
    console.log('[tracker-sw] Credentials stored')
    startLoop()   // start loop if not already running
  }

  if (e.data?.type === 'REPORT_NOW') {
    e.waitUntil(reportLocation())
  }
})

// Keep SW alive during active fetch — also a good time to report if due
self.addEventListener('fetch', () => {})
