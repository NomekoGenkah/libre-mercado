// ===========================================================================
//  Diagrama de la topología distribuida: nodo CENTRAL coordinando 3 sucursales
//  (Norte / Sur / Este). Tema oscuro.
//  estados: { central, norte, sur, este } con valor 'ok' | 'falla' | 'activo'.
// ===========================================================================

const COLOR = {
  ok: '#34d399',
  activo: '#7c5cfc',
  falla: '#f87171',
  idle: '#5b6273',
}

function Nodo({ x, y, label, sub, estado = 'ok', grande = false }) {
  const c = COLOR[estado] || COLOR.idle
  const w = grande ? 96 : 80
  const h = grande ? 42 : 36
  const r = grande ? 6 : 5
  return (
    <g>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx="8"
        fill="#161922"
        stroke={c}
        strokeWidth="1.5"
        opacity={estado === 'idle' ? 0.7 : 1}
      />
      <circle cx={x - w / 2 + 14} cy={y} r={r} fill={c}>
        {estado === 'activo' && (
          <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
        )}
      </circle>
      <text
        x={x - w / 2 + 26}
        y={y - 2}
        fontFamily="'Sora', sans-serif"
        fontSize={grande ? 11.5 : 10}
        fontWeight="700"
        fill="#eceef4"
        textAnchor="start"
      >
        {label}
      </text>
      <text
        x={x - w / 2 + 26}
        y={y + 10}
        fontFamily="'JetBrains Mono', monospace"
        fontSize="8"
        fill="#8b92a4"
        textAnchor="start"
      >
        {sub}
      </text>
    </g>
  )
}

export function NodeDiagram({ estados = {}, className = '' }) {
  const e = { central: 'activo', norte: 'ok', sur: 'ok', este: 'ok', ...estados }
  const cx = 200
  const cy = 40
  const sucs = [
    { x: 68, key: 'norte', label: 'NORTE', sub: ':3307' },
    { x: 200, key: 'sur', label: 'SUR', sub: ':3308' },
    { x: 332, key: 'este', label: 'ESTE', sub: ':3309' },
  ]
  return (
    <svg viewBox="0 0 400 150" className={`w-full ${className}`} role="img" aria-label="Topología de nodos">
      {sucs.map((s) => {
        const estado = e[s.key]
        const roto = estado === 'falla'
        const stroke = roto ? COLOR.falla : '#2e3445'
        return (
          <path
            key={s.key}
            d={`M ${cx} ${cy + 18} L ${cx} 80 L ${s.x} 80 L ${s.x} ${118 - 18}`}
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
            strokeDasharray={roto ? '4 3' : '0'}
          />
        )
      })}
      <Nodo x={cx} y={cy} label="CENTRAL" sub=":3306" estado={e.central} grande />
      {sucs.map((s) => (
        <Nodo key={s.key} x={s.x} y={118} label={s.label} sub={s.sub} estado={e[s.key]} />
      ))}
    </svg>
  )
}
