// ===========================================================================
//  Diagrama de la topología distribuida: nodo CENTRAL coordinando 3 sucursales
//  (Norte / Sur / Este). Es la pieza geométrica insignia de la consola; se usa
//  como decoración informativa en el dashboard y en el simulador CAP.
//  estados: { central, norte, sur, este } con valor 'ok' | 'falla' | 'activo'.
// ===========================================================================

const COLOR = {
  ok: '#15803d',
  activo: '#1c44ff',
  falla: '#b91c1c',
  idle: '#8b93a1',
}

function Nodo({ x, y, label, sub, estado = 'ok', grande = false }) {
  const c = COLOR[estado] || COLOR.idle
  const r = grande ? 7 : 5
  return (
    <g>
      <rect
        x={x - (grande ? 46 : 38)}
        y={y - (grande ? 20 : 17)}
        width={grande ? 92 : 76}
        height={grande ? 40 : 34}
        fill="#fff"
        stroke={c}
        strokeWidth="1.5"
      />
      <circle cx={x - (grande ? 34 : 28)} cy={y} r={r} fill={c}>
        {estado === 'activo' && (
          <animate attributeName="opacity" values="1;0.3;1" dur="1.1s" repeatCount="indefinite" />
        )}
      </circle>
      <text
        x={x - (grande ? 22 : 18)}
        y={y - 2}
        fontFamily="'IBM Plex Mono', monospace"
        fontSize={grande ? 11 : 9.5}
        fontWeight="600"
        fill="#15181d"
        textAnchor="start"
      >
        {label}
      </text>
      <text
        x={x - (grande ? 22 : 18)}
        y={y + 9}
        fontFamily="'IBM Plex Mono', monospace"
        fontSize="7.5"
        fill="#8b93a1"
        textAnchor="start"
      >
        {sub}
      </text>
    </g>
  )
}

export function NodeDiagram({ estados = {}, className = '' }) {
  const e = { central: 'activo', norte: 'ok', sur: 'ok', este: 'ok', ...estados }
  // Líneas desde el central (arriba centro) a cada sucursal (fila inferior).
  const cx = 200
  const cy = 40
  const sucs = [
    { x: 70, key: 'norte', label: 'NORTE', sub: ':3307' },
    { x: 200, key: 'sur', label: 'SUR', sub: ':3308' },
    { x: 330, key: 'este', label: 'ESTE', sub: ':3309' },
  ]
  return (
    <svg viewBox="0 0 400 150" className={`w-full ${className}`} role="img" aria-label="Topología de nodos">
      {/* enlaces */}
      {sucs.map((s) => {
        const estado = e[s.key]
        const stroke = estado === 'falla' ? COLOR.falla : '#c2c8d2'
        return (
          <path
            key={s.key}
            d={`M ${cx} ${cy + 18} L ${cx} 80 L ${s.x} 80 L ${s.x} ${118 - 18}`}
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
            strokeDasharray={estado === 'falla' ? '4 3' : '0'}
          />
        )
      })}
      {/* nodo central */}
      <Nodo x={cx} y={cy} label="CENTRAL" sub=":3306" estado={e.central} grande />
      {/* sucursales */}
      {sucs.map((s) => (
        <Nodo key={s.key} x={s.x} y={118} label={s.label} sub={s.sub} estado={e[s.key]} />
      ))}
    </svg>
  )
}
