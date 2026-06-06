import { useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useFetch } from '../hooks/useFetch'
import { PageHeader } from '../components/layout/AppLayout'
import { Panel, Chip, ErrorBanner, Kicker, Spinner } from '../components/ui/primitives'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import { Field, Select } from '../components/ui/Field'
import { SucursalTabs } from '../components/ui/SucursalTabs'
import { dinero, numero, fechaHora, folio, nombreNodo } from '../lib/format'

export default function Compras() {
  const { tieneRol } = useAuth()
  const toast = useToast()
  const puedeComprar = tieneRol('admin', 'bodeguero')

  const { datos, error, cargando, refrescar } = useFetch('/compras')
  const [nueva, setNueva] = useState(false)

  const compras = datos?.compras || []
  const caidos = datos?.nodos_caidos || []
  const total = useMemo(() => compras.reduce((a, c) => a + Number(c.total || 0), 0), [compras])

  const columnas = [
    { clave: 'id_compra', etiqueta: 'Folio', render: (c) => <span className="font-mono font-600 text-accent">#{folio(c.id_compra)}</span> },
    { clave: 'proveedor', etiqueta: 'Proveedor', render: (c) => <span className="font-600 text-ink">{c.proveedor || `prov ${c.id_prov}`}</span> },
    { clave: 'id_suc', etiqueta: 'Sucursal', render: (c) => <span className="font-mono text-xs uppercase text-ink-muted">{nombreNodo(c.id_suc)}</span> },
    { clave: 'estado', etiqueta: 'Estado', render: (c) => <Chip tono="ok" dot>{c.estado}</Chip> },
    { clave: 'total', etiqueta: 'Total', alinear: 'right', render: (c) => <span className="font-600">{dinero(c.total)}</span> },
    { clave: 'fecha', etiqueta: 'Fecha', alinear: 'right', render: (c) => <span className="font-mono text-xs text-ink-faint">{fechaHora(c.fecha)}</span> },
  ]

  return (
    <>
      <PageHeader
        codigo="OPS · 03"
        titulo="Reabastecimiento"
        descripcion="Compra a proveedor que aumenta el stock. Es una transacción ACID local: compra + detalle + stock + movimiento viven en el mismo nodo de sucursal."
      >
        {puedeComprar && (
          <button className="btn-primary" onClick={() => setNueva(true)}>
            ▲ Nueva compra
          </button>
        )}
      </PageHeader>

      {error && <ErrorBanner>{error}</ErrorBanner>}
      {caidos.length > 0 && (
        <div className="mb-4 panel border-l-[3px] border-warn bg-warnSoft px-4 py-2.5">
          <p className="font-mono text-[11px] tracking-wide text-warn">
            Nodos no disponibles al listar: {caidos.join(', ')} — sus compras no se muestran.
          </p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Mini etiqueta="Compras" valor={numero(compras.length)} />
        <Mini etiqueta="Inversión acumulada" valor={dinero(total)} />
        <Mini etiqueta="Transacción" valor="LOCAL" sub="ACID en sucursal" />
      </div>

      <Panel title="Historial de reabastecimientos" bodyClassName="p-0">
        <DataTable columnas={columnas} filas={compras} keyField="id_compra" cargando={cargando} vacioTitulo="Sin compras registradas" />
      </Panel>

      {nueva && (
        <NuevaCompra
          onClose={() => setNueva(false)}
          onHecho={() => {
            setNueva(false)
            refrescar()
          }}
        />
      )}
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
//  Constructor de compra: proveedor + sucursal + líneas (cantidad + precio).
// ---------------------------------------------------------------------------
function NuevaCompra({ onClose, onHecho }) {
  const toast = useToast()
  const { datos: proveedores } = useFetch('/proveedores')
  const { datos: productos } = useFetch('/productos')
  const [idProv, setIdProv] = useState('')
  const [idSuc, setIdSuc] = useState(1)
  const [lineas, setLineas] = useState([]) // [{id_prod, cantidad, precio_unitario}]
  const [enviando, setEnviando] = useState(false)

  const porId = useMemo(() => {
    const m = {}
    ;(productos || []).forEach((p) => (m[p.id_prod] = p))
    return m
  }, [productos])

  const total = lineas.reduce((a, l) => a + Number(l.precio_unitario || 0) * l.cantidad, 0)

  const agregar = (idProd) => {
    if (!idProd) return
    const id = Number(idProd)
    if (lineas.some((l) => l.id_prod === id)) {
      toast.info('Ese producto ya está en la compra.')
      return
    }
    setLineas([...lineas, { id_prod: id, cantidad: 1, precio_unitario: Number(porId[id]?.precio || 0) }])
  }
  const set = (id, campo, valor) =>
    setLineas(lineas.map((l) => (l.id_prod === id ? { ...l, [campo]: valor } : l)))
  const quitar = (id) => setLineas(lineas.filter((l) => l.id_prod !== id))

  const confirmar = async () => {
    if (!idProv) return toast.error('Selecciona un proveedor.')
    if (lineas.length === 0) return toast.error('Agrega al menos un producto.')
    setEnviando(true)
    try {
      const r = await api.post('/compras', {
        id_prov: Number(idProv),
        id_suc: idSuc,
        items: lineas.map((l) => ({
          id_prod: l.id_prod,
          cantidad: Math.max(1, Number(l.cantidad) || 1),
          precio_unitario: Number(l.precio_unitario) || 0,
        })),
      })
      toast.ok(`Compra #${folio(r.id_compra)} registrada · ${dinero(r.total)} · stock aumentado en ${r.nodo}.`)
      onHecho()
    } catch (err) {
      toast.error(err.message)
      setEnviando(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo reabastecimiento"
      subtitle="Transacción ACID local · aumenta stock + registra movimiento"
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
            {enviando ? <Spinner size={14} className="border-white/40 border-t-white" /> : '▲'} Registrar compra
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Proveedor" required>
            <Select value={idProv} onChange={(e) => setIdProv(e.target.value)}>
              <option value="">— Selecciona —</option>
              {(proveedores || []).map((p) => (
                <option key={p.id_prov} value={p.id_prov}>
                  {p.proveedor}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <span className="field-label">Sucursal destino (nodo)</span>
            <SucursalTabs value={idSuc} onChange={setIdSuc} />
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <Field label="Agregar producto al pedido">
            <Select value="" onChange={(e) => agregar(e.target.value)}>
              <option value="">— Elegir producto —</option>
              {(productos || []).map((p) => (
                <option key={p.id_prod} value={p.id_prod} disabled={lineas.some((l) => l.id_prod === p.id_prod)}>
                  {p.producto} · {dinero(p.precio)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {lineas.length === 0 ? (
          <div className="hatch border border-dashed border-line py-8 text-center">
            <p className="font-mono text-[11px] uppercase tracking-wider2 text-ink-faint">Pedido vacío</p>
          </div>
        ) : (
          <div className="border border-line">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th">Producto</th>
                  <th className="th text-center">Cantidad</th>
                  <th className="th text-right">Precio compra</th>
                  <th className="th text-right">Subtotal</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => (
                  <tr key={l.id_prod}>
                    <td className="td font-600">{porId[l.id_prod]?.producto || `prod ${l.id_prod}`}</td>
                    <td className="td">
                      <input
                        type="number"
                        min="1"
                        value={l.cantidad}
                        onChange={(e) => set(l.id_prod, 'cantidad', e.target.value)}
                        className="mx-auto block h-8 w-16 border border-line bg-paper text-center font-mono text-sm focus:border-accent focus:outline-none"
                      />
                    </td>
                    <td className="td text-right">
                      <input
                        type="number"
                        min="0"
                        value={l.precio_unitario}
                        onChange={(e) => set(l.id_prod, 'precio_unitario', e.target.value)}
                        className="ml-auto block h-8 w-24 border border-line bg-paper px-2 text-right font-mono text-sm focus:border-accent focus:outline-none"
                      />
                    </td>
                    <td className="td text-right font-mono font-600">
                      {dinero(Number(l.precio_unitario || 0) * (Number(l.cantidad) || 0))}
                    </td>
                    <td className="td text-right">
                      <button className="font-mono text-xs text-ink-faint hover:text-danger" onClick={() => quitar(l.id_prod)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}
