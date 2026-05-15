import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      if (user.role === 'super') navigate('/orgs')
      else if (user.role === 'manager') navigate(`/orgs/${user.organisation_id}`)
      else navigate(`/users/${user.id}`)
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f4' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 40, width: 360, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>recoversoft</h1>
        <p style={{ color: '#888', marginBottom: 28, fontSize: 14 }}>Sign in to your account</p>
        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Email</label>
          <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label style={labelStyle}>Password</label>
          <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button style={btnStyle} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 13, color: '#333', marginBottom: 4, fontWeight: 500 }
const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #ccc', borderRadius: 8, fontSize: 14, marginBottom: 16, boxSizing: 'border-box', color: '#111', background: '#fff' }
const btnStyle = { width: '100%', padding: '10px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer', fontWeight: 500 }
