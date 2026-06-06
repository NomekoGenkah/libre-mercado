// ===========================================================================
//  Primitivas de UI de la consola técnica. Componentes pequeños y sin estado
//  reutilizados por todas las pantallas. Esquinas rectas, mono para etiquetas.
// ===========================================================================

/** Etiqueta técnica en mayúsculas. */
export function Kicker({ children, className = '' }) {
  return <span className={`kicker ${className}`}>{children}</span>
}

/** Marcas de registro (crosshair) en las cuatro esquinas de un contenedor. */
export function CornerMarks({ className = 'text-accent' }) {
  const base =
    'pointer-events-none absolute h-2.5 w-2.5 border-accent opacity-70'
  return (
    <div className={`${className} absolute inset-0`} aria-hidden>
      <span className={`${base} left-0 top-0 border-l border-t`} />
      <span className={`${base} right-0 top-0 border-r border-t`} />
      <span className={`${base} bottom-0 left-0 border-b border-l`} />
      <span className={`${base} bottom-0 right-0 border-b border-r`} />
    </div>
  )
}

/** Panel base con título técnico opcional. */
export function Panel({ title, aside, children, className = '', bodyClassName = 'p-5' }) {
  return (
    <section className={`panel shadow-frame ${className}`}>
      {(title || aside) && (
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          {title && <Kicker className="text-ink-muted">{title}</Kicker>}
          {aside}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

const TONOS_CHIP = {
  neutral: 'border-line text-ink-muted bg-paper',
  accent: 'border-accent text-accent bg-accent-soft',
  ok: 'border-ok text-ok bg-okSoft',
  warn: 'border-warn text-warn bg-warnSoft',
  danger: 'border-danger text-danger bg-dangerSoft',
  ink: 'border-line-strong text-ink bg-paper',
}

/** Chip / badge semántico. */
export function Chip({ tono = 'neutral', children, dot = false, className = '' }) {
  return (
    <span className={`chip ${TONOS_CHIP[tono]} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 bg-current" />}
      {children}
    </span>
  )
}

/** Semáforo de stock: rojo / amarillo / verde. */
export function StockDot({ estado }) {
  const mapa = {
    rojo: { tono: 'danger', etq: 'CRÍTICO' },
    amarillo: { tono: 'warn', etq: 'BAJO' },
    verde: { tono: 'ok', etq: 'OK' },
  }
  const s = mapa[estado] || { tono: 'neutral', etq: estado || '—' }
  return (
    <Chip tono={s.tono} dot>
      {s.etq}
    </Chip>
  )
}

/** Spinner técnico (cuadrado girando, sin curvas). */
export function Spinner({ size = 16, className = '' }) {
  return (
    <span
      className={`inline-block animate-[spin_0.9s_linear_infinite] border-2 border-line border-t-accent ${className}`}
      style={{ width: size, height: size }}
      aria-label="Cargando"
    />
  )
}

/** Estado de carga centrado para paneles. */
export function Cargando({ texto = 'Consultando nodos…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-muted">
      <Spinner />
      <span className="font-mono text-xs uppercase tracking-wider2">{texto}</span>
    </div>
  )
}

/** Estado vacío con hachura diagonal. */
export function Vacio({ titulo = 'Sin registros', detalle, accion }) {
  return (
    <div className="hatch flex flex-col items-center justify-center gap-3 border border-dashed border-line py-14 text-center">
      <p className="font-mono text-xs uppercase tracking-wider2 text-ink-muted">{titulo}</p>
      {detalle && <p className="max-w-sm text-sm text-ink-faint">{detalle}</p>}
      {accion}
    </div>
  )
}

/** Banner de error inline. */
export function ErrorBanner({ children }) {
  if (!children) return null
  return (
    <div className="panel border-l-[3px] border-danger bg-dangerSoft px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 font-mono text-[10px] tracking-wider2 text-danger">ERR</span>
        <p className="text-sm text-ink-soft">{children}</p>
      </div>
    </div>
  )
}
