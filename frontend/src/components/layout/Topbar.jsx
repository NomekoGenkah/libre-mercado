import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../api/client'

// Barra superior: reloj técnico, estado de nodos (ping a /salud) y menú de usuario.
export function Topbar() {
  const { usuario, logout } = useAuth()
  const [salud, setSalud] = useState(null)
  const [reloj, setReloj] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setReloj(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let activo = true
    const consultar = () => {
      // /salud responde 200 (ok) o 503 (algún nodo caído); ambos traen data.nodos.
      api
        .get('/salud')
        .then((d) => activo && setSalud({ ok: true, nodos: d?.nodos }))
        .catch((e) => activo && setSalud({ ok: false, nodos: e?.detalle?.nodos }))
    }
    consultar()
    const t = setInterval(consultar, 15000)
    return () => {
      activo = false
      clearInterval(t)
    }
  }, [])

  const nodos = salud?.nodos || {}
  const totales = Object.keys(nodos).length
  const arriba = Object.values(nodos).filter((v) => v === 'ok').length
  const todoOk = totales > 0 && arriba === totales

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-5 backdrop-blur">
      {/* Estado de nodos */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 ${todoOk ? 'bg-ok' : salud ? 'bg-danger animate-blink' : 'bg-line'}`}
          />
          <span className="font-mono text-[11px] uppercase tracking-wider2 text-ink-muted">
            Nodos {totales ? `${arriba}/${totales}` : '—'}
          </span>
        </div>
        <div className="hidden items-center gap-1.5 md:flex">
          {['central', 'norte', 'sur', 'este'].map((k) => {
            const ok = nodos[k] === 'ok'
            const conocido = k in nodos
            return (
              <span
                key={k}
                title={`${k}: ${nodos[k] || 'desconocido'}`}
                className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider2 ${
                  !conocido
                    ? 'border-line text-ink-faint'
                    : ok
                      ? 'border-ok/40 bg-okSoft text-ok'
                      : 'border-danger/50 bg-dangerSoft text-danger'
                }`}
              >
                {k.slice(0, 4)}
              </span>
            )
          })}
        </div>
      </div>

      {/* Reloj + usuario */}
      <div className="flex items-center gap-4">
        <span className="hidden font-mono text-[11px] tabular text-ink-faint sm:block">
          {reloj.toLocaleTimeString('es-CL', { hour12: false })}
        </span>
        <div className="flex items-center gap-3 border-l border-line pl-4">
          <div className="text-right leading-tight">
            <p className="font-mono text-xs font-600 text-ink">{usuario?.username}</p>
            <p className="font-mono text-[9px] uppercase tracking-wider2 text-accent">{usuario?.rol}</p>
          </div>
          <button onClick={logout} className="btn-quiet btn-sm" title="Cerrar sesión">
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
