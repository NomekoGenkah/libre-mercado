// Selector de sucursal (norte=1, sur=2, este=3). Reutilizado por Inventario,
// Reabastecimiento, Ventas y el Simulador CAP.
const SUCS = [
  { id: 1, nombre: 'Norte', puerto: ':3307' },
  { id: 2, nombre: 'Sur', puerto: ':3308' },
  { id: 3, nombre: 'Este', puerto: ':3309' },
]

export function SucursalTabs({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-paper p-1">
      {SUCS.map((s) => {
        const activo = value === s.id
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-600 transition-all ${
              activo
                ? 'bg-accent text-white shadow-[0_4px_14px_-6px_rgba(124,92,252,0.8)]'
                : 'text-ink-muted hover:bg-surface2 hover:text-ink'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${activo ? 'bg-white' : 'bg-ink-faint'}`} />
            {s.nombre}
            <span className={`font-mono text-[10px] ${activo ? 'text-white/60' : 'text-ink-faint'}`}>{s.puerto}</span>
          </button>
        )
      })}
    </div>
  )
}

export const SUCURSALES = SUCS
