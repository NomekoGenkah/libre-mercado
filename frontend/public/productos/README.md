# Imágenes de productos

Coloca aquí las imágenes de los productos, **nombradas por su `id_prod`**:

```
1.jpg   Auriculares Bluetooth
2.jpg   Teclado Mecánico RGB
3.jpg   Mouse Inalámbrico
4.jpg   Monitor 24" Full HD
5.jpg   Cafetera Express
6.jpg   Aspiradora Robot
7.jpg   Balón de Fútbol
8.jpg   Set de Mancuernas 20kg
9.jpg   Libro: Sistemas Distribuidos
10.jpg  Rompecabezas 1000 piezas
```

- Vite sirve esta carpeta en la raíz: `public/productos/1.jpg` → `/productos/1.jpg`.
- Formato por defecto: **`.jpg`**. Si usas otro, cámbialo en `src/lib/imagenes.js`.
- Si falta alguna imagen, la tarjeta cae automáticamente al ícono (no se rompe).
- ¿Sin imágenes a mano? Pon `LOCAL = false` en `src/lib/imagenes.js` para usar
  placeholders públicos (requiere internet).
