import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Unregister any legacy service workers (old tracker-sw.js that tracked
// via browser GPS). All tracking is now handled by the desktop agent.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => {
      reg.unregister()
      console.log('[tracker] Legacy SW unregistered:', reg.scope)
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
