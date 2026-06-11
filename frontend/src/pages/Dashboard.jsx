import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { PageHeader } from '../components/layout/AppLayout'
import { StatCard } from '../components/ui/StatCard'
import { NodesPanel } from '../components/ui/NodesPanel'
import { Panel, StockDot, Cargando, Vacio } from '../components/ui/primitives'
import { Icon } from '../components/ui/icons'
import { dinero, numero, fechaHora, folio, nombreNodo } from '../lib/format'

const SUCURSALES = [1, 2, 3]

export default function Dashboard() {
  const { usuario, tieneRol } = useAuth()
  const esAdmin = tieneRol('admin')
  const verVentas = tieneRol('vendedor') // vendedor o admin
  const [estado, setEstado] = useState({ cargando: true })

  useEffect(() => {
    let activo = true
    async function cargar() {
      const [prod, cli, ventas, ...stocks] = await Promise.all([
        api.get('/productos').catch(() => []),
        api.get('/clientes').catch(() => []),
        api.get('/ventas').catch(() => []),
        ...SUCURSALES.map((id) => api.get(`/stock/${id}`).then((s) => ({ id, s })).catch(() => ({ id, s: [] }))),
      ])
      if (!activo) return

      const stockPlano = stocks.flatMap(({ id, s }) => (s || []).map((x) => ({ ...x, id_suc: id })))
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
        <PageHeader titulo="Dashboard" descripcion="Resumen operativo del sistema." />
        <Cargando texto="Cargando métricas…" />
      </>
    )
  }

  const ventasRecientes = estado.ventas.slice(0, 6)
  const criticas = estado.alertas.filter((a) => a.estado === 'rojo').length

  return (
    <>
      <PageHeader
        titulo={`Hola, ${usuario?.username}`}
        descripcion={
          esAdmin
            ? 'Resumen operativo del comercio: métricas agregadas del nodo central y las tres sucursales.'
            : 'Resumen operativo de tu día.'
        }
      />

      {/* Métricas — el set se adapta al perfil. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {verVentas && (
          <StatCard etiqueta="Ventas registradas" valor={numero(estado.ventas.length)} pista={`${dinero(estado.totalVentas)} acumulado`} tono="accent" icono="ventas" delay={0} />
        )}
        <StatCard etiqueta="Productos activos" valor={numero(estado.productos.length)} sufijo="SKU" tono="ink" icono="productos" delay={60} />
        {verVentas && (
          <StatCard etiqueta="Clientes activos" valor={numero(estado.clientes.length)} tono="ink" icono="clientes" delay={120} />
        )}
        {!verVentas && (
          <StatCard etiqueta="Inventario bajo" valor={folio(estado.alertas.length, 2)} pista="Productos bajo mínimo" tono={estado.alertas.length ? 'warn' : 'ok'} icono="inventario" delay={120} />
        )}
        <StatCard
          etiqueta="Stock crítico"
          valor={folio(criticas, 2)}
          sufijo={`/ ${folio(estado.alertas.length, 2)} bajos`}
          pista={criticas ? 'Requiere reabastecimiento' : 'Inventario saludable'}
          tono={criticas ? 'danger' : 'ok'}
          icono="alert"
          delay={180}
        />
      </div>

      {(esAdmin || verVentas) && (
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Estado del clúster + decisión CP — infraestructura, solo admin. */}
        {esAdmin && (
        <div className="space-y-6 lg:col-span-1">
          <NodesPanel />

          {/* Decisión CP */}
          <Panel>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/12 text-accent">
                <Icon name="bolt" className="h-[18px] w-[18px]" />
              </span>
              <h3 className="font-display text-sm font-700 text-ink">Arquitectura CP</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Ante la caída de una sucursal durante una venta, la transacción distribuida hace
              <span className="font-600 text-ink-soft"> rollback completo</span>. Se prioriza la consistencia
              sobre la disponibilidad para evitar sobreventa.
            </p>
            <Link to="/simulador-cap" className="btn-ghost btn-sm mt-4">
              <Icon name="simulador" className="h-4 w-4" />
              Ver simulador
            </Link>
          </Panel>
        </div>
        )}

        {/* Ventas recientes — solo perfiles con acceso a ventas. */}
        {verVentas && (
        <Panel
          title="Ventas recientes"
          className={esAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}
          aside={
            <Link to="/ventas" className="inline-flex items-center gap-1 text-[13px] font-600 text-accent hover:text-accent-hover">
              Ver todas <Icon name="arrow" className="h-3.5 w-3.5" />
            </Link>
          }
          bodyClassName="p-0"
        >
          {ventasRecientes.length === 0 ? (
            <Vacio titulo="Aún no hay ventas" detalle="Registra una venta para ver el flujo distribuido en acción." />
          ) : (
            <div className="overflow-x-auto">
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
                    <tr key={v.id_venta} className="transition-colors hover:bg-surface2/60">
                      <td className="td font-mono font-600 text-accent">#{folio(v.id_venta)}</td>
                      <td className="td font-600 text-ink">{v.cliente || `cli ${v.id_cli}`}</td>
                      <td className="td capitalize text-ink-muted">{nombreNodo(v.id_suc)}</td>
                      <td className="td text-right font-600 text-ink">{dinero(v.total)}</td>
                      <td className="td text-right font-mono text-xs text-ink-faint">{fechaHora(v.fecha)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        )}
      </div>
      )}

      {/* Alertas de stock */}
      <Panel
        title="Alertas de inventario"
        className="mt-6"
        aside={
          <Link to="/stock" className="inline-flex items-center gap-1 text-[13px] font-600 text-accent hover:text-accent-hover">
            Inventario completo <Icon name="arrow" className="h-3.5 w-3.5" />
          </Link>
        }
        bodyClassName="p-0"
      >
        {estado.alertas.length === 0 ? (
          <Vacio titulo="Sin alertas" detalle="Todo el inventario está por encima de su mínimo." />
        ) : (
          <div className="overflow-x-auto">
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
                  <tr key={`${a.id_suc}-${a.id_prod}-${i}`} className="transition-colors hover:bg-surface2/60">
                    <td className="td font-600 text-ink">{a.producto || `prod ${a.id_prod}`}</td>
                    <td className="td capitalize text-ink-muted">{nombreNodo(a.id_suc)}</td>
                    <td className="td text-right font-mono font-600 tabular text-ink">{numero(a.cantidad)}</td>
                    <td className="td text-right font-mono tabular text-ink-faint">{numero(a.cantidad_minima)}</td>
                    <td className="td text-right">
                      <StockDot estado={a.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
