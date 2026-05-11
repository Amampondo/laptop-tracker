import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'

export default function OrgList() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/organisations').then(r => setOrgs(r.data)).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    try {
      const { data } = await api.post('/organisations/', form)
      setOrgs(prev => [...prev, data])
      setShowForm(false)
      setForm({ name: '', slug: '' })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create organisation')
    }
  }

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <span style={{ fontWeight: 500, color: '#111' }}>Laptop Tracker</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#555' }}>{user?.email}</span>
          <button onClick={logout} style={ghostBtn}>Sign out</button>
        </div>
      </header>
      <main style={mainStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 500, color: '#111', margin: 0 }}>All organisations</h2>
          <button onClick={() => setShowForm(!showForm)} style={primaryBtn}>
            {showForm ? 'Cancel' : '+ New organisation'}
          </button>
        </div>

        {showForm && (
          <div style={formCard}>
            <h3 style={{ fontSize: 16, fontWeight: 500, color: '#111', marginBottom: 16 }}>Create organisation</h3>
            <form onSubmit={handleCreate}>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Acme Corp" />
              <label style={labelStyle}>Slug</label>
              <input style={inputStyle} value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} required placeholder="e.g. acme-corp" />
              {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <button type="submit" style={primaryBtn}>Create</button>
            </form>
          </div>
        )}

        {loading ? <p style={{ color: '#555' }}>Loading…</p> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {orgs.length === 0 && <p style={{ color: '#555' }}>No organisations yet. Create one above.</p>}
            {orgs.map(org => (
              <div key={org.id} style={cardStyle} onClick={() => navigate(`/orgs/${org.id}`)}>
                <div>
                  <div style={{ fontWeight: 500, color: '#111' }}>{org.name}</div>
                  <div style={{ fontSize: 13, color: '#555' }}>{org.slug}</div>
                </div>
                <span style={{ fontSize: 13, color: '#1D9E75' }}>View →</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

const pageStyle = { minHeight: '100vh', background: '#f0f0ef', fontFamily: 'system-ui, -apple-system, sans-serif' }
const headerStyle = { background: '#ffffff', borderBottom: '1px solid #ddd', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const mainStyle = { maxWidth: 760, margin: '0 auto', padding: '32px 24px' }
const cardStyle = { background: '#ffffff', border: '1px solid #ddd', borderRadius: 10, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }
const ghostBtn = { background: 'none', border: '1px solid #bbb', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', color: '#333' }
const primaryBtn = { background: '#1D9E75', color: '#ffffff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 14, cursor: 'pointer', fontWeight: 500 }
const formCard = { background: '#ffffff', border: '1px solid #ddd', borderRadius: 10, padding: '20px 24px', marginBottom: 20 }
const labelStyle = { display: 'block', fontSize: 13, color: '#333', marginBottom: 4, fontWeight: 500 }
const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #ccc', borderRadius: 8, fontSize: 14, marginBottom: 14, boxSizing: 'border-box', color: '#111', background: '#fff' }
