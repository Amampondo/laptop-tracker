import { createContext, useContext, useState } from 'react'
import api from './api'

const AuthContext = createContext(null)

// The local agent listens on this port for credential notifications.
// After a successful login we POST the token + userId so the agent can
// keep the session alive even after the browser window is closed.
const AGENT_REGISTER_URL = 'http://127.0.0.1:27182/register'

async function notifyAgent(token, userId) {
  try {
    await fetch(AGENT_REGISTER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, userId }),
    })
  } catch (_) {
    // Agent not running (e.g. browser-only access) — silently ignore
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })

    // Persist token in localStorage so the dashboard page survives refreshes
    localStorage.setItem('token', data.access_token)

    const me = await api.get('/users/me')
    localStorage.setItem('user', JSON.stringify(me.data))
    setUser(me.data)

    // Tell the local agent our credentials so it can watchdog this session.
    // This is what makes "close the window and stay logged in" work —
    // the agent holds the token, keeps polling, and reopens the window when needed.
    await notifyAgent(data.access_token, me.data.id)

    return me.data
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
