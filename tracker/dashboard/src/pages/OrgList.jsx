import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'

export default function OrgList() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/organisations').then(r => setOrgs(r.data)).finally(() => setLoading(false))
  }, [])

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <span style={{ fontWeight: 500 }}>Laptop Tracker</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#888' }}>{user?.email}</span>
          <button onClick={logout} style={ghostBtn}>Sign out</button>
        </div>
      </header>
      <main style={mainStyle}>
        <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 20 }}>All organisations</h2>
        {loading ? <p style={{ color: '#888' }}>Loading…</p> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {orgs.map(org => (
              <div key={org.id} style={cardStyle} onClick={() => navigate(`/orgs/${org.id}`)}>
                <span style={{ fontWeight: 500 }}>{org.name}</span>
                <span style={{ fontSize: 13, color: '#888' }}>{org.slug}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

const pageStyle = { minHeight: '100vh', background: '#f5f5f4' }
const headerStyle = { background: '#fff', borderBottom: '1px solid #eee', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const mainStyle = { maxWidth: 760, margin: '0 auto', padding: '32px 24px' }
const cardStyle = { background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }
const ghostBtn = { background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer' }
