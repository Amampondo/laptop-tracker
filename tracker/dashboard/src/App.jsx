import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/orgs" element={<Guard roles={['super']}><OrgList /></Guard>} />
          <Route path="/orgs/:orgId" element={<Guard roles={['super', 'manager']}><OrgDetail /></Guard>} />
          <Route path="/orgs/:orgId/register" element={<Guard roles={['super', 'manager']}><RegisterUser /></Guard>} />
          <Route path="/users/:userId" element={<Guard><UserDetail /></Guard>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
