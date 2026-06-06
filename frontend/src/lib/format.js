// Utilidades de formato compartidas por las pantallas.

const clp = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

/** Moneda (CLP, sin decimales). Acepta string o número. */
export function dinero(valor) {
  const n = Number(valor)
  return Number.isFinite(n) ? clp.format(n) : '—'
}

/** Número con separador de miles. */
export function numero(valor) {
  const n = Number(valor)
  return Number.isFinite(n) ? n.toLocaleString('es-CL') : '—'
}

/** Fecha+hora legible a partir de un datetime de MariaDB ("YYYY-MM-DD HH:MM:SS"). */
export function fechaHora(valor) {
  if (!valor) return '—'
  const d = new Date(String(valor).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return String(valor)
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Identificador con cero a la izquierda, estilo registro técnico: 7 -> "007". */
export function folio(n, ancho = 3) {
  return String(n ?? '').padStart(ancho, '0')
}

/** Mapa id_suc -> nombre de nodo (coincide con getNodoPorSucursal del backend). */
export const NODO_POR_SUC = { 1: 'norte', 2: 'sur', 3: 'este' }

export function nombreNodo(idSuc) {
  return NODO_POR_SUC[idSuc] || '—'
}
