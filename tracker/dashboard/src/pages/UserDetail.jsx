import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function UserDetail() {
  const { userId } = useParams()
  const { user: me, logout } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [history, setHistory] = useState([])
  const [replayIdx, setReplayIdx] = useState(0)
  const [replaying, setReplaying] = useState(false)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const polylineRef = useRef(null)
  const replayTimer = useRef(null)

  useEffect(() => {
    api.get(`/users/${userId}`).then(r => setProfile(r.data))
    api.get(`/locations/history/${userId}?limit=500`).then(r => setHistory(r.data.points))
  }, [userId])

  useEffect(() => {
    if (!mapRef.current) return
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([-26.2, 28.04], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current)
    }
  }, [profile])

  useEffect(() => {
    if (!mapInstanceRef.current || !history.length) return
    if (polylineRef.current) polylineRef.current.remove()
    const latlngs = history.map(p => [p.latitude, p.longitude])
    polylineRef.current = L.polyline(latlngs, { color: '#1D9E75', weight: 2, opacity: 0.6 }).addTo(mapInstanceRef.current)
    mapInstanceRef.current.fitBounds(polylineRef.current.getBounds().pad(0.2))
    placeMarker(history[history.length - 1])
  }, [history])

  function placeMarker(point) {
    if (markerRef.current) markerRef.current.remove()
    markerRef.current = L.marker([point.latitude, point.longitude])
      .addTo(mapInstanceRef.current)
      .bindPopup(new Date(point.recorded_at).toLocaleString())
    mapInstanceRef.current.panTo([point.latitude, point.longitude])
  }

  function startReplay() {
    setReplaying(true)
    setReplayIdx(0)
    let idx = 0
    replayTimer.current = setInterval(() => {
      if (idx >= history.length) { clearInterval(replayTimer.current); setReplaying(false); return }
      placeMarker(history[idx])
      setReplayIdx(idx)
      idx++
    }, 300)
  }

  function stopReplay() {
    clearInterval(replayTimer.current)
    setReplaying(false)
  }

  useEffect(() => () => clearInterval(replayTimer.current), [])

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f4' }}>
      <header style={headerStyle}>
        <button onClick={() => navigate(-1)} style={ghostBtn}>← Back</button>
        <span style={{ fontWeight: 500 }}>{profile?.full_name || '…'}</span>
        <button onClick={logout} style={ghostBtn}>Sign out</button>
      </header>

      <div style={{ display: 'flex', height: 'calc(100vh - 57px)' }}>
        {/* Side panel */}
        <div style={{ width: 280, background: '#fff', borderRight: '1px solid #eee', padding: 24, overflowY: 'auto', flexShrink: 0 }}>
          {profile && (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 18, fontWeight: 500 }}>{profile.full_name}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{profile.email}</div>
                {profile.device_label && <div style={{ fontSize: 13, color: '#666', marginTop: 6, background: '#f5f5f4', borderRadius: 6, padding: '4px 8px', display: 'inline-block' }}>{profile.device_label}</div>}
              </div>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location history</div>
                <div style={{ fontSize: 22, fontWeight: 500 }}>{history.length}</div>
                <div style={{ fontSize: 13, color: '#888' }}>data points</div>
              </div>
              <button
                onClick={replaying ? stopReplay : startReplay}
                disabled={!history.length}
                style={{ ...replayBtn, background: replaying ? '#dc2626' : '#1D9E75' }}
              >
                {replaying ? `⏹ Stop  (${replayIdx}/${history.length})` : '▶ Replay route'}
              </button>
              {history.length > 0 && (
                <div style={{ marginTop: 20, fontSize: 12, color: '#aaa' }}>
                  <div>First seen</div>
                  <div style={{ color: '#555' }}>{new Date(history[0].recorded_at).toLocaleString()}</div>
                  <div style={{ marginTop: 8 }}>Last seen</div>
                  <div style={{ color: '#555' }}>{new Date(history[history.length - 1].recorded_at).toLocaleString()}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Map */}
        <div ref={mapRef} style={{ flex: 1 }} />
      </div>
    </div>
  )
}

const headerStyle = { background: '#fff', borderBottom: '1px solid #eee', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const ghostBtn = { background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer' }
const replayBtn = { width: '100%', padding: '10px', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 500 }
