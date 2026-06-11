import { Link, useParams } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { dinero, numero } from '../lib/format'
import { Cargando, Chip, ErrorBanner } from '../components/ui/primitives'
import { Icon } from '../components/ui/icons'
import { ImagenProducto } from '../components/ui/ImagenProducto'

// ===========================================================================
//  Detalle público de un producto. Solo lectura: ficha + disponibilidad.
//  Consume GET /catalogo/:id (público). No hay carrito ni checkout.
// ===========================================================================
export default function ProductoPublico() {
  const { id } = useParams()
  const { datos: p, error, cargando } = useFetch(`/catalogo/${id}`, [id])

  return (
    <div>
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-600 text-ink-muted transition-colors hover:text-accent"
      >
        <Icon name="arrow" className="h-3.5 w-3.5 rotate-180" />
        Volver al catálogo
      </Link>

      <ErrorBanner>{error}</ErrorBanner>

      {cargando ? (
        <Cargando texto="Cargando producto…" />
      ) : !p ? null : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Imagen del producto (con fallback al ícono si falta el archivo) */}
          <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-surface/60 animate-riseIn">
            <ImagenProducto idProd={p.id_prod} alt={p.producto} />
          </div>

          {/* Ficha */}
          <div className="animate-riseIn" style={{ animationDelay: '60ms' }}>
            {p.categoria && <Chip tono="neutral" className="mb-3">{p.categoria}</Chip>}
            <h1 className="font-display text-3xl font-800 tracking-tight text-ink">{p.producto}</h1>

            <p className="mt-4 font-display text-3xl font-800 tracking-tight text-ink">
              {dinero(p.precio)}
            </p>

            <div className="mt-4 flex items-center gap-3">
              <Chip tono={p.agotado ? 'danger' : 'ok'} dot>
                {p.agotado ? 'Sin stock' : 'Disponible'}
              </Chip>
              {!p.agotado && (
                <span className="text-[13px] text-ink-faint">
                  {numero(p.disponible)} unidades en bodega
                </span>
              )}
            </div>

            {p.descripcion && (
              <div className="mt-6 border-t border-line pt-6">
                <h2 className="mb-2 text-sm font-700 text-ink">Descripción</h2>
                <p className="text-sm leading-relaxed text-ink-muted">{p.descripcion}</p>
              </div>
            )}

            <div className="mt-8 rounded-lg border border-line bg-surface2/50 px-4 py-3.5">
              <p className="text-[13px] text-ink-muted">
                Para concretar tu compra, acércate a una de nuestras sucursales con un vendedor.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
