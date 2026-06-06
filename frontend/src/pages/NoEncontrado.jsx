import { Link } from 'react-router-dom'

export default function NoEncontrado() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="font-mono text-[64px] font-700 leading-none tracking-tight text-ink">404</p>
      <div className="my-4 h-px w-24 bg-accent" />
      <p className="font-mono text-xs uppercase tracking-wider2 text-ink-muted">Ruta no encontrada</p>
      <Link to="/dashboard" className="btn-ghost mt-6">
        ← Volver al dashboard
      </Link>
    </div>
  )
}
