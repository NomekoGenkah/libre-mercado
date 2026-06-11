// ===========================================================================
//  Imagen de un producto.
//
//  Dos modos (cambia la constante LOCAL según prefieras):
//
//   • LOCAL = true  -> archivos locales en  frontend/public/productos/<id>.jpg
//       Recomendado para la demo: funciona SIN internet. Coloca las imágenes
//       nombradas por id de producto: 1.jpg, 2.jpg, ... 10.jpg.
//
//   • LOCAL = false -> placeholder público (picsum) determinista por id.
//       Cero archivos, pero requiere conexión a internet.
//
//  Si una imagen local no existe, el componente <ImagenProducto> cae de forma
//  elegante al ícono de producto (no se rompe nada).
// ===========================================================================

const LOCAL = true

export function imagenProducto(idProd) {
  return LOCAL
    ? `/productos/${idProd}.jpg`
    : `https://picsum.photos/seed/lm${idProd}/600/400`
}
