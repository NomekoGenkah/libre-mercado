import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

// Marco de la aplicación autenticada: sidebar fijo + topbar + área de contenido.
export function AppLayout() {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-64">
        <Topbar />
        <main className="mx-auto max-w-[1320px] px-5 py-7 lg:px-8 lg:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// Encabezado de página reutilizable: eyebrow + título + acciones.
export function PageHeader({ codigo, titulo, descripcion, children }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="animate-riseIn">
        {codigo && <p className="mb-1.5 kicker text-accent">{codigo}</p>}
        <h1 className="font-display text-2xl font-800 tracking-tight text-ink lg:text-[30px]">{titulo}</h1>
        {descripcion && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{descripcion}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  )
}
