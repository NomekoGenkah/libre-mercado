import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSalud } from '../ui/NodesPanel'
import { Icon } from '../ui/icons'

function useTheme() {
  const [tema, setTema] = useState(() =>
    document.documentElement.classList.contains('light') ? 'light' : 'dark'
  )

  const toggle = () => {
    setTema((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.classList.toggle('light', next === 'light')
      localStorage.setItem('libre-mercado-theme', next)
      return next
    })
  }

  return { tema, toggle }
}

export function Topbar() {
  const { usuario, logout, tieneRol } = useAuth()
  const esAdmin = tieneRol('admin')
  // El estado del clúster es infraestructura: solo lo ve (y consulta) el admin.
  const salud = useSalud(15000, esAdmin)
  const { tema, toggle } = useTheme()
  const [reloj, setReloj] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setReloj(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const nodos = salud?.nodos || {}
  const totales = Object.keys(nodos).length
  const arriba = Object.values(nodos).filter((v) => v === 'ok').length
  const todoOk = totales > 0 && arriba === totales

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-line px-5 lg:px-8">
      {/* Estado de nodos — infraestructura, solo admin. */}
      {esAdmin ? (
        <div className="flex items-center gap-2.5 rounded border border-line bg-surface/60 px-3 py-1.5">
          <span className="relative flex h-2 w-2">
            {todoOk && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok/60" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${todoOk ? 'bg-ok' : salud ? 'bg-danger' : 'bg-ink-faint'}`} />
          </span>
          <span className="text-[12px] font-600 text-ink-soft">
            Clúster {totales ? `${arriba}/${totales}` : '··'}
          </span>
          <span className="hidden text-[12px] text-ink-faint sm:inline">
            {todoOk ? 'operativo' : salud ? 'degradado' : ''}
          </span>
        </div>
      ) : (
        <div />
      )}

      {/* Controles + usuario */}
      <div className="flex items-center gap-3">
        <span className="hidden font-mono text-[12px] tabular text-ink-faint sm:block">
          {reloj.toLocaleTimeString('es-CL', { hour12: false })}
        </span>

        <button
          onClick={toggle}
          className="btn-quiet btn-sm"
          title={tema === 'light' ? 'Modo oscuro' : 'Modo claro'}
        >
          <Icon name={tema === 'light' ? 'moon' : 'sun'} className="h-4 w-4" />
        </button>

        <div className="hidden text-right leading-tight sm:block">
          <p className="text-[13px] font-600 text-ink">{usuario?.username}</p>
          <p className="text-[11px] capitalize text-accent">{usuario?.rol}</p>
        </div>
        <button onClick={logout} className="btn-quiet btn-sm gap-1.5" title="Cerrar sesión">
          <Icon name="logout" className="h-4 w-4" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  )
}
