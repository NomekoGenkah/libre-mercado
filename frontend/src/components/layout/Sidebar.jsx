import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { SECCIONES } from './nav'

// Barra lateral fija. Marca de producto + topología en miniatura abajo.
export function Sidebar() {
  const { tieneRol } = useAuth()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line-strong bg-surface lg:flex">
      {/* Marca */}
      <div className="relative border-b border-line-strong px-5 py-5">
        <div className="flex items-center gap-2.5">
          <Logo />
          <div className="leading-none">
            <p className="font-display text-base font-800 tracking-tight text-ink">LIBRE MERCADO</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-wider3 text-ink-faint">
              Consola distribuida
            </p>
          </div>
        </div>
        {/* línea decorativa */}
        <div className="absolute -bottom-px left-5 h-px w-8 bg-accent" />
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {SECCIONES.map((seccion) => {
          const visibles = seccion.items.filter((it) => !it.adminOnly || tieneRol('admin'))
          if (visibles.length === 0) return null
          return (
            <div key={seccion.grupo} className="mb-5">
              <p className="px-2 pb-2 font-mono text-[9px] uppercase tracking-wider3 text-ink-faint">
                {seccion.grupo}
              </p>
              <ul className="space-y-0.5">
                {visibles.map((it) => (
                  <li key={it.to}>
                    <NavLink
                      to={it.to}
                      className={({ isActive }) =>
                        [
                          'group flex items-center gap-3 border-l-2 px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'border-accent bg-accent-soft font-600 text-ink'
                            : 'border-transparent text-ink-muted hover:border-line hover:bg-paper hover:text-ink',
                        ].join(' ')
                      }
                    >
                      <span
                        className={`w-4 text-center font-mono text-xs ${
                          it.destacado ? 'text-accent' : 'text-ink-faint group-hover:text-ink'
                        }`}
                      >
                        {it.glifo}
                      </span>
                      <span className="flex-1">{it.etiqueta}</span>
                      {it.nota && (
                        <span className="font-mono text-[9px] tracking-wider2 text-accent">{it.nota}</span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Pie: leyenda CP */}
      <div className="border-t border-line px-5 py-4">
        <p className="font-mono text-[9px] uppercase tracking-wider2 text-ink-faint">Modelo</p>
        <p className="mt-1 font-display text-sm font-700 text-ink">
          CP <span className="font-sans text-xs font-400 text-ink-muted">· Consistencia + Particiones</span>
        </p>
        <div className="mt-2 flex gap-1">
          <span className="h-1 flex-1 bg-accent" />
          <span className="h-1 flex-1 bg-ink" />
          <span className="h-1 flex-1 bg-line" />
        </div>
      </div>
    </aside>
  )
}

// Logotipo: cuadro con un punto-nodo y dos enlaces. Puramente geométrico.
function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" className="shrink-0" aria-hidden>
      <rect x="1" y="1" width="32" height="32" fill="#15181d" />
      <circle cx="17" cy="11" r="3" fill="#1c44ff" />
      <circle cx="10" cy="24" r="2.4" fill="#fff" />
      <circle cx="24" cy="24" r="2.4" fill="#fff" />
      <path d="M17 11 L10 24 M17 11 L24 24" stroke="#5b6472" strokeWidth="1.2" />
    </svg>
  )
}
