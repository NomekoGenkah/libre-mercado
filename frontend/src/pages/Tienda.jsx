import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { dinero } from '../lib/format'
import { Cargando, Chip, ErrorBanner, Vacio } from '../components/ui/primitives'
import { Icon } from '../components/ui/icons'

// ===========================================================================
//  Tienda pública (vitrina del comprador). Solo lectura: feed de productos
//  activos con su precio y disponibilidad agregada. Sin login, sin carrito.
//  Consume el endpoint público GET /catalogo.
// ===========================================================================
export default function Tienda() {
  const { datos, error, cargando } = useFetch('/catalogo')
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState(null)

  const productos = datos?.productos || []
  const parcial = datos?.parcial

  // Categorías presentes en el catálogo (para los filtros).
  const categorias = useMemo(() => {
    const set = new Set(productos.map((p) => p.categoria).filter(Boolean))
    return [...set].sort()
  }, [productos])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return productos.filter((p) => {
      if (categoria && p.categoria !== categoria) return false
      if (q && !p.producto.toLowerCase().includes(q)) return false
      return true
    })
  }, [productos, busqueda, categoria])

  return (
    <div>
      {/* Hero */}
      <section className="mb-8 animate-riseIn">
        <h1 className="font-display text-3xl font-800 tracking-tight text-ink lg:text-[40px]">
          Encuentra lo que <span className="text-gradient">necesitas</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Explora nuestro catálogo y revisa la disponibilidad en tiempo real. Sin registrarte.
        </p>
      </section>

      {/* Buscador + filtros */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="relative max-w-md">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar productos…"
            className="input w-full pl-10"
          />
        </div>

        {categorias.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <FiltroChip activo={!categoria} onClick={() => setCategoria(null)}>
              Todo
            </FiltroChip>
            {categorias.map((c) => (
              <FiltroChip key={c} activo={categoria === c} onClick={() => setCategoria(c)}>
                {c}
              </FiltroChip>
            ))}
          </div>
        )}
      </div>

      <ErrorBanner>{error}</ErrorBanner>

      {parcial && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn/10 px-4 py-3">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <p className="text-sm text-ink-soft">
            Algunas sucursales no respondieron; la disponibilidad mostrada puede ser parcial.
          </p>
        </div>
      )}

      {cargando ? (
        <Cargando texto="Cargando catálogo…" />
      ) : visibles.length === 0 ? (
        <Vacio titulo="Sin resultados" detalle="Prueba con otra búsqueda o categoría." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibles.map((p, i) => (
            <ProductoCard key={p.id_prod} prod={p} delay={i * 40} />
          ))}
        </div>
      )}
    </div>
  )
}

function FiltroChip({ activo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full border px-3.5 py-1.5 text-[13px] font-600 transition-colors',
        activo
          ? 'border-accent/50 bg-accent/15 text-accent'
          : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function ProductoCard({ prod, delay = 0 }) {
  const agotado = prod.agotado
  return (
    <Link
      to={`/producto/${prod.id_prod}`}
      className="group flex animate-riseIn flex-col rounded-xl border border-line bg-surface/60 p-4 transition-all hover:border-accent/50 hover:bg-surface2/60 hover:shadow-lift"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Marcador visual (sin imágenes en el seed) */}
      <div className="mb-4 grid h-32 place-items-center rounded-lg border border-line bg-paper">
        <Icon name="productos" className="h-9 w-9 text-ink-faint transition-colors group-hover:text-accent" />
      </div>

      <div className="mb-1 flex items-center justify-between gap-2">
        {prod.categoria && <Chip tono="neutral">{prod.categoria}</Chip>}
        <Chip tono={agotado ? 'danger' : 'ok'} dot>
          {agotado ? 'Agotado' : 'Disponible'}
        </Chip>
      </div>

      <h3 className="mt-1 line-clamp-2 text-[15px] font-700 text-ink">{prod.producto}</h3>
      {prod.descripcion && (
        <p className="mt-1 line-clamp-2 text-[13px] text-ink-faint">{prod.descripcion}</p>
      )}

      <div className="mt-auto pt-4">
        <p className="font-display text-xl font-800 tracking-tight text-ink">{dinero(prod.precio)}</p>
      </div>
    </Link>
  )
}
