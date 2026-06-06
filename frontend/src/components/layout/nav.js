// Definición de la navegación. Cada ítem puede declarar `adminOnly`.
// Los iconos son glifos geométricos simples (sin librería) para mantener el
// look "consola" y cero dependencias visuales.

export const SECCIONES = [
  {
    grupo: 'Operación',
    items: [
      { to: '/dashboard', etiqueta: 'Dashboard', glifo: '▦' },
      { to: '/ventas', etiqueta: 'Ventas', glifo: '◇', nota: '2PC' },
      { to: '/stock', etiqueta: 'Inventario', glifo: '▤' },
      { to: '/compras', etiqueta: 'Reabastecimiento', glifo: '▲' },
    ],
  },
  {
    grupo: 'Catálogo',
    items: [
      { to: '/productos', etiqueta: 'Productos', glifo: '●' },
      { to: '/clientes', etiqueta: 'Clientes', glifo: '◐' },
      { to: '/proveedores', etiqueta: 'Proveedores', glifo: '◑' },
    ],
  },
  {
    grupo: 'Sistema',
    items: [
      { to: '/usuarios', etiqueta: 'Usuarios', glifo: '◆', adminOnly: true },
      { to: '/simulador-cap', etiqueta: 'Simulador CAP', glifo: '⊘', adminOnly: true, destacado: true },
    ],
  },
]
