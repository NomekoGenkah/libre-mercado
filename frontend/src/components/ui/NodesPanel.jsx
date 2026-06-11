import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Icon } from './icons'

// ===========================================================================
//  Estado de los nodos del clúster. Hace ping a /salud cada 10 s y dibuja una
//  tarjeta por nodo (central + 3 sucursales) con su rol, puerto y latido.
// ===========================================================================

const NODOS = [
  { key: 'central', nombre: 'Central', rol: 'Coordinador · catálogo y ventas', puerto: ':3306' },
  { key: 'norte', nombre: 'Sucursal Norte', rol: 'Inventario local', puerto: ':3307' },
  { key: 'sur', nombre: 'Sucursal Sur', rol: 'Inventario local', puerto: ':3308' },
  { key: 'este', nombre: 'Sucursal Este', rol: 'Inventario local', puerto: ':3309' },
]

// El estado del clúster es información de infraestructura: solo la consume el
// admin. `enabled=false` evita el polling para los demás perfiles.
export function useSalud(intervaloMs = 10000, enabled = true) {
  const [salud, setSalud] = useState(null)
  useEffect(() => {
    if (!enabled) return undefined
    let activo = true
    const consultar = () => {
      api
        .get('/salud')
        .then((d) => activo && setSalud({ ok: true, nodos: d?.nodos }))
        .catch((e) => activo && setSalud({ ok: false, nodos: e?.detalle?.nodos }))
    }
    consultar()
    const t = setInterval(consultar, intervaloMs)
    return () => {
      activo = false
      clearInterval(t)
    }
  }, [intervaloMs, enabled])
  return salud
}

export function NodesPanel() {
  const salud = useSalud()
  const nodos = salud?.nodos || {}
  const conocido = Object.keys(nodos).length > 0
  const arriba = Object.values(nodos).filter((v) => v === 'ok').length

  return (
    <section className="panel overflow-hidden shadow-frame">
      <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent-soft text-accent">
            <Icon name="nodos" className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-sm font-700 text-ink">Estado del clúster</h2>
            <p className="text-[11px] text-ink-faint">red_distribuida · MariaDB 10.6</p>
          </div>
        </div>
        <span
          className={`chip ${
            !conocido
              ? 'border-line text-ink-faint'
              : arriba === 4
                ? 'border-ok/40 bg-ok/10 text-ok'
                : 'border-danger/40 bg-danger/10 text-danger'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${arriba === 4 ? 'bg-ok' : conocido ? 'bg-danger' : 'bg-ink-faint'}`} />
          {conocido ? `${arriba}/4 en línea` : 'consultando…'}
        </span>
      </header>

      <div className="grid grid-cols-1 divide-y divide-line-soft sm:grid-cols-2 sm:divide-y-0">
        {NODOS.map((n, i) => {
          const estado = nodos[n.key]
          const ok = estado === 'ok'
          const sabido = n.key in nodos
          return (
            <div
              key={n.key}
              className={`flex items-center gap-3 px-5 py-4 ${i % 2 === 0 ? 'sm:border-r sm:border-line-soft' : ''} ${
                i < 2 ? 'sm:border-b sm:border-line-soft' : ''
              }`}
            >
              <span className="relative flex h-3 w-3 shrink-0">
                {ok && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok/60" />}
                <span
                  className={`relative inline-flex h-3 w-3 rounded-full ${
                    !sabido ? 'bg-ink-faint' : ok ? 'bg-ok' : 'bg-danger'
                  }`}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-600 text-ink">{n.nombre}</p>
                <p className="truncate text-[11px] text-ink-faint">{n.rol}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[11px] text-ink-muted">{n.puerto}</p>
                <p className={`text-[10px] font-600 uppercase tracking-wider2 ${!sabido ? 'text-ink-faint' : ok ? 'text-ok' : 'text-danger'}`}>
                  {!sabido ? '—' : ok ? 'online' : 'offline'}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
