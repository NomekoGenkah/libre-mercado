import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useFetch } from '../hooks/useFetch'
import { PageHeader } from '../components/layout/AppLayout'
import { Panel, Chip, ErrorBanner, Kicker, Spinner, Cargando } from '../components/ui/primitives'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import { Field, Select } from '../components/ui/Field'
import { SucursalTabs } from '../components/ui/SucursalTabs'
import { Icon } from '../components/ui/icons'
import { dinero, numero, fechaHora, folio, nombreNodo } from '../lib/format'

export default function Ventas() {
  const { tieneRol } = useAuth()
  const toast = useToast()
  const puedeVender = tieneRol('admin', 'vendedor')

  const { datos: ventas, error, cargando, refrescar } = useFetch('/ventas')
  const [nueva, setNueva] = useState(false)
  const [detalleId, setDetalleId] = useState(null)

  const total = useMemo(() => (ventas || []).reduce((a, v) => a + Number(v.total || 0), 0), [ventas])

  const columnas = [
    { clave: 'id_venta', etiqueta: 'Folio', render: (v) => <span className="font-mono font-600 text-accent">#{folio(v.id_venta)}</span> },
    { clave: 'cliente', etiqueta: 'Cliente', render: (v) => <span className="font-600 text-ink">{v.cliente || `cli ${v.id_cli}`}</span> },
    { clave: 'id_suc', etiqueta: 'Sucursal', render: (v) => <span className="font-mono text-xs uppercase text-ink-muted">{nombreNodo(v.id_suc)}</span> },
    {
      clave: 'estado',
      etiqueta: 'Estado',
      render: (v) => <Chip tono={v.estado === 'completada' ? 'ok' : 'neutral'} dot>{v.estado}</Chip>,
    },
    { clave: 'total', etiqueta: 'Total', alinear: 'right', render: (v) => <span className="font-600">{dinero(v.total)}</span> },
    { clave: 'fecha', etiqueta: 'Fecha', alinear: 'right', render: (v) => <span className="font-mono text-xs text-ink-faint">{fechaHora(v.fecha)}</span> },
  ]

  return (
    <>
      <PageHeader
        codigo="Operación"
        titulo="Ventas"
        descripcion="Cada venta es una transacción distribuida (Two-Phase Commit): cabecera en el nodo central y descuento de stock en la sucursal, de forma atómica."
      >
        {puedeVender && (
          <button className="btn-primary" onClick={() => setNueva(true)}>
            <Icon name="plus" className="h-4 w-4" /> Nueva venta
          </button>
        )}
      </PageHeader>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Mini etiqueta="Ventas" valor={numero((ventas || []).length)} />
        <Mini etiqueta="Monto acumulado" valor={dinero(total)} />
        <Mini etiqueta="Patrón" valor="2PC" sub="central + sucursal" />
      </div>

      <Panel title="Historial de ventas" bodyClassName="p-0">
        <DataTable
          columnas={columnas}
          filas={ventas}
          keyField="id_venta"
          cargando={cargando}
          vacioTitulo="Aún no hay ventas"
          vacioDetalle="Registra la primera venta para ver el flujo distribuido."
          acciones={(v) => (
            <button className="btn-quiet btn-sm" onClick={() => setDetalleId(v.id_venta)}>
              Detalle
            </button>
          )}
        />
      </Panel>

      {nueva && (
        <NuevaVenta
          onClose={() => setNueva(false)}
          onHecho={() => {
            setNueva(false)
            refrescar()
          }}
        />
      )}

      <DetalleVenta id={detalleId} onClose={() => setDetalleId(null)} />
    </>
  )
}

function Mini({ etiqueta, valor, sub }) {
  return (
    <div className="panel px-4 py-3">
      <Kicker>{etiqueta}</Kicker>
      <p className="mt-1.5 font-mono text-xl font-600 tabular text-ink">{valor}</p>
      {sub && <p className="font-mono text-[10px] uppercase tracking-wider2 text-ink-faint">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Constructor de venta: cliente + sucursal + líneas. Muestra el stock
//  disponible de la sucursal elegida y bloquea cantidades por encima.
// ---------------------------------------------------------------------------
function NuevaVenta({ onClose, onHecho }) {
  const toast = useToast()
  const { datos: clientes } = useFetch('/clientes')
  const [idCli, setIdCli] = useState('')
  const [idSuc, setIdSuc] = useState(1)
  const [stock, setStock] = useState(null)
  const [cargandoStock, setCargandoStock] = useState(true)
  const [lineas, setLineas] = useState([]) // [{id_prod, cantidad}]
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let activo = true
    setCargandoStock(true)
    api
      .get(`/stock/${idSuc}`)
      .then((s) => activo && setStock(s))
      .catch(() => activo && setStock([]))
      .finally(() => activo && setCargandoStock(false))
    // al cambiar de sucursal, limpiamos las líneas (el stock es otro)
    setLineas([])
    return () => {
      activo = false
    }
  }, [idSuc])

  const porId = useMemo(() => {
    const m = {}
    ;(stock || []).forEach((s) => (m[s.id_prod] = s))
    return m
  }, [stock])

  const disponibles = (stock || []).filter((s) => Number(s.cantidad) > 0)

  const total = lineas.reduce((a, l) => a + Number(porId[l.id_prod]?.precio || 0) * l.cantidad, 0)

  const agregar = (idProd) => {
    if (!idProd) return
    const id = Number(idProd)
    if (lineas.some((l) => l.id_prod === id)) {
      toast.info('Ese producto ya está en la venta.')
      return
    }
    setLineas([...lineas, { id_prod: id, cantidad: 1 }])
  }
  const cambiarCantidad = (id, n) => {
    const max = Number(porId[id]?.cantidad || 0)
    const v = Math.max(1, Math.min(Number(n) || 1, max))
    setLineas(lineas.map((l) => (l.id_prod === id ? { ...l, cantidad: v } : l)))
  }
  const quitar = (id) => setLineas(lineas.filter((l) => l.id_prod !== id))

  const confirmar = async () => {
    if (!idCli) return toast.error('Selecciona un cliente.')
    if (lineas.length === 0) return toast.error('Agrega al menos un producto.')
    setEnviando(true)
    try {
      const r = await api.post('/ventas', {
        id_cli: Number(idCli),
        id_suc: idSuc,
        items: lineas.map((l) => ({ id_prod: l.id_prod, cantidad: l.cantidad })),
      })
      toast.ok(`Venta #${folio(r.id_venta)} confirmada · ${dinero(r.total)} · COMMIT en ${r.nodo} + central.`)
      onHecho()
    } catch (err) {
      // 409 = stock insuficiente / concurrencia; 503 = nodo caído (rollback).
      toast.error(err.message)
      setEnviando(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nueva venta"
      subtitle="Two-Phase Commit · rollback total si la sucursal no confirma"
      width="max-w-2xl"
      footer={
        <>
          <div className="mr-auto flex items-baseline gap-2">
            <Kicker>Total</Kicker>
            <span className="font-mono text-lg font-600 tabular text-ink">{dinero(total)}</span>
          </div>
          <button className="btn-quiet" onClick={onClose} disabled={enviando}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={confirmar} disabled={enviando || lineas.length === 0}>
            {enviando ? <Spinner size={14} /> : <Icon name="check" className="h-4 w-4" />} Confirmar venta
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cliente" required>
            <Select value={idCli} onChange={(e) => setIdCli(e.target.value)}>
              <option value="">— Selecciona —</option>
              {(clientes || []).map((c) => (
                <option key={c.id_cli} value={c.id_cli}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <span className="field-label">Sucursal (nodo)</span>
            <SucursalTabs value={idSuc} onChange={setIdSuc} />
          </div>
        </div>

        {/* Selector de producto */}
        <div className="border-t border-line pt-4">
          <Field label="Agregar producto (con stock en la sucursal)">
            <Select
              value=""
              onChange={(e) => agregar(e.target.value)}
              disabled={cargandoStock || disponibles.length === 0}
            >
              <option value="">
                {cargandoStock ? 'Cargando stock…' : disponibles.length ? '— Elegir producto —' : 'Sin stock disponible'}
              </option>
              {disponibles.map((s) => (
                <option key={s.id_prod} value={s.id_prod} disabled={lineas.some((l) => l.id_prod === s.id_prod)}>
                  {s.producto} · {dinero(s.precio)} · stock {s.cantidad}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Líneas */}
        {lineas.length === 0 ? (
          <div className="hatch border border-dashed border-line py-8 text-center">
            <p className="font-mono text-[11px] uppercase tracking-wider2 text-ink-faint">
              Carrito vacío · agrega productos arriba
            </p>
          </div>
        ) : (
          <div className="border border-line">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th">Producto</th>
                  <th className="th text-right">Precio</th>
                  <th className="th text-center">Cantidad</th>
                  <th className="th text-right">Subtotal</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => {
                  const s = porId[l.id_prod] || {}
                  const precio = Number(s.precio || 0)
                  return (
                    <tr key={l.id_prod}>
                      <td className="td font-600">{s.producto || `prod ${l.id_prod}`}</td>
                      <td className="td text-right">{dinero(precio)}</td>
                      <td className="td">
                        <div className="flex items-center justify-center gap-1">
                          <button className="btn-quiet btn-sm w-7 px-0" onClick={() => cambiarCantidad(l.id_prod, l.cantidad - 1)}>
                            −
                          </button>
                          <input
                            value={l.cantidad}
                            onChange={(e) => cambiarCantidad(l.id_prod, e.target.value)}
                            className="h-8 w-12 border border-line bg-paper text-center font-mono text-sm focus:border-accent focus:outline-none"
                          />
                          <button className="btn-quiet btn-sm w-7 px-0" onClick={() => cambiarCantidad(l.id_prod, l.cantidad + 1)}>
                            +
                          </button>
                        </div>
                        <p className="mt-0.5 text-center font-mono text-[9px] text-ink-faint">máx {s.cantidad}</p>
                      </td>
                      <td className="td text-right font-mono font-600">{dinero(precio * l.cantidad)}</td>
                      <td className="td text-right">
                        <button className="font-mono text-xs text-ink-faint hover:text-danger" onClick={() => quitar(l.id_prod)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
//  Detalle de venta (GET /ventas/:id): cabecera + líneas.
// ---------------------------------------------------------------------------
function DetalleVenta({ id, onClose }) {
  const { datos, cargando, error } = useFetch(id ? `/ventas/${id}` : null, [id])
  if (!id) return null
  return (
    <Modal open onClose={onClose} title={`Venta #${folio(id)}`} subtitle="Cabecera (central) + detalle de líneas" width="max-w-xl">
      {cargando ? (
        <Cargando texto="Cargando venta…" />
      ) : error ? (
        <ErrorBanner>{error}</ErrorBanner>
      ) : datos ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DatoMini k="Cliente" v={datos.cliente || `cli ${datos.id_cli}`} />
            <DatoMini k="Sucursal" v={nombreNodo(datos.id_suc)} />
            <DatoMini k="Estado" v={datos.estado} />
            <DatoMini k="Fecha" v={fechaHora(datos.fecha)} />
          </div>
          <div className="border border-line">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th">Producto</th>
                  <th className="th text-center">Cant.</th>
                  <th className="th text-right">P. unit.</th>
                  <th className="th text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(datos.items || []).map((it, i) => (
                  <tr key={i}>
                    <td className="td font-600">{it.producto || `prod ${it.id_prod}`}</td>
                    <td className="td text-center font-mono tabular">{it.cantidad}</td>
                    <td className="td text-right font-mono">{dinero(it.precio_unitario)}</td>
                    <td className="td text-right font-mono font-600">{dinero(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line-strong">
                  <td className="td font-mono text-[10px] uppercase tracking-wider2 text-ink-faint" colSpan={3}>
                    Total
                  </td>
                  <td className="td text-right font-mono text-base font-700 text-ink">{dinero(datos.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

function DatoMini({ k, v }) {
  return (
    <div className="border border-line bg-paper px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-wider2 text-ink-faint">{k}</p>
      <p className="mt-0.5 truncate text-sm font-600 text-ink" title={String(v)}>
        {v}
      </p>
    </div>
  )
}
