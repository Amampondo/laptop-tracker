import { useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function useLocationReporter(user) {
  // ── Register SW once on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/tracker-sw.js').then(reg => {
      console.log('[tracker] SW registered')

      // Register for Periodic Background Sync if supported (Chrome 80+)
      // This is the most reliable scheduler — browser wakes SW even if throttled
      if ('periodicSync' in reg) {
        navigator.permissions.query({ name: 'periodic-background-sync' }).then(status => {
          if (status.state === 'granted') {
            reg.periodicSync.register('tracker-location', { minInterval: 5 * 60 * 1000 })
              .then(() => console.log('[tracker] Periodic sync registered'))
              .catch(err => console.warn('[tracker] Periodic sync failed:', err.message))
          }
        })
      }
    }).catch(err => console.warn('[tracker] SW registration failed:', err.message))

    // Tab acts as geolocation proxy for the SW
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type !== 'GET_LOCATION') return
      const port = e.ports[0]
      navigator.geolocation.getCurrentPosition(
        pos => port.postMessage({
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy:  pos.coords.accuracy,
        }),
        err => port.postMessage({ error: err.message }),
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }
      )
    })
  }, [])

  // ── Send credentials to SW when user logs in ────────────────────────────────
  useEffect(() => {
    if (!user || !('serviceWorker' in navigator)) return

    const token = localStorage.getItem('token')
    if (!token) return

    navigator.serviceWorker.ready.then(reg => {
      reg.active?.postMessage({ type: 'INIT', token, apiUrl: API_URL })
      reg.active?.postMessage({ type: 'REPORT_NOW' })
    })
  }, [user])
}
