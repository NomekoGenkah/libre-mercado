import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

// Marco de la aplicación autenticada: sidebar fijo + topbar + área de contenido.
export function AppLayout() {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-60">
        <Topbar />
        <main className="mx-auto max-w-[1320px] px-5 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// Encabezado de página reutilizable: kicker técnico + título + acciones.
export function PageHeader({ codigo, titulo, descripcion, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        {codigo && (
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider3 text-accent">{codigo}</p>
        )}
        <h1 className="font-display text-2xl font-800 tracking-tight text-ink lg:text-[28px]">
          {titulo}
        </h1>
        {descripcion && <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{descripcion}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
