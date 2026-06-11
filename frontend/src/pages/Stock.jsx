import { useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useFetch } from '../hooks/useFetch'
import { PageHeader } from '../components/layout/AppLayout'
import { Panel, Chip, StockDot, ErrorBanner, Kicker } from '../components/ui/primitives'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import { Field, TextInput } from '../components/ui/Field'
import { SucursalTabs } from '../components/ui/SucursalTabs'
import { Icon } from '../components/ui/icons'
import { dinero, numero, fechaHora, folio, nombreNodo } from '../lib/format'

const TIPO_MOV = {
  venta: 'danger',
  reabastecimiento: 'ok',
  ajuste: 'accent',
  devolucion: 'warn',
}

export default function Stock() {
  const { tieneRol } = useAuth()
  const toast = useToast()
  const puedeAjustar = tieneRol('admin', 'bodeguero')

  const [idSuc, setIdSuc] = useState(1)
  const [vista, setVista] = useState('stock') // 'stock' | 'movimientos'
  const { datos: stock, error, cargando, refrescar } = useFetch(`/stock/${idSuc}`, [idSuc])
  const { datos: movs, cargando: cargandoMovs, refrescar: refrescarMovs } = useFetch(
    vista === 'movimientos' ? `/movimientos/${idSuc}` : null,
    [idSuc, vista],
  )

  const [ajuste, setAjuste] = useState(null) // fila de stock
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  const resumen = useMemo(() => {
    const r = { verde: 0, amarillo: 0, rojo: 0 }
    ;(stock || []).forEach((s) => (r[s.estado] = (r[s.estado] || 0) + 1))
    return r
  }, [stock])

  const abrirAjuste = (fila) => {
    setAjuste(fila)
    setCantidad(String(fila.cantidad))
    setMotivo('')
  }

  const guardarAjuste = async () => {
    const n = Number(cantidad)
    if (Number.isNaN(n) || n < 0) {
      toast.error('La cantidad debe ser un entero ≥ 0.')
      return
    }
    setGuardando(true)
    try {
      const r = await api.put(`/stock/${idSuc}/${ajuste.id_prod}`, {
        cantidad: n,
        motivo: motivo.trim() || undefined,
      })
      toast.ok(`Stock ajustado: ${r.cantidad_anterior} → ${r.cantidad_nueva} (Δ ${r.delta >= 0 ? '+' : ''}${r.delta}).`)
      setAjuste(null)
      refrescar()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const columnasStock = [
    { clave: 'id_prod', etiqueta: 'ID', ancho: '64px', render: (s) => <span className="font-mono text-ink-faint">#{folio(s.id_prod)}</span> },
    { clave: 'producto', etiqueta: 'Producto', render: (s) => <span className="font-600 text-ink">{s.producto || `prod ${s.id_prod}`}</span> },
    { clave: 'precio', etiqueta: 'Precio', alinear: 'right', render: (s) => dinero(s.precio) },
    {
      clave: 'cantidad',
      etiqueta: 'Cantidad',
      alinear: 'right',
      render: (s) => <span className="font-mono text-base font-600 tabular text-ink">{numero(s.cantidad)}</span>,
    },
    { clave: 'cantidad_minima', etiqueta: 'Mínimo', alinear: 'right', render: (s) => <span className="font-mono text-ink-faint tabular">{numero(s.cantidad_minima)}</span> },
    { clave: 'estado', etiqueta: 'Estado', alinear: 'right', render: (s) => <StockDot estado={s.estado} /> },
  ]

  const columnasMov = [
    { clave: 'id_mov', etiqueta: 'ID', ancho: '64px', render: (m) => <span className="font-mono text-ink-faint">#{folio(m.id_mov)}</span> },
    { clave: 'producto', etiqueta: 'Producto', render: (m) => m.producto || `prod ${m.id_prod}` },
    { clave: 'tipo', etiqueta: 'Tipo', render: (m) => <Chip tono={TIPO_MOV[m.tipo] || 'neutral'}>{m.tipo}</Chip> },
    {
      clave: 'cantidad',
      etiqueta: 'Δ Cantidad',
      alinear: 'right',
      render: (m) => {
        const n = Number(m.cantidad)
        return (
          <span className={`font-mono font-600 tabular ${n < 0 ? 'text-danger' : 'text-ok'}`}>
            {n > 0 ? '+' : ''}
            {numero(n)}
          </span>
        )
      },
    },
    { clave: 'motivo', etiqueta: 'Motivo', render: (m) => <span className="text-ink-muted">{m.motivo || '—'}</span> },
    { clave: 'fecha', etiqueta: 'Fecha', alinear: 'right', render: (m) => <span className="font-mono text-xs text-ink-faint">{fechaHora(m.fecha)}</span> },
  ]

  return (
    <>
      <PageHeader
        codigo="Operación"
        titulo="Inventario"
        descripcion="Stock por sucursal (nodo local). Semáforo: rojo ≤ mínimo, amarillo cerca del mínimo, verde por encima."
      >
        <SucursalTabs value={idSuc} onChange={setIdSuc} />
      </PageHeader>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {/* Resumen del semáforo */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <SemaforoCard etiqueta="En nivel óptimo" valor={resumen.verde} tono="ok" />
        <SemaforoCard etiqueta="Stock bajo" valor={resumen.amarillo} tono="warn" />
        <SemaforoCard etiqueta="Crítico (≤ mínimo)" valor={resumen.rojo} tono="danger" />
      </div>

      <Panel
        title={`${nombreNodo(idSuc)} · ${vista === 'stock' ? 'inventario' : 'movimientos'}`}
        bodyClassName="p-0"
        aside={
          <div className="flex gap-1">
            <TabMini activo={vista === 'stock'} onClick={() => setVista('stock')}>
              Stock
            </TabMini>
            <TabMini activo={vista === 'movimientos'} onClick={() => setVista('movimientos')}>
              Movimientos
            </TabMini>
            <button
              className="btn-quiet btn-sm ml-1 w-8 px-0"
              onClick={() => (vista === 'stock' ? refrescar() : refrescarMovs())}
              title="Refrescar"
            >
              <Icon name="refresh" className="h-4 w-4" />
            </button>
          </div>
        }
      >
        {vista === 'stock' ? (
          <DataTable
            columnas={columnasStock}
            filas={stock}
            keyField="id_stock"
            cargando={cargando}
            vacioTitulo="Sin stock registrado"
            acciones={
              puedeAjustar
                ? (s) => (
                    <button className="btn-quiet btn-sm" onClick={() => abrirAjuste(s)}>
                      Ajustar
                    </button>
                  )
                : undefined
            }
          />
        ) : (
          <DataTable
            columnas={columnasMov}
            filas={movs}
            keyField="id_mov"
            cargando={cargandoMovs}
            vacioTitulo="Sin movimientos"
            vacioDetalle="Las ventas, reabastecimientos y ajustes aparecerán aquí."
          />
        )}
      </Panel>

      <Modal
        open={!!ajuste}
        onClose={() => setAjuste(null)}
        title="Ajuste manual de stock"
        subtitle={`${ajuste?.producto} · ${nombreNodo(idSuc)} · transacción local atómica`}
        width="max-w-md"
        footer={
          <>
            <button className="btn-quiet" onClick={() => setAjuste(null)} disabled={guardando}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={guardarAjuste} disabled={guardando}>
              {guardando ? 'Aplicando…' : 'Aplicar ajuste'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between border border-line bg-paper px-4 py-3">
            <Kicker>Cantidad actual</Kicker>
            <span className="font-mono text-xl font-600 tabular text-ink">{numero(ajuste?.cantidad)}</span>
          </div>
          <Field label="Nueva cantidad (absoluta)" required>
            <TextInput type="number" min="0" value={cantidad} onChange={(e) => setCantidad(e.target.value)} autoFocus />
          </Field>
          <Field label="Motivo" hint="Queda registrado en movimientos_stock (tipo: ajuste).">
            <TextInput value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Conteo físico, merma, corrección…" />
          </Field>
        </div>
      </Modal>
    </>
  )
}

function SemaforoCard({ etiqueta, valor, tono }) {
  const c = { ok: 'border-ok text-ok', warn: 'border-warn text-warn', danger: 'border-danger text-danger' }[tono]
  return (
    <div className={`panel flex items-center gap-4 border-l-[3px] ${c} px-4 py-3`}>
      <span className="font-mono text-3xl font-600 tabular text-ink">{folio(valor, 2)}</span>
      <span className="font-mono text-[10px] uppercase leading-tight tracking-wider2 text-ink-muted">{etiqueta}</span>
    </div>
  )
}

function TabMini({ activo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`border px-3 py-1 font-mono text-[10px] uppercase tracking-wider2 transition-colors ${
        activo ? 'border-accent bg-accent text-white' : 'border-line text-ink-muted hover:border-line-strong hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
