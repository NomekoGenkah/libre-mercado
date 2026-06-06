import { useState } from 'react'
import { useNavigate, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { NodeDiagram } from '../components/ui/NodeDiagram'
import { CornerMarks } from '../components/ui/primitives'
import { Field, TextInput } from '../components/ui/Field'
import { Spinner } from '../components/ui/primitives'

// Credenciales sembradas (visibles para la demo académica).
const DEMO = [
  { u: 'admin', p: 'admin123', rol: 'admin' },
  { u: 'vendedor', p: 'vendedor123', rol: 'vendedor' },
  { u: 'bodeguero', p: 'bodeguero123', rol: 'bodeguero' },
]

export default function Login() {
  const { usuario, login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  if (usuario) return <Navigate to={loc.state?.from || '/dashboard'} replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await login(username.trim(), password)
      nav(loc.state?.from || '/dashboard', { replace: true })
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
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel izquierdo: identidad + topología */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line-strong bg-ink p-10 text-white lg:flex">
        {/* retícula */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-wider3 text-accent">
            Sistemas Distribuidos · 2.ª evaluación
          </p>
          <h1 className="mt-3 font-display text-4xl font-900 leading-none tracking-tight">
            LIBRE
            <br />
            MERCADO
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
            Consola de operaciones para un e-commerce distribuido sobre 4 nodos MariaDB.
            Ventas atómicas (Two-Phase Commit) y arquitectura <span className="text-white">CP</span>.
          </p>
        </div>

        <div className="relative border border-white/15 bg-white/[0.03] p-5">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wider2 text-white/40">
            Topología · red_distribuida
          </p>
          <div className="[&_text]:fill-white/80 [&_rect]:fill-transparent">
            <NodeDiagram className="invert-0" />
          </div>
        </div>

        <div className="relative flex gap-1">
          <span className="h-1 w-16 bg-accent" />
          <span className="h-1 w-8 bg-white/40" />
          <span className="h-1 w-4 bg-white/20" />
        </div>
      </div>

      {/* Panel derecho: formulario */}
      <div className="flex items-center justify-center bg-paper p-6 sm:p-10">
        <div className="panel relative w-full max-w-md bg-surface p-8 shadow-lift animate-riseIn">
          <CornerMarks />
          <p className="font-mono text-[10px] uppercase tracking-wider3 text-accent">Acceso</p>
          <h2 className="mt-2 font-display text-2xl font-800 tracking-tight text-ink">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-ink-muted">Autenticación por sesión PHP + roles.</p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
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
              <div className="border-l-[3px] border-danger bg-dangerSoft px-3 py-2.5">
                <p className="font-mono text-[11px] tracking-wide text-danger">{error}</p>
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={enviando}>
              {enviando ? <Spinner size={14} className="border-white/40 border-t-white" /> : '→'} Entrar
            </button>
          </form>

          {/* Accesos rápidos de demo */}
          <div className="mt-7 border-t border-line pt-5">
            <p className="mb-2.5 font-mono text-[10px] uppercase tracking-wider2 text-ink-faint">
              Credenciales de demo
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.u}
                  type="button"
                  onClick={() => rellenar(d)}
                  className="group border border-line bg-paper px-2 py-2 text-left transition-colors hover:border-accent hover:bg-accent-soft"
                >
                  <span className="block font-mono text-[11px] font-600 text-ink">{d.u}</span>
                  <span className="block font-mono text-[9px] uppercase tracking-wider2 text-ink-faint group-hover:text-accent">
                    {d.rol}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
