import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { SECCIONES } from './nav'
import { Icon } from '../ui/icons'
import { Brand } from './Brand'

// Barra lateral fija. Solo muestra los ítems habilitados para el rol actual
// (cada ítem declara sus `roles` en nav.js; 'admin' pasa siempre).
export function Sidebar() {
  const { tieneRol, usuario } = useAuth()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface/60 backdrop-blur-sm lg:flex">
      {/* Marca */}
      <div className="flex items-center gap-3 px-5 py-5">
        <Brand className="h-9 w-9" />
        <div className="leading-tight">
          <p className="font-display text-[15px] font-800 tracking-tight text-ink">Libre Mercado</p>
          <p className="text-[11px] text-ink-faint">
            {tieneRol('admin') ? 'Consola distribuida' : 'Panel de operación'}
          </p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {SECCIONES.map((seccion) => {
          const visibles = seccion.items.filter((it) => tieneRol(...it.roles))
          if (visibles.length === 0) return null
          return (
            <div key={seccion.grupo} className="mb-6">
              <p className="px-3 pb-2 text-[10px] font-700 uppercase tracking-wider3 text-ink-faint">
                {seccion.grupo}
              </p>
              <ul className="space-y-1">
                {visibles.map((it) => (
                  <li key={it.to}>
                    <NavLink
                      to={it.to}
                      className={({ isActive }) =>
                        [
                          'group relative flex items-center gap-3 rounded px-3 py-2.5 text-sm font-500 transition-colors',
                          isActive
                            ? 'bg-accent/12 text-ink'
                            : 'text-ink-muted hover:bg-surface2 hover:text-ink',
                        ].join(' ')
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent" />
                          )}
                          <Icon
                            name={it.icono}
                            className={`h-[18px] w-[18px] shrink-0 ${
                              isActive ? 'text-accent' : 'text-ink-faint group-hover:text-ink-soft'
                            }`}
                          />
                          <span className="flex-1">{it.etiqueta}</span>
                          {it.destacado && (
                            <span className="h-1.5 w-1.5 rounded-full bg-accent dot-accent-glow" />
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Pie: usuario + modelo */}
      <div className="border-t border-line px-4 py-4">
        <div className="flex items-center gap-3 rounded border border-line bg-surface px-3 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 font-display text-sm font-700 text-accent">
            {usuario?.username?.[0]?.toUpperCase() || '·'}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-600 text-ink">{usuario?.username}</p>
            <p className="text-[11px] capitalize text-accent">{usuario?.rol}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
