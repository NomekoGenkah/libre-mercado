import { useState } from 'react'
import { useNavigate, Navigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Field, TextInput } from '../components/ui/Field'
import { Spinner } from '../components/ui/primitives'
import { Brand } from '../components/layout/Brand'
import { Icon } from '../components/ui/icons'
import { inicioDeRol } from '../components/layout/nav'

// Credenciales sembradas (visibles para la demo académica).
const DEMO = [
  { u: 'admin', p: 'admin123', rol: 'Administrador' },
  { u: 'vendedor', p: 'vendedor123', rol: 'Ventas' },
  { u: 'bodeguero', p: 'bodeguero123', rol: 'Bodega' },
]

export default function Login() {
  const { usuario, login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  if (usuario) return <Navigate to={loc.state?.from || inicioDeRol(usuario.rol)} replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const u = await login(username.trim(), password)
      nav(loc.state?.from || inicioDeRol(u.rol), { replace: true })
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.')
    } finally {
      setEnviando(false)
    }
  }

  const rellenar = (d) => {
    setUsername(d.u)
    setPassword(d.p)
    setError(null)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <NetworkBackground />

      <div className="relative z-10 w-full max-w-md animate-riseIn">
        {/* Marca */}
        <div className="mb-7 flex flex-col items-center text-center">
          <Brand className="h-14 w-14" />
          <h1 className="mt-4 font-display text-3xl font-800 tracking-tight">
            <span className="text-gradient">Libre Mercado</span>
          </h1>
          <p className="mt-2 text-sm text-ink-muted">Plataforma de comercio distribuido</p>
        </div>

        {/* Tarjeta */}
        <div className="panel bg-surface/70 p-7 shadow-lift backdrop-blur-xl sm:p-8">
          <h2 className="font-display text-lg font-700 text-ink">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-ink-muted">Ingresa tus credenciales para continuar.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="Usuario" required>
              <TextInput
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                autoFocus
                required
              />
            </Field>
            <Field label="Contraseña" required>
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </Field>

            {error && (
              <div className="flex items-start gap-2.5 rounded border border-danger/30 bg-danger/10 px-3.5 py-2.5">
                <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <p className="text-sm text-ink-soft">{error}</p>
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={enviando}>
              {enviando ? <Spinner size={15} /> : <Icon name="arrow" className="h-4 w-4" />}
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          {/* Accesos rápidos de demo */}
          <div className="mt-6 border-t border-line pt-5">
            <p className="mb-2.5 text-[12px] font-600 text-ink-faint">Cuentas de demostración</p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.u}
                  type="button"
                  onClick={() => rellenar(d)}
                  className="group rounded border border-line bg-paper px-2.5 py-2.5 text-left transition-all hover:border-accent/60 hover:bg-accent/10"
                >
                  <span className="block text-[13px] font-600 text-ink">{d.u}</span>
                  <span className="block text-[10px] text-ink-faint group-hover:text-accent">{d.rol}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[12px] text-ink-faint">
          Acceso para el equipo de operación · admin · ventas · bodega
        </p>
        <p className="mt-3 text-center">
          <Link to="/" className="inline-flex items-center gap-1.5 text-[12px] font-600 text-ink-muted transition-colors hover:text-accent">
            <Icon name="arrow" className="h-3.5 w-3.5 rotate-180" />
            Volver a la tienda
          </Link>
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Fondo animado: una malla de nodos enlazados con pulsos que viajan por los
//  enlaces (representa la red distribuida), más orbes de glow flotantes.
// ---------------------------------------------------------------------------
function NetworkBackground() {
  // Nodos pseudo-aleatorios y los enlaces entre ellos (coordenadas en viewBox 0..100).
  const nodos = [
    [12, 22], [30, 12], [48, 26], [70, 14], [88, 28],
    [20, 50], [42, 58], [64, 46], [82, 60],
    [14, 80], [36, 88], [58, 78], [78, 90], [92, 76],
  ]
  const enlaces = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [2, 6], [3, 7], [4, 8],
    [5, 6], [6, 7], [7, 8], [5, 9], [6, 10], [7, 11], [8, 13],
    [9, 10], [10, 11], [11, 12], [12, 13], [1, 6], [4, 7],
  ]

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Orbes de glow */}
      <div className="absolute -left-20 top-[-10%] h-[420px] w-[420px] rounded-full bg-accent/20 blur-[120px] animate-glowPulse" />
      <div className="absolute bottom-[-15%] right-[-10%] h-[460px] w-[460px] rounded-full bg-[#3c6eff]/15 blur-[130px] animate-glowPulse" style={{ animationDelay: '2s' }} />

      {/* Malla de nodos */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full opacity-70 network-bg-svg">
        {enlaces.map(([a, b], i) => {
          const [x1, y1] = nodos[a]
          const [x2, y2] = nodos[b]
          return (
            <line
              key={`l${i}`}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#7c5cfc"
              strokeWidth="0.12"
              strokeOpacity="0.18"
            />
          )
        })}
        {/* Pulsos que viajan por algunos enlaces */}
        {enlaces.filter((_, i) => i % 3 === 0).map(([a, b], i) => {
          const [x1, y1] = nodos[a]
          const [x2, y2] = nodos[b]
          const len = Math.hypot(x2 - x1, y2 - y1)
          return (
            <line
              key={`p${i}`}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#a78bfa"
              strokeWidth="0.3"
              strokeLinecap="round"
              strokeDasharray={`${len * 0.18} ${len}`}
            >
              <animate
                attributeName="stroke-dashoffset"
                from={len * 1.18}
                to={-len * 0.18}
                dur={`${3 + (i % 4)}s`}
                begin={`${i * 0.5}s`}
                repeatCount="indefinite"
              />
            </line>
          )
        })}
        {nodos.map(([x, y], i) => (
          <g key={`n${i}`}>
            <circle cx={x} cy={y} r="0.6" fill="#c4b5fd">
              <animate
                attributeName="opacity"
                values="0.4;1;0.4"
                dur={`${2.5 + (i % 5) * 0.6}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}
      </svg>

      {/* Viñeta inferior para legibilidad */}
      <div className="absolute inset-0 bg-gradient-to-t from-base via-base/30 to-transparent" />
    </div>
  )
}
