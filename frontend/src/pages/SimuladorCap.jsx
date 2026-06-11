import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import { useFetch } from '../hooks/useFetch'
import { PageHeader } from '../components/layout/AppLayout'
import { Panel, Chip, Kicker, Spinner } from '../components/ui/primitives'
import { Field, Select } from '../components/ui/Field'
import { NodeDiagram } from '../components/ui/NodeDiagram'
import { SucursalTabs } from '../components/ui/SucursalTabs'
import { Icon } from '../components/ui/icons'
import { numero, nombreNodo } from '../lib/format'

export default function SimuladorCap() {
  const toast = useToast()
  const { datos: clientes } = useFetch('/clientes')
  const [idSuc, setIdSuc] = useState(1)
  const [idCli, setIdCli] = useState('1')
  const [idProd, setIdProd] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [stock, setStock] = useState([])

  const [corriendo, setCorriendo] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [pasosVisibles, setPasosVisibles] = useState(0)

  // Stock de la sucursal elegida para poder escoger un producto con existencias.
  useEffect(() => {
    let activo = true
    api
      .get(`/stock/${idSuc}`)
      .then((s) => {
        if (!activo) return
        setStock(s || [])
        const conStock = (s || []).find((x) => Number(x.cantidad) > 0)
        setIdProd(conStock ? String(conStock.id_prod) : '')
      })
      .catch(() => activo && setStock([]))
    return () => {
      activo = false
    }
  }, [idSuc])

  // Revela el timeline paso a paso para dar sensación de ejecución en vivo.
  useEffect(() => {
    if (!resultado?.timeline) return
    setPasosVisibles(0)
    let i = 0
    const t = setInterval(() => {
      i += 1
      setPasosVisibles(i)
      if (i >= resultado.timeline.length) clearInterval(t)
    }, 320)
    return () => clearInterval(t)
  }, [resultado])

  const ejecutar = async () => {
    setCorriendo(true)
    setError(null)
    setResultado(null)
    try {
      const body = {
        id_cli: Number(idCli) || 1,
        id_suc: idSuc,
        items: idProd ? [{ id_prod: Number(idProd), cantidad: Math.max(1, Number(cantidad) || 1) }] : undefined,
      }
      const r = await api.post('/debug/simular-fallo', body)
      setResultado(r)
      if (r.consistencia_preservada) toast.ok('Consistencia preservada: rollback total, sin sobreventa.')
      else toast.error('¡Inconsistencia detectada! Revisar.')
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setCorriendo(false)
    }
  }

  const disponibles = stock.filter((s) => Number(s.cantidad) > 0)

  return (
    <>
      <PageHeader
        codigo="Tolerancia a fallos"
        titulo="Simulador de fallo distribuido"
        descripcion="Reproduce una venta que falla justo DESPUÉS de descontar el stock y ANTES del COMMIT. Demuestra el comportamiento CP: rollback total en ambos nodos, sin sobreventa. Nada se persiste."
      />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Configuración */}
        <div className="space-y-6">
          <Panel title="Parámetros de la simulación">
            <div className="space-y-4">
              <div>
                <span className="field-label">Sucursal objetivo (nodo a "caer")</span>
                <SucursalTabs value={idSuc} onChange={setIdSuc} />
              </div>
              <Field label="Cliente">
                <Select value={idCli} onChange={(e) => setIdCli(e.target.value)}>
                  {(clientes || []).map((c) => (
                    <option key={c.id_cli} value={c.id_cli}>
                      {c.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-[1fr_88px] gap-3">
                <Field label="Producto">
                  <Select value={idProd} onChange={(e) => setIdProd(e.target.value)} disabled={disponibles.length === 0}>
                    {disponibles.length === 0 && <option value="">Sin stock</option>}
                    {disponibles.map((s) => (
                      <option key={s.id_prod} value={s.id_prod}>
                        {s.producto} · stock {s.cantidad}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Cantidad">
                  <input
                    type="number"
                    min="1"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    className="input"
                  />
                </Field>
              </div>

              <button className="btn-primary w-full" onClick={ejecutar} disabled={corriendo}>
                {corriendo ? <Spinner size={14} /> : <Icon name="bolt" className="h-4 w-4" />}
                {corriendo ? 'Ejecutando…' : 'Ejecutar simulación'}
              </button>
              <p className="text-xs leading-relaxed text-ink-faint">
                Operación segura: el backend lanza una excepción controlada y revierte todo. El stock real
                no cambia.
              </p>
            </div>
          </Panel>

          {/* Topología con el fallo marcado */}
          <Panel title="Topología durante el fallo">
            <NodeDiagram
              estados={
                resultado
                  ? { central: 'falla', norte: 'ok', sur: 'ok', este: 'ok', [nombreNodo(idSuc)]: 'falla' }
                  : { central: 'activo', [nombreNodo(idSuc)]: 'activo' }
              }
            />
            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider2 text-ink-faint">
              {resultado ? 'Enlace roto → rollback en ambos nodos' : 'En espera de ejecución'}
            </p>
          </Panel>
        </div>

        {/* Resultados */}
        <div className="space-y-6">
          {!resultado && !error && !corriendo && <Reposo />}
          {corriendo && <EnEjecucion nodo={nombreNodo(idSuc)} />}
          {error && (
            <Panel title="Error">
              <p className="text-sm text-danger">{error}</p>
            </Panel>
          )}
          {resultado && (
            <>
              <Veredicto r={resultado} />
              <div className="grid gap-6 xl:grid-cols-2">
                <Timeline pasos={resultado.timeline} visibles={pasosVisibles} />
                <StockComparativo stock={resultado.stock} />
              </div>
              <Explicacion r={resultado} />
            </>
          )}
        </div>
      </div>
    </>
  )
}

function Reposo() {
  return (
    <Panel bodyClassName="p-0">
      <div className="flex flex-col items-center justify-center gap-4 border-b border-line py-20 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent/12 text-accent">
          <Icon name="simulador" className="h-8 w-8" />
        </span>
        <div>
          <p className="font-display text-lg font-700 text-ink">Simulación en espera</p>
          <p className="mt-1 max-w-sm text-sm text-ink-muted">
            Configura los parámetros y ejecuta para ver el timeline del fallo, el rollback y la verificación
            de consistencia.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-line">
        {[
          ['1', 'Prepara y descuenta stock'],
          ['2', 'Falla antes del COMMIT'],
          ['3', 'Rollback + verificación'],
        ].map(([n, t]) => (
          <div key={n} className="px-4 py-4">
            <span className="font-mono text-2xl font-700 text-accent">{n}</span>
            <p className="mt-1 text-xs text-ink-muted">{t}</p>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function EnEjecucion({ nodo }) {
  return (
    <Panel>
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Spinner size={28} />
        <p className="font-mono text-xs uppercase tracking-wider2 text-ink-muted">
          Ejecutando transacción distribuida en {nodo}…
        </p>
      </div>
    </Panel>
  )
}

function Veredicto({ r }) {
  const ok = r.consistencia_preservada
  return (
    <div className={`panel relative overflow-hidden border-l-[4px] ${ok ? 'border-l-ok' : 'border-l-danger'} bg-surface p-6 shadow-frame animate-riseIn`}>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div>
          <Kicker>Resultado</Kicker>
          <p className={`mt-1 font-display text-2xl font-800 tracking-tight ${ok ? 'text-ok' : 'text-danger'}`}>
            {ok ? 'CONSISTENCIA PRESERVADA' : 'INCONSISTENCIA'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip tono={r.venta_persistida ? 'danger' : 'ok'} dot>
            Venta {r.venta_persistida ? 'persistida' : 'no registrada'}
          </Chip>
          <Chip tono={r.rollback?.central === 'ejecutado' ? 'ok' : 'neutral'} dot>
            Rollback central
          </Chip>
          <Chip tono={r.rollback?.sucursal === 'ejecutado' ? 'ok' : 'neutral'} dot>
            Rollback sucursal
          </Chip>
        </div>
      </div>
    </div>
  )
}

function Timeline({ pasos = [], visibles }) {
  const esFallo = (txt) => /⚠|excep|fallo/i.test(txt)
  const esRollback = (txt) => /rollback/i.test(txt)
  return (
    <Panel title="Timeline de ejecución" bodyClassName="p-5">
      <ol className="relative space-y-0">
        {pasos.map((p, i) => {
          const visible = i < visibles
          const fallo = esFallo(p.accion) || esFallo(p.resultado)
          const rb = esRollback(p.accion)
          const color = fallo ? 'border-danger bg-danger' : rb ? 'border-accent bg-accent' : 'border-ok bg-ok'
          return (
            <li
              key={i}
              className={`relative flex gap-4 pb-5 transition-all duration-300 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
            >
              {/* línea vertical */}
              {i < pasos.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-line" />}
              <span className={`relative z-10 mt-1 h-3.5 w-3.5 shrink-0 border-2 ${visible ? color : 'border-line bg-surface'}`} />
              <div className="flex-1">
                <p className={`text-sm font-600 ${fallo ? 'text-danger' : 'text-ink'}`}>{p.accion}</p>
                <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-ink-muted">{p.resultado}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

function StockComparativo({ stock }) {
  // Une los 3 snapshots por id_prod para comparar antes / durante / después.
  const filas = useMemo(() => {
    const idx = {}
    const sumar = (clave, arr) =>
      (arr || []).forEach((x) => {
        idx[x.id_prod] = idx[x.id_prod] || { id_prod: x.id_prod }
        idx[x.id_prod][clave] = x.cantidad
      })
    sumar('antes', stock?.antes)
    sumar('durante', stock?.durante_transaccion)
    sumar('despues', stock?.despues_rollback)
    return Object.values(idx)
  }, [stock])

  return (
    <Panel title="Stock · antes / durante / después" bodyClassName="p-0">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="th">Prod</th>
            <th className="th text-right">Antes</th>
            <th className="th text-right">Durante (sin commit)</th>
            <th className="th text-right">Después (rollback)</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const restaurado = f.antes === f.despues
            return (
              <tr key={f.id_prod}>
                <td className="td font-mono text-ink-faint">#{String(f.id_prod).padStart(3, '0')}</td>
                <td className="td text-right font-mono font-600 tabular">{numero(f.antes)}</td>
                <td className="td text-right font-mono tabular text-warn">{numero(f.durante)}</td>
                <td className="td text-right">
                  <span className={`font-mono font-600 tabular ${restaurado ? 'text-ok' : 'text-danger'}`}>
                    {numero(f.despues)}
                  </span>
                  {restaurado && <span className="ml-1.5 font-mono text-[10px] text-ok">↺</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="border-t border-line px-4 py-2.5">
        <p className="font-mono text-[10px] leading-relaxed text-ink-faint">
          Durante la transacción el stock se ve descontado (cambio no confirmado). Tras el rollback vuelve
          a su valor original ↺.
        </p>
      </div>
    </Panel>
  )
}

function Explicacion({ r }) {
  return (
    <Panel title="Por qué es CP">
      <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
        <div className="flex gap-2">
          <Letra l="C" activo />
          <Letra l="A" />
          <Letra l="P" activo />
        </div>
        <div>
          <p className="text-sm leading-relaxed text-ink-soft">{r.explicacion_CP}</p>
          <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink-faint">
            <span className="text-ink-muted">punto_de_fallo:</span> {r.punto_de_fallo}
          </p>
        </div>
      </div>
    </Panel>
  )
}

function Letra({ l, activo }) {
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 font-display text-2xl font-800 ${
        activo ? 'border-accent bg-accent text-white' : 'border-line text-ink-faint'
      }`}
    >
      {l}
    </div>
  )
}
