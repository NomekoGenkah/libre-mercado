import { Link, Outlet } from 'react-router-dom'
import { Brand } from './Brand'
import { Icon } from '../ui/icons'

// ===========================================================================
//  Marco de la TIENDA PÚBLICA. Lo ve un comprador SIN sesión: cabecera con la
//  marca y un acceso discreto para el equipo ("Ingresar"). Sin sidebar, sin
//  indicadores de infraestructura — nada de la naturaleza distribuida asoma
//  por aquí; eso vive en la consola interna.
// ===========================================================================
export function PublicLayout() {
  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-4 px-5 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <Brand className="h-9 w-9" />
            <div className="leading-tight">
              <p className="font-display text-[15px] font-800 tracking-tight text-ink">Libre Mercado</p>
              <p className="text-[11px] text-ink-faint">Tienda en línea</p>
            </div>
          </Link>

          <Link to="/login" className="btn-quiet btn-sm gap-1.5">
            <Icon name="usuarios" className="h-4 w-4" />
            <span>Ingresar</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-5 py-8 lg:px-8 lg:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-[1180px] px-5 py-6 lg:px-8">
          <p className="text-[12px] text-ink-faint">
            Libre Mercado · catálogo en línea. ¿Eres del equipo?{' '}
            <Link to="/login" className="font-600 text-ink-muted hover:text-accent">
              Ingresa a la consola
            </Link>
            .
          </p>
        </div>
      </footer>
    </div>
  )
}
