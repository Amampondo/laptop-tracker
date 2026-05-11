import { useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Registers the service worker and keeps it fed with the current token.
 * The SW handles all background location reporting independently of tab focus.
 * Falls back to in-tab polling if service workers aren't supported.
 */
export function useLocationReporter(user) {
  const swRef      = useRef(null)   // ServiceWorkerRegistration
  const timerRef   = useRef(null)   // fallback interval
  const geoOptions = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }

  // ── Service Worker path ────────────────────────────────────────────────────

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/tracker-sw.js').then(reg => {
      swRef.current = reg
      console.log('[tracker] SW registered')
    }).catch(err => {
      console.warn('[tracker] SW registration failed:', err.message)
    })

    // SW asks this tab for GPS coords
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
        geoOptions
      )
    })
  }, [])   // once on mount

  // ── Send credentials to SW whenever user changes ───────────────────────────

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const sendInit = async () => {
      const reg = await navigator.serviceWorker.ready
      const token = localStorage.getItem('token')

      if (user && token) {
        reg.active?.postMessage({ type: 'INIT', token, apiUrl: API_URL })
        reg.active?.postMessage({ type: 'REPORT_NOW' })  // immediate ping
      }
    }

    if (user) sendInit()
  }, [user])

  // ── Fallback: in-tab polling (if SW not supported e.g. http in dev) ────────

  useEffect(() => {
    if ('serviceWorker' in navigator) return   // SW handles it — skip fallback
    if (!user || !navigator.geolocation) return

    const token = localStorage.getItem('token')

    async function report() {
      navigator.geolocation.getCurrentPosition(async pos => {
        try {
          await fetch(`${API_URL}/locations/`, {
            method:  'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              latitude:        pos.coords.latitude,
              longitude:       pos.coords.longitude,
              accuracy_metres: Math.round(pos.coords.accuracy),
              recorded_at:     new Date().toISOString(),
            }),
          })
        } catch (err) {
          console.warn('[tracker] fallback POST failed:', err.message)
        }
      }, err => console.warn('[tracker] fallback geo error:', err.message), geoOptions)
    }

    report()
    timerRef.current = setInterval(report, 5 * 60 * 1000)
    return () => clearInterval(timerRef.current)
  }, [user])
}
