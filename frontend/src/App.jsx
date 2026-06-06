import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { Spinner } from './components/ui/primitives'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Productos from './pages/Productos'
import Clientes from './pages/Clientes'
import Proveedores from './pages/Proveedores'
import Usuarios from './pages/Usuarios'
import Ventas from './pages/Ventas'
import Stock from './pages/Stock'
import Compras from './pages/Compras'
import SimuladorCap from './pages/SimuladorCap'
import NoEncontrado from './pages/NoEncontrado'

// Pantalla de arranque mientras se rehidrata la sesión (GET /auth/me).
function Arranque() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3">
        <Spinner size={20} />
        <span className="font-mono text-xs uppercase tracking-wider2 text-ink-muted">
          Inicializando consola…
        </span>
      </div>
    </div>
  )
}

// Verja de sesión. Si no hay usuario, redirige a /login conservando el destino.
function Protegido({ children }) {
  const { usuario, cargando } = useAuth()
  const loc = useLocation()
  if (cargando) return <Arranque />
  if (!usuario) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return children
}

// Verja de rol admin (Usuarios, Simulador CAP).
function SoloAdmin({ children }) {
  const { tieneRol } = useAuth()
  return tieneRol('admin') ? children : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <Protegido>
            <AppLayout />
          </Protegido>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/productos" element={<Productos />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/proveedores" element={<Proveedores />} />
        <Route path="/ventas" element={<Ventas />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/compras" element={<Compras />} />
        <Route
          path="/usuarios"
          element={
            <SoloAdmin>
              <Usuarios />
            </SoloAdmin>
          }
        />
        <Route
          path="/simulador-cap"
          element={
            <SoloAdmin>
              <SimuladorCap />
            </SoloAdmin>
          }
        />
        <Route path="*" element={<NoEncontrado />} />
      </Route>
    </Routes>
  )
}
