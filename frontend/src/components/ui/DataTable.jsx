import { Cargando, Vacio } from './primitives'

// ===========================================================================
//  Tabla de datos genérica. columnas: [{ clave, etiqueta, render?, alinear? }]
//  Filas con hover. Maneja estados de carga y vacío internamente.
// ===========================================================================
export function DataTable({
  columnas,
  filas,
  keyField,
  cargando,
  vacioTitulo = 'Sin registros',
  vacioDetalle,
  acciones, // (fila) => JSX (columna final de acciones)
}) {
  if (cargando) return <Cargando />
  if (!filas || filas.length === 0) return <Vacio titulo={vacioTitulo} detalle={vacioDetalle} />

  const alinearCl = (a) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left')

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.clave} className={`th ${alinearCl(c.alinear)}`} style={c.ancho ? { width: c.ancho } : undefined}>
                {c.etiqueta}
              </th>
            ))}
            {acciones && <th className="th text-right">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr
              key={fila[keyField] ?? i}
              className="group transition-colors hover:bg-accent-soft/50"
            >
              {columnas.map((c) => (
                <td key={c.clave} className={`td tabular ${alinearCl(c.alinear)} ${c.celdaClassName || ''}`}>
                  {c.render ? c.render(fila) : fila[c.clave] ?? '—'}
                </td>
              ))}
              {acciones && (
                <td className="td text-right">
                  <div className="flex justify-end gap-1.5">{acciones(fila)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
