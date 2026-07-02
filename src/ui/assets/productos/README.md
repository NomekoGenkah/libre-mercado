# Imágenes de producto (vitrina)

La vitrina pública (`tienda.php`, `producto.php`) muestra la imagen de cada
producto desde este directorio. Las imágenes se nombran por `id_prod`:

```
assets/productos/1.jpg      → imagen principal
assets/productos/1_1.jpg    → imagen extra (opcional)
assets/productos/1_2.jpg    → imagen extra (opcional)
...
```

Extensiones aceptadas: `.jpg`, `.jpeg`, `.webp`, `.png`.
El front-end prueba cada extensión en orden si la primera no carga.

Formato recomendado: JPG/WebP, proporción ~4:3, ~600×400 px.

**No es obligatorio.** Si falta el archivo, `LM.imgProducto()` cae de forma
elegante a un placeholder geométrico (`◭`), sin romper la grilla ni la ficha.
Así la demo funciona sin internet y sin imágenes cargadas.
