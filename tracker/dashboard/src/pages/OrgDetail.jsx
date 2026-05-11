import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default Leaflet marker icon paths broken by Vite bundling
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function OrgDetail() {
  const { orgId } = useParams()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('map')
  const [org, setOrg] = useState(null)
  const [mapData, setMapData] = useState([])
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])

  useEffect(() => {
    api.get(`/organisations/${orgId}`).then(r => setOrg(r.data))
    api.get(`/organisations/${orgId}/users`).then(r => setUsers(r.data))
    api.get(`/locations/map/${orgId}`).then(r => setMapData(r.data))
  }, [orgId])

  // Initialise map once tab switches to 'map'
  useEffect(() => {
    if (tab !== 'map' || !mapRef.current) return
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([-26.2, 28.04], 10)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current)
    }
    // Clear old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    mapData.forEach(({ user: u, latest }) => {
      if (!latest) return
      const marker = L.marker([latest.latitude, latest.longitude])
        .addTo(mapInstanceRef.current)
        .bindPopup(`<b>${u.full_name}</b><br>${u.device_label || u.email}<br><small>${new Date(latest.recorded_at).toLocaleString()}</small>`)
        .on('click', () => navigate(`/users/${u.id}`))
      markersRef.current.push(marker)
    })

    if (markersRef.current.length) {
      const group = L.featureGroup(markersRef.current)
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.2))
    }
  }, [tab, mapData])

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f4' }}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {user?.role === 'super' && (
            <button onClick={() => navigate('/orgs')} style={ghostBtn}>← All orgs</button>
          )}
          <span style={{ fontWeight: 500 }}>{org?.name || '…'}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#888' }}>{user?.email}</span>
          <button onClick={logout} style={ghostBtn}>Sign out</button>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 0, padding: '0 28px', borderBottom: '1px solid #eee', background: '#fff' }}>
        {['map', 'users'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...tabBtn, borderBottom: tab === t ? '2px solid #1D9E75' : '2px solid transparent', color: tab === t ? '#1D9E75' : '#555' }}>
            {t === 'map' ? 'Device map' : 'Users'}
          </button>
        ))}
        {(user?.role === 'super' || user?.role === 'manager') && (
          <button onClick={() => navigate(`/orgs/${orgId}/register`)} style={{ ...tabBtn, marginLeft: 'auto', color: '#1D9E75' }}>
            + Register user
          </button>
        )}
      </div>

      {tab === 'map' && (
        <div ref={mapRef} style={{ height: 'calc(100vh - 115px)', width: '100%' }} />
      )}

      {tab === 'users' && (
        <main style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            {users.map(u => (
              <div key={u.id} style={cardStyle} onClick={() => navigate(`/users/${u.id}`)}>
                <div>
                  <div style={{ fontWeight: 500 }}>{u.full_name}</div>
                  <div style={{ fontSize: 13, color: '#888' }}>{u.email}</div>
                </div>
                <div style={{ fontSize: 13, color: '#aaa' }}>{u.device_label || 'No device label'}</div>
              </div>
            ))}
          </div>
        </main>
      )}
    </div>
  )
}

const headerStyle = { background: '#fff', borderBottom: '1px solid #eee', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const tabBtn = { background: 'none', border: 'none', padding: '14px 16px', fontSize: 14, cursor: 'pointer', fontWeight: 500 }
const ghostBtn = { background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer' }
const cardStyle = { background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }
