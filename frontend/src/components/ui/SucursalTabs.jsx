// Selector de sucursal (norte=1, sur=2, este=3). Pestañas rectas con el id_suc
// en mono. Reutilizado por Inventario y Reabastecimiento.
const SUCS = [
  { id: 1, nombre: 'Norte', puerto: ':3307' },
  { id: 2, nombre: 'Sur', puerto: ':3308' },
  { id: 3, nombre: 'Este', puerto: ':3309' },
]

export function SucursalTabs({ value, onChange }) {
  return (
    <div className="flex border border-line-strong">
      {SUCS.map((s, i) => {
        const activo = value === s.id
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className={`group flex items-center gap-2 px-4 py-2.5 transition-colors ${
              i > 0 ? 'border-l border-line-strong' : ''
            } ${activo ? 'bg-ink text-white' : 'bg-surface text-ink-muted hover:bg-paper hover:text-ink'}`}
          >
            <span className={`h-1.5 w-1.5 ${activo ? 'bg-accent' : 'bg-line'}`} />
            <span className="font-display text-sm font-700 tracking-tight">{s.nombre}</span>
            <span className={`font-mono text-[9px] ${activo ? 'text-white/50' : 'text-ink-faint'}`}>
              {s.puerto}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export const SUCURSALES = SUCS
