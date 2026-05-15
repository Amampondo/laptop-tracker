import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import { useLocationReporter } from './useLocationReporter'
import Home from './pages/Home'
import Login from './pages/Login'
import OrgList from './pages/OrgList'
import OrgDetail from './pages/OrgDetail'
import RegisterUser from './pages/RegisterUser'
import UserDetail from './pages/UserDetail'

function Guard({ children, roles }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />
  return children
}

// Sits inside AuthProvider so it can read the logged-in user
function TrackerCore() {
  const { user } = useAuth()
  useLocationReporter(user)   // starts/stops reporting as user logs in or out

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/orgs" element={<Guard roles={['super']}><OrgList /></Guard>} />
      <Route path="/orgs/:orgId" element={<Guard roles={['super', 'manager']}><OrgDetail /></Guard>} />
      <Route path="/orgs/:orgId/register" element={<Guard roles={['super', 'manager']}><RegisterUser /></Guard>} />
      <Route path="/users/:userId" element={<Guard><UserDetail /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <TrackerCore />
      </BrowserRouter>
    </AuthProvider>
  )
}
