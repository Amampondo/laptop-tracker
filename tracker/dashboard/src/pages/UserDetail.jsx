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

export default function UserDetail() {
  const { userId }           = useParams()
  const { user: me, logout } = useAuth()
  const navigate             = useNavigate()

  const [profile, setProfile] = useState(null)
  const [history, setHistory] = useState([])

  // Playback
  const [replayIdx, setReplayIdx]     = useState(0)
  const [replaying, setReplaying]     = useState(false)
  const [replaySpeed, setReplaySpeed] = useState(300)
  const replayTimer = useRef(null)

  // Geo-fences
  const [fences, setFences]           = useState([])
  const [drawingFence, setDrawingFence] = useState(false)
  const [fenceViolations, setFenceViolations] = useState([])

  // Clear tracks
  const [showClear, setShowClear]     = useState(false)
  const [clearFrom, setClearFrom]     = useState('')
  const [clearTo, setClearTo]         = useState('')
  const [clearing, setClearing]       = useState(false)
  const [clearResult, setClearResult] = useState(null)

  // Map refs
  const mapRef         = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef      = useRef(null)
  const polylineRef    = useRef(null)
  const fenceLayersRef = useRef([])
  const drawPointsRef  = useRef([])
  const drawLayerRef   = useRef(null)
  const drawMarkersRef = useRef([])

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get(`/users/${userId}`).then(r => setProfile(r.data))
    api.get(`/locations/history/${userId}?limit=500`).then(r => setHistory(r.data.points))
    api.get(`/geofences/user/${userId}`).then(r => setFences(r.data))
  }, [userId])

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    mapInstanceRef.current = L.map(mapRef.current).setView([-26.2, 28.04], 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstanceRef.current)
  }, [profile])

  // ── Draw route ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !history.length) return
    if (polylineRef.current) polylineRef.current.remove()
    const latlngs = history.map(p => [p.latitude, p.longitude])
    polylineRef.current = L.polyline(latlngs, { color: '#1D9E75', weight: 2, opacity: 0.5 })
      .addTo(mapInstanceRef.current)
    mapInstanceRef.current.fitBounds(polylineRef.current.getBounds().pad(0.2))
    placeMarker(history[history.length - 1])
    setReplayIdx(history.length - 1)
  }, [history])

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
    if (history.length) checkViolations(history[replayIdx] || history[history.length - 1])
  }, [fences])

  function placeMarker(point) {
    if (!mapInstanceRef.current) return
    if (markerRef.current) markerRef.current.remove()
    markerRef.current = L.marker([point.latitude, point.longitude])
      .addTo(mapInstanceRef.current)
      .bindPopup(new Date(point.recorded_at).toLocaleString())
    mapInstanceRef.current.panTo([point.latitude, point.longitude])
    checkViolations(point)
  }

  function checkViolations(point) {
    const latlng  = L.latLng(point.latitude, point.longitude)
    const outside = fences
      .filter(fence => !L.polygon(fence.points).getBounds().contains(latlng))
      .map(f => f.name)
    setFenceViolations(outside)
  }

  // ── Playback ───────────────────────────────────────────────────────────────
  function startReplay() {
    clearInterval(replayTimer.current)
    setReplaying(true)
    let idx = replayIdx >= history.length - 1 ? 0 : replayIdx
    replayTimer.current = setInterval(() => {
      if (idx >= history.length - 1) {
        clearInterval(replayTimer.current); setReplaying(false); return
      }
      idx++
      placeMarker(history[idx])
      setReplayIdx(idx)
    }, replaySpeed)
  }

  function pauseReplay() { clearInterval(replayTimer.current); setReplaying(false) }

  function scrubTo(idx) {
    pauseReplay()
    setReplayIdx(idx)
    placeMarker(history[idx])
  }

  useEffect(() => () => clearInterval(replayTimer.current), [])

  // ── Geo-fence drawing ──────────────────────────────────────────────────────
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
        user_id: userId,
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

  // ── Clear tracks ───────────────────────────────────────────────────────────
  async function clearTracks() {
    if (!clearFrom || !clearTo) return
    if (!window.confirm(`Delete all tracks for ${profile?.full_name} between ${clearFrom} and ${clearTo}? This cannot be undone.`)) return
    setClearing(true); setClearResult(null)
    try {
      const from_dt = new Date(clearFrom).toISOString()
      const to_dt   = new Date(clearTo + 'T23:59:59').toISOString()
      const { data } = await api.delete(`/locations/history/${userId}`, { params: { from_dt, to_dt } })
      setClearResult({ deleted: data.deleted })
      const res = await api.get(`/locations/history/${userId}?limit=500`)
      setHistory(res.data.points)
      setReplayIdx(0)
    } catch (err) {
      setClearResult({ error: err.response?.data?.detail || 'Failed to clear tracks' })
    } finally {
      setClearing(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const currentPoint = history[replayIdx]

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f4' }}>
      <header style={headerStyle}>
        <button onClick={() => navigate(-1)} style={ghostBtn}>← Back</button>
        <span style={{ fontWeight: 500 }}>{profile?.full_name || '…'}</span>
        <button onClick={logout} style={ghostBtn}>Sign out</button>
      </header>

      <div style={{ display: 'flex', height: 'calc(100vh - 57px)' }}>

        {/* Side panel */}
        <div style={{ width: 292, background: '#fff', borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
          <div style={{ padding: 20 }}>

            {/* Profile */}
            {profile && (
              <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #f0f0ef' }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{profile.full_name}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>{profile.email}</div>
                {profile.device_label && (
                  <div style={{ fontSize: 12, color: '#666', marginTop: 6, background: '#f5f5f4', borderRadius: 6, padding: '3px 8px', display: 'inline-block' }}>
                    {profile.device_label}
                  </div>
                )}
              </div>
            )}

            {/* Violations */}
            {fenceViolations.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
                ⚠ Outside zone: {fenceViolations.join(', ')}
              </div>
            )}

            {/* Playback */}
            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #f0f0ef' }}>
              <div style={sectionLabel}>Playback</div>
              {history.length === 0 ? (
                <div style={{ fontSize: 13, color: '#aaa' }}>No location history yet.</div>
              ) : (
                <>
                  {currentPoint && (
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
                      {new Date(currentPoint.recorded_at).toLocaleString()}
                    </div>
                  )}
                  <input type="range" min={0} max={history.length - 1} value={replayIdx}
                    onChange={e => scrubTo(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#1D9E75', marginBottom: 10, cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <button onClick={replaying ? pauseReplay : startReplay}
                      style={{ ...actionBtn, flex: 1, background: replaying ? '#dc2626' : '#1D9E75' }}>
                      {replaying ? '⏸ Pause' : replayIdx >= history.length - 1 ? '↺ Restart' : '▶ Play'}
                    </button>
                    <button onClick={() => scrubTo(0)} style={{ ...ghostBtn, padding: '8px 10px' }}>⏮</button>
                    <button onClick={() => scrubTo(history.length - 1)} style={{ ...ghostBtn, padding: '8px 10px' }}>⏭</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888' }}>
                    <span>Speed</span>
                    {[{ label: '0.5×', ms: 600 }, { label: '1×', ms: 300 }, { label: '2×', ms: 150 }, { label: '4×', ms: 75 }].map(s => (
                      <button key={s.ms} onClick={() => setReplaySpeed(s.ms)} style={{
                        background: replaySpeed === s.ms ? '#1D9E75' : '#f0f0ef',
                        color: replaySpeed === s.ms ? '#fff' : '#555',
                        border: 'none', borderRadius: 5, padding: '3px 8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit'
                      }}>{s.label}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>Point {replayIdx + 1} of {history.length}</div>
                </>
              )}
            </div>

            {/* Geo-fences */}
            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #f0f0ef' }}>
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
              {fences.length === 0 && !drawingFence && (
                <div style={{ fontSize: 13, color: '#aaa' }}>No fences yet.</div>
              )}
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

            {/* Clear tracks */}
            <div>
              <div style={sectionLabel}>Clear Tracks</div>
              {!showClear ? (
                <button onClick={() => { setShowClear(true); setClearResult(null) }}
                  style={{ ...actionBtn, background: '#f0f0ef', color: '#555', width: '100%', fontSize: 13 }}>
                  🗑 Clear date range
                </button>
              ) : (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={inputLabel}>From</label>
                    <input type="date" value={clearFrom} onChange={e => setClearFrom(e.target.value)} style={dateInput} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={inputLabel}>To</label>
                    <input type="date" value={clearTo} onChange={e => setClearTo(e.target.value)} style={dateInput} />
                  </div>
                  {clearResult && (
                    <div style={{ fontSize: 12, marginBottom: 10, padding: '7px 10px', borderRadius: 6,
                      background: clearResult.error ? '#fef2f2' : '#f0fdf4',
                      color: clearResult.error ? '#dc2626' : '#15803d',
                      border: `1px solid ${clearResult.error ? '#fca5a5' : '#bbf7d0'}` }}>
                      {clearResult.error ? `⚠ ${clearResult.error}` : `✓ Deleted ${clearResult.deleted} point${clearResult.deleted !== 1 ? 's' : ''}`}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={clearTracks} disabled={!clearFrom || !clearTo || clearing}
                      style={{ ...actionBtn, flex: 1, background: '#dc2626', fontSize: 13, opacity: (!clearFrom || !clearTo) ? 0.5 : 1 }}>
                      {clearing ? 'Clearing…' : 'Clear'}
                    </button>
                    <button onClick={() => { setShowClear(false); setClearResult(null) }} style={{ ...ghostBtn, fontSize: 13 }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Map */}
        <div ref={mapRef} style={{ flex: 1 }} />
      </div>
    </div>
  )
}

const headerStyle  = { background: '#fff', borderBottom: '1px solid #eee', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const ghostBtn     = { background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
const actionBtn    = { padding: '9px 12px', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }
const sectionLabel = { fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }
const inputLabel   = { display: 'block', fontSize: 12, color: '#555', marginBottom: 4, fontWeight: 500 }
const dateInput    = { width: '100%', padding: '7px 10px', border: '1px solid #ddd', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', color: '#111', outline: 'none' }
