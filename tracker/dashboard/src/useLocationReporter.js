import { useEffect, useRef } from 'react'
import api from './api'

const REPORT_INTERVAL_MS = 5 * 60 * 1000  // report every 5 min
const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 60_000,
}

/**
 * Starts a location reporting loop as long as the user is logged in.
 * Reports immediately on mount, then every 5 minutes.
 * Cleans up when the user logs out (user becomes null).
 */
export function useLocationReporter(user) {
  const timerRef = useRef(null)

  useEffect(() => {
    if (!user) {
      // Logged out — stop reporting
      clearInterval(timerRef.current)
      timerRef.current = null
      return
    }

    if (!navigator.geolocation) {
      console.warn('[tracker] navigator.geolocation not available')
      return
    }

    async function report() {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await api.post('/locations/', {
              latitude:        pos.coords.latitude,
              longitude:       pos.coords.longitude,
              accuracy_metres: Math.round(pos.coords.accuracy),
              recorded_at:     new Date().toISOString(),
            })
          } catch (err) {
            console.warn('[tracker] Location POST failed:', err.message)
          }
        },
        (err) => {
          console.warn('[tracker] Geolocation error:', err.message)
        },
        GEO_OPTIONS
      )
    }

    report()                                           // immediate on login
    timerRef.current = setInterval(report, REPORT_INTERVAL_MS)

    return () => {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [user])   // re-runs whenever user changes (login / logout)
}
