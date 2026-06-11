import { useState } from 'react'
import { imagenProducto } from '../../lib/imagenes'
import { Icon } from './icons'

// ===========================================================================
//  Imagen de producto que LLENA su contenedor (el padre define tamaño, borde
//  y rounded/overflow-hidden). Si la imagen no carga (archivo ausente o sin
//  red), cae al ícono de producto para no romper la vitrina.
// ===========================================================================
export function ImagenProducto({ idProd, alt }) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div className="grid h-full w-full place-items-center">
        <Icon name="productos" className="h-9 w-9 text-ink-faint" />
      </div>
    )
  }

  return (
    <img
      src={imagenProducto(idProd)}
      alt={alt || 'Producto'}
      loading="lazy"
      onError={() => setError(true)}
      className="h-full w-full object-cover"
    />
  )
}
