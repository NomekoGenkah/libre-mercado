import { Icon } from './icons'

// ===========================================================================
//  Tarjeta de métrica. Valor grande tabular, etiqueta, pista opcional e icono
//  con tinte según el tono.
// ===========================================================================
export function StatCard({ etiqueta, valor, sufijo, pista, tono = 'accent', icono, delay = 0 }) {
  const t = {
    accent: { tint: 'bg-accent/12 text-accent', glow: 'before:bg-accent/40' },
    ok: { tint: 'bg-ok/12 text-ok', glow: 'before:bg-ok/40' },
    warn: { tint: 'bg-warn/12 text-warn', glow: 'before:bg-warn/40' },
    danger: { tint: 'bg-danger/12 text-danger', glow: 'before:bg-danger/40' },
    ink: { tint: 'bg-surface2 text-ink-soft', glow: 'before:bg-line-strong' },
  }[tono]

  return (
    <div
      className={`panel group relative overflow-hidden p-5 shadow-frame transition-colors hover:border-line-strong
                  before:absolute before:-right-6 before:-top-6 before:h-20 before:w-20 before:rounded-full before:opacity-40 before:blur-2xl ${t.glow}
                  animate-riseIn`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[13px] font-500 text-ink-muted">{etiqueta}</p>
        {icono && (
          <span className={`grid h-8 w-8 place-items-center rounded-lg ${t.tint}`}>
            <Icon name={icono} className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
      <div className="relative mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-[30px] font-800 leading-none tabular tracking-tight text-ink">{valor}</span>
        {sufijo && <span className="text-[12px] font-500 text-ink-faint">{sufijo}</span>}
      </div>
      {pista && <p className="relative mt-2 text-[12px] text-ink-faint">{pista}</p>}
    </div>
  )
}
