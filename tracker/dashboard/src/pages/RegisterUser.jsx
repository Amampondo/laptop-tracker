import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'

export default function RegisterUser() {
  const { orgId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', device_label: '', role: 'user' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/users/', { ...form, organisation_id: orgId })
      navigate(`/orgs/${orgId}?tab=users`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to register user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f4' }}>
      <header style={headerStyle}>
        <button onClick={() => navigate(-1)} style={ghostBtn}>← Back</button>
        <span style={{ fontWeight: 500 }}>Register new user</span>
        <span />
      </header>
      <main style={{ maxWidth: 480, margin: '40px auto', padding: '0 24px' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 32 }}>
          <form onSubmit={handleSubmit}>
            {[['Full name', 'full_name', 'text'], ['Email', 'email', 'email'], ['Password', 'password', 'password'], ['Device label', 'device_label', 'text']].map(([label, key, type]) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <input style={inputStyle} type={type} value={form[key]} onChange={set(key)} required={key !== 'device_label'} placeholder={key === 'device_label' ? 'e.g. John\'s Dell XPS (optional)' : ''} />
              </div>
            ))}
            {user?.role === 'super' && (
              <div>
                <label style={labelStyle}>Role</label>
                <select style={inputStyle} value={form.role} onChange={set('role')}>
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            )}
            {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button style={btnStyle} type="submit" disabled={loading}>
              {loading ? 'Registering…' : 'Register user'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

const headerStyle = { background: '#fff', borderBottom: '1px solid #eee', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const labelStyle = { display: 'block', fontSize: 13, color: '#555', marginBottom: 4 }
const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }
const btnStyle = { width: '100%', padding: 10, background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer', fontWeight: 500 }
const ghostBtn = { background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer' }
