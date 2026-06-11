// ===========================================================================
//  Primitivas de UI. Componentes pequeños y sin estado reutilizados por todas
//  las pantallas. Tema oscuro, esquinas suaves.
// ===========================================================================

import { Icon } from './icons'

/** Etiqueta tenue en mayúsculas (eyebrow). */
export function Kicker({ children, className = '' }) {
  return <span className={`kicker ${className}`}>{children}</span>
}

/** (Compat) Antiguas marcas de registro: ahora no dibujan nada. */
export function CornerMarks() {
  return null
}

/** Panel base con cabecera opcional. */
export function Panel({ title, aside, children, className = '', bodyClassName = 'p-5' }) {
  return (
    <section className={`panel shadow-frame ${className}`}>
      {(title || aside) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          {title && <h2 className="font-display text-sm font-700 text-ink">{title}</h2>}
          {aside}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

const TONOS_CHIP = {
  neutral: 'border-line text-ink-muted bg-surface2/70',
  accent: 'border-accent/40 text-accent bg-accent/10',
  ok: 'border-ok/40 text-ok bg-ok/10',
  warn: 'border-warn/40 text-warn bg-warn/10',
  danger: 'border-danger/40 text-danger bg-danger/10',
  ink: 'border-line-strong text-ink-soft bg-surface2/70',
}

/** Chip / badge semántico. */
export function Chip({ tono = 'neutral', children, dot = false, className = '' }) {
  const dotColor = {
    neutral: 'bg-ink-faint',
    accent: 'bg-accent',
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
    ink: 'bg-ink-soft',
  }[tono]
  return (
    <span className={`chip ${TONOS_CHIP[tono]} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />}
      {children}
    </span>
  )
}

/** Semáforo de stock: rojo / amarillo / verde. */
export function StockDot({ estado }) {
  const mapa = {
    rojo: { tono: 'danger', etq: 'Crítico' },
    amarillo: { tono: 'warn', etq: 'Bajo' },
    verde: { tono: 'ok', etq: 'OK' },
  }
  const s = mapa[estado] || { tono: 'neutral', etq: estado || '—' }
  return (
    <Chip tono={s.tono} dot>
      {s.etq}
    </Chip>
  )
}

/** Spinner circular. */
export function Spinner({ size = 16, className = '' }) {
  return (
    <span
      className={`inline-block animate-[spin_0.8s_linear_infinite] rounded-full border-2 border-white/15 border-t-accent ${className}`}
      style={{ width: size, height: size }}
      aria-label="Cargando"
    />
  )
}

/** Estado de carga centrado. */
export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-muted">
      <Spinner />
      <span className="text-sm">{texto}</span>
    </div>
  )
}

/** Estado vacío. */
export function Vacio({ titulo = 'Sin registros', detalle, accion }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface2 text-ink-faint">
        <Icon name="search" className="h-5 w-5" />
      </span>
      <p className="text-sm font-600 text-ink-soft">{titulo}</p>
      {detalle && <p className="max-w-sm text-sm text-ink-faint">{detalle}</p>}
      {accion}
    </div>
  )
}

/** Banner de error inline. */
export function ErrorBanner({ children }) {
  if (!children) return null
  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
      <p className="text-sm text-ink-soft">{children}</p>
    </div>
  )
}
