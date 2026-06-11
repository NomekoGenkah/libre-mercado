import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { PublicLayout } from './components/layout/PublicLayout'
import { Spinner } from './components/ui/primitives'
import { inicioDeRol } from './components/layout/nav'

// Tienda pública (comprador, SIN login)
import Tienda from './pages/Tienda'
import ProductoPublico from './pages/ProductoPublico'

// Consola interna (staff)
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

// Verja de rol. `roles` = perfiles permitidos (admin siempre pasa). Si el rol
// no califica, lo devolvemos al inicio que le corresponde a su perfil — así un
// vendedor nunca aterriza en una pantalla de infraestructura.
function ConRol({ roles, children }) {
  const { usuario, tieneRol } = useAuth()
  if (!tieneRol(...roles)) return <Navigate to={inicioDeRol(usuario?.rol)} replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* ---- Mundo público: la tienda que ve un comprador sin sesión ---- */}
      <Route element={<PublicLayout />}>
        <Route index element={<Tienda />} />
        <Route path="/producto/:id" element={<ProductoPublico />} />
      </Route>

      <Route path="/login" element={<Login />} />

      {/* ---- Mundo interno: consola de operación (requiere sesión) ---- */}
      <Route
        element={
          <Protegido>
            <AppLayout />
          </Protegido>
        }
      >
        <Route path="/dashboard" element={<ConRol roles={['vendedor', 'bodeguero']}><Dashboard /></ConRol>} />
        <Route path="/ventas" element={<ConRol roles={['vendedor']}><Ventas /></ConRol>} />
        <Route path="/stock" element={<ConRol roles={['vendedor', 'bodeguero']}><Stock /></ConRol>} />
        <Route path="/compras" element={<ConRol roles={['bodeguero']}><Compras /></ConRol>} />
        <Route path="/productos" element={<ConRol roles={['vendedor', 'bodeguero']}><Productos /></ConRol>} />
        <Route path="/clientes" element={<ConRol roles={['vendedor']}><Clientes /></ConRol>} />
        <Route path="/proveedores" element={<ConRol roles={['bodeguero']}><Proveedores /></ConRol>} />
        <Route path="/usuarios" element={<ConRol roles={[]}><Usuarios /></ConRol>} />
        <Route path="/simulador-cap" element={<ConRol roles={[]}><SimuladorCap /></ConRol>} />
        <Route path="*" element={<NoEncontrado />} />
      </Route>
    </Routes>
  )
}
