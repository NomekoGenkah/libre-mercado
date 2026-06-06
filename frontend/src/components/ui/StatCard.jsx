import { Kicker } from './primitives'

// ===========================================================================
//  Tarjeta de métrica. Barra de acento a la izquierda, valor en grande con
//  numeración tabular, sufijo/etiqueta y una micro-pista opcional.
// ===========================================================================
export function StatCard({ etiqueta, valor, sufijo, pista, tono = 'accent', delay = 0 }) {
  const barra = {
    accent: 'bg-accent',
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
    ink: 'bg-ink',
  }[tono]

  return (
    <div
      className="panel shadow-frame flex animate-riseIn"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`w-1 shrink-0 ${barra}`} />
      <div className="flex-1 px-4 py-4">
        <Kicker className="text-ink-faint">{etiqueta}</Kicker>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="font-mono text-3xl font-600 tabular tracking-tight text-ink">{valor}</span>
          {sufijo && <span className="font-mono text-xs uppercase tracking-wider2 text-ink-faint">{sufijo}</span>}
        </div>
        {pista && <p className="mt-1.5 text-xs text-ink-muted">{pista}</p>}
      </div>
    </div>
  )
}
