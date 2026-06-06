import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { PageHeader } from '../components/layout/AppLayout'
import { StatCard } from '../components/ui/StatCard'
import { NodeDiagram } from '../components/ui/NodeDiagram'
import { Panel, Chip, StockDot, Cargando, Vacio, Kicker } from '../components/ui/primitives'
import { dinero, numero, fechaHora, folio, nombreNodo } from '../lib/format'

const SUCURSALES = [1, 2, 3]

export default function Dashboard() {
  const { usuario } = useAuth()
  const [estado, setEstado] = useState({ cargando: true })

  useEffect(() => {
    let activo = true
    async function cargar() {
      // Lecturas en paralelo, resilientes: si un nodo de sucursal está caído,
      // su stock se omite del cómputo en vez de tumbar el dashboard.
      const [prod, cli, ventas, salud, ...stocks] = await Promise.all([
        api.get('/productos').catch(() => []),
        api.get('/clientes').catch(() => []),
        api.get('/ventas').catch(() => []),
        api.get('/salud').then((d) => ({ ok: true, nodos: d?.nodos })).catch((e) => ({ ok: false, nodos: e?.detalle?.nodos })),
        ...SUCURSALES.map((id) => api.get(`/stock/${id}`).then((s) => ({ id, s })).catch(() => ({ id, s: [] }))),
      ])
      if (!activo) return

      const stockPlano = stocks.flatMap(({ id, s }) =>
        (s || []).map((x) => ({ ...x, id_suc: id })),
      )
      const alertas = stockPlano
        .filter((x) => x.estado === 'rojo' || x.estado === 'amarillo')
        .sort((a, b) => (a.estado === 'rojo' ? -1 : 1) - (b.estado === 'rojo' ? -1 : 1) || a.cantidad - b.cantidad)

      const totalVentas = (ventas || []).reduce((acc, v) => acc + Number(v.total || 0), 0)

      setEstado({
        cargando: false,
        productos: prod || [],
        clientes: cli || [],
        ventas: ventas || [],
        totalVentas,
        salud,
        alertas,
      })
    }
    cargar()
    return () => {
      activo = false
    }
  }, [])

  if (estado.cargando) {
    return (
      <>
        <PageHeader codigo="SYS · 00" titulo="Dashboard" descripcion="Estado operativo del sistema distribuido." />
        <Cargando texto="Agregando métricas de los nodos…" />
      </>
    )
  }

  const nodos = estado.salud?.nodos || {}
  const estadosNodo = {
    central: nodos.central === 'ok' ? 'activo' : 'falla',
    norte: nodos.norte === 'ok' ? 'ok' : 'falla',
    sur: nodos.sur === 'ok' ? 'ok' : 'falla',
    este: nodos.este === 'ok' ? 'ok' : 'falla',
  }
  const ventasRecientes = estado.ventas.slice(0, 6)
  const criticas = estado.alertas.filter((a) => a.estado === 'rojo').length

  return (
    <>
      <PageHeader
        codigo="SYS · 00"
        titulo={`Hola, ${usuario?.username}`}
        descripcion="Estado operativo del e-commerce distribuido. Métricas agregadas desde el nodo central y las 3 sucursales."
      />

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard etiqueta="Ventas registradas" valor={numero(estado.ventas.length)} pista={dinero(estado.totalVentas) + ' acumulado'} tono="accent" delay={0} />
        <StatCard etiqueta="Productos activos" valor={numero(estado.productos.length)} sufijo="SKU" tono="ink" delay={60} />
        <StatCard etiqueta="Clientes activos" valor={numero(estado.clientes.length)} tono="ink" delay={120} />
        <StatCard
          etiqueta="Stock crítico"
          valor={folio(criticas, 2)}
          sufijo={`/ ${folio(estado.alertas.length, 2)} bajos`}
          pista={criticas ? 'Requiere reabastecimiento' : 'Inventario saludable'}
          tono={criticas ? 'danger' : 'ok'}
          delay={180}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Topología */}
        <Panel
          title="Topología · red_distribuida"
          className="lg:col-span-1"
          aside={
            <Chip tono={estado.salud?.ok ? 'ok' : 'danger'} dot>
              {estado.salud?.ok ? 'Operativo' : 'Degradado'}
            </Chip>
          }
        >
          <NodeDiagram estados={estadosNodo} />
          <div className="mt-4 border-t border-line pt-4">
            <Kicker>Decisión arquitectónica</Kicker>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Sistema <span className="font-600 text-accent">CP</span>: ante la caída de una sucursal
              durante una venta, la transacción distribuida hace rollback completo. Se sacrifica
              disponibilidad para evitar sobreventa.
            </p>
            <Link to="/simulador-cap" className="btn-ghost btn-sm mt-3">
              ⊘ Ver simulador de fallo
            </Link>
          </div>
        </Panel>

        {/* Ventas recientes */}
        <Panel
          title="Ventas recientes"
          className="lg:col-span-2"
          aside={
            <Link to="/ventas" className="font-mono text-[10px] uppercase tracking-wider2 text-accent hover:underline">
              Ver todas →
            </Link>
          }
          bodyClassName="p-0"
        >
          {ventasRecientes.length === 0 ? (
            <div className="p-5">
              <Vacio titulo="Aún no hay ventas" detalle="Registra una venta para ver el flujo Two-Phase Commit en acción." />
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th">Folio</th>
                  <th className="th">Cliente</th>
                  <th className="th">Sucursal</th>
                  <th className="th text-right">Total</th>
                  <th className="th text-right">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {ventasRecientes.map((v) => (
                  <tr key={v.id_venta} className="transition-colors hover:bg-accent-soft/50">
                    <td className="td font-mono text-accent">#{folio(v.id_venta)}</td>
                    <td className="td">{v.cliente || `cli ${v.id_cli}`}</td>
                    <td className="td">
                      <span className="font-mono text-xs uppercase text-ink-muted">{nombreNodo(v.id_suc)}</span>
                    </td>
                    <td className="td text-right font-mono font-600">{dinero(v.total)}</td>
                    <td className="td text-right font-mono text-xs text-ink-faint">{fechaHora(v.fecha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {/* Alertas de stock */}
      <Panel
        title="Alertas de inventario"
        className="mt-6"
        aside={
          <Link to="/stock" className="font-mono text-[10px] uppercase tracking-wider2 text-accent hover:underline">
            Inventario completo →
          </Link>
        }
        bodyClassName="p-0"
      >
        {estado.alertas.length === 0 ? (
          <div className="p-5">
            <Vacio titulo="Sin alertas" detalle="Todo el inventario está por encima de su mínimo." />
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">Producto</th>
                <th className="th">Sucursal</th>
                <th className="th text-right">Cantidad</th>
                <th className="th text-right">Mínimo</th>
                <th className="th text-right">Estado</th>
              </tr>
            </thead>
            <tbody>
              {estado.alertas.slice(0, 10).map((a, i) => (
                <tr key={`${a.id_suc}-${a.id_prod}-${i}`} className="transition-colors hover:bg-accent-soft/50">
                  <td className="td">{a.producto || `prod ${a.id_prod}`}</td>
                  <td className="td font-mono text-xs uppercase text-ink-muted">{nombreNodo(a.id_suc)}</td>
                  <td className="td text-right font-mono font-600 tabular">{numero(a.cantidad)}</td>
                  <td className="td text-right font-mono text-ink-faint tabular">{numero(a.cantidad_minima)}</td>
                  <td className="td text-right">
                    <StockDot estado={a.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  )
}
