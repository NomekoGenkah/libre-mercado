# Imágenes de producto (vitrina)

La vitrina pública (`tienda.php`, `producto.php`) muestra la imagen de cada
producto desde este directorio, nombrada por su `id_prod`:

```
assets/productos/1.jpg
assets/productos/2.jpg
...
```

Formato recomendado: JPG/WebP, proporción ~4:3, ~600×400 px.

**No es obligatorio.** Si falta el archivo, `LM.imgProducto()` cae de forma
elegante a un placeholder geométrico (`◭`), sin romper la grilla ni la ficha.
Así la demo funciona sin internet y sin imágenes cargadas.
