import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function OrgDetail() {
  const { orgId }        = useParams()
  const { user, logout } = useAuth()
  const navigate         = useNavigate()

  const [tab, setTab]       = useState('map')
  const [org, setOrg]       = useState(null)
  const [mapData, setMapData] = useState([])
  const [users, setUsers]   = useState([])
  const [fences, setFences] = useState([])
  const [drawingFence, setDrawingFence] = useState(false)
  const [violations, setViolations]     = useState([])

  const mapRef         = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef     = useRef([])
  const fenceLayersRef = useRef([])
  const drawPointsRef  = useRef([])
  const drawLayerRef   = useRef(null)
  const drawMarkersRef = useRef([])

  useEffect(() => {
    api.get(`/organisations/${orgId}`).then(r => setOrg(r.data))
    api.get(`/organisations/${orgId}/users`).then(r => setUsers(r.data))
    api.get(`/locations/map/${orgId}`).then(r => setMapData(r.data))
    api.get(`/geofences/org/${orgId}`).then(r => setFences(r.data))
  }, [orgId])

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'map' || !mapRef.current) return
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([-26.2, 28.04], 10)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current)
    }
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
      mapInstanceRef.current.fitBounds(L.featureGroup(markersRef.current).getBounds().pad(0.2))
    }
  }, [tab, mapData])

  // ── Render fences ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current) return
    fenceLayersRef.current.forEach(l => l.remove())
    fenceLayersRef.current = fences.map(fence => {
      const poly = L.polygon(fence.points, {
        color: '#f59e0b', weight: 2, fillColor: '#f59e0b', fillOpacity: 0.08
      }).addTo(mapInstanceRef.current)
      poly.bindTooltip(fence.name, { permanent: false, direction: 'center' })
      return poly
    })
    checkAllViolations()
  }, [fences, mapData])

  function checkAllViolations() {
    const v = []
    mapData.forEach(({ user: u, latest }) => {
      if (!latest) return
      const latlng = L.latLng(latest.latitude, latest.longitude)
      fences.forEach(fence => {
        if (!L.polygon(fence.points).getBounds().contains(latlng)) {
          v.push({ userName: u.full_name, fenceName: fence.name })
        }
      })
    })
    setViolations(v)
  }

  // ── Drawing ────────────────────────────────────────────────────────────────
  const startDrawing = useCallback(() => {
    if (!mapInstanceRef.current) return
    setDrawingFence(true)
    drawPointsRef.current = []
    mapInstanceRef.current.getContainer().style.cursor = 'crosshair'
    mapInstanceRef.current.on('click', onMapClick)
    mapInstanceRef.current.on('dblclick', onMapDblClick)
  }, [])

  function onMapClick(e) {
    const pt = [e.latlng.lat, e.latlng.lng]
    drawPointsRef.current.push(pt)
    const vm = L.circleMarker(pt, { radius: 5, color: '#f59e0b', fillColor: '#fff', fillOpacity: 1, weight: 2 })
      .addTo(mapInstanceRef.current)
    drawMarkersRef.current.push(vm)
    if (drawLayerRef.current) drawLayerRef.current.remove()
    if (drawPointsRef.current.length >= 2) {
      drawLayerRef.current = L.polygon(drawPointsRef.current, {
        color: '#f59e0b', weight: 2, fillOpacity: 0.1, dashArray: '6 4'
      }).addTo(mapInstanceRef.current)
    }
  }

  function onMapDblClick(e) { L.DomEvent.stop(e); finishDrawing() }

  async function finishDrawing() {
    const map = mapInstanceRef.current
    map.off('click', onMapClick)
    map.off('dblclick', onMapDblClick)
    map.getContainer().style.cursor = ''
    drawMarkersRef.current.forEach(m => m.remove())
    drawMarkersRef.current = []
    if (drawLayerRef.current) { drawLayerRef.current.remove(); drawLayerRef.current = null }

    if (drawPointsRef.current.length < 3) { setDrawingFence(false); return }

    const name = prompt('Name this geo-fence zone:')
    if (!name) { setDrawingFence(false); return }

    try {
      const { data } = await api.post('/geofences/', {
        name,
        points: [...drawPointsRef.current],
        org_id: orgId,
      })
      setFences(prev => [...prev, data])
    } catch (e) {
      alert('Failed to save fence: ' + (e.response?.data?.detail || e.message))
    }
    drawPointsRef.current = []
    setDrawingFence(false)
  }

  function cancelDrawing() {
    const map = mapInstanceRef.current
    if (!map) return
    map.off('click', onMapClick)
    map.off('dblclick', onMapDblClick)
    map.getContainer().style.cursor = ''
    drawMarkersRef.current.forEach(m => m.remove())
    drawMarkersRef.current = []
    if (drawLayerRef.current) { drawLayerRef.current.remove(); drawLayerRef.current = null }
    drawPointsRef.current = []
    setDrawingFence(false)
  }

  async function deleteFence(id) {
    try {
      await api.delete(`/geofences/${id}`)
      setFences(prev => prev.filter(f => f.id !== id))
    } catch (e) {
      alert('Failed to delete fence')
    }
  }

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

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '0 28px', borderBottom: '1px solid #eee', background: '#fff' }}>
        {['map', 'fences', 'users'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            ...tabBtn,
            borderBottom: tab === t ? '2px solid #1D9E75' : '2px solid transparent',
            color: tab === t ? '#1D9E75' : '#555'
          }}>
            {t === 'map' ? 'Device map' : t === 'fences' ? `Geo-fences${fences.length ? ` (${fences.length})` : ''}` : 'Users'}
          </button>
        ))}
        {(user?.role === 'super' || user?.role === 'manager') && (
          <button onClick={() => navigate(`/orgs/${orgId}/register`)} style={{ ...tabBtn, marginLeft: 'auto', color: '#1D9E75' }}>
            + Register user
          </button>
        )}
      </div>

      {/* Map tab */}
      {tab === 'map' && (
        <div style={{ display: 'flex', height: 'calc(100vh - 115px)' }}>
          <div ref={mapRef} style={{ flex: 1 }} />
          <div style={{ width: 260, background: '#fff', borderLeft: '1px solid #eee', padding: 20, overflowY: 'auto', flexShrink: 0 }}>
            <div style={sectionLabel}>Devices</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{mapData.length}</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>tracked devices</div>

            {violations.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 6 }}>⚠ Zone violations</div>
                {violations.map((v, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#dc2626', marginBottom: 2 }}>
                    {v.userName} — outside {v.fenceName}
                  </div>
                ))}
              </div>
            )}

            <div style={sectionLabel}>Geo-fences</div>
            {!drawingFence ? (
              <button onClick={startDrawing} style={{ ...actionBtn, background: '#f59e0b', width: '100%', marginBottom: 10 }}>
                ✏ Draw fence
              </button>
            ) : (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13, color: '#92400e' }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>Drawing mode</div>
                Click to add points. Double-click to finish.
                <br/>
                <button onClick={cancelDrawing} style={{ marginTop: 8, background: 'none', border: '1px solid #fcd34d', borderRadius: 5, padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: '#92400e' }}>Cancel</button>
              </div>
            )}
            {fences.length === 0 && !drawingFence && <div style={{ fontSize: 13, color: '#aaa' }}>No fences yet.</div>}
            {fences.map(fence => (
              <div key={fence.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f9f9f8', borderRadius: 7, marginBottom: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ color: '#f59e0b' }}>⬡</span>
                  <span>{fence.name}</span>
                </div>
                <button onClick={() => deleteFence(fence.id)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 15 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fences tab */}
      {tab === 'fences' && (
        <main style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Geo-fences</h2>
            <button onClick={() => { setTab('map'); setTimeout(startDrawing, 200) }}
              style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 14, cursor: 'pointer', fontWeight: 500 }}>
              ✏ Draw new fence
            </button>
          </div>
          {fences.length === 0 ? (
            <p style={{ color: '#888', fontSize: 14 }}>No geo-fences defined. Switch to the map tab and draw one.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {fences.map(fence => (
                <div key={fence.id} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{fence.name}</div>
                    <div style={{ fontSize: 13, color: '#aaa', marginTop: 2 }}>{fence.points.length} vertices</div>
                  </div>
                  <button onClick={() => deleteFence(fence.id)} style={{ background: 'none', border: '1px solid #eee', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', color: '#dc2626' }}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* Users tab */}
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

const headerStyle  = { background: '#fff', borderBottom: '1px solid #eee', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const tabBtn       = { background: 'none', border: 'none', padding: '14px 16px', fontSize: 14, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }
const ghostBtn     = { background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
const actionBtn    = { padding: '9px 12px', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }
const cardStyle    = { background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }
const sectionLabel = { fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }
