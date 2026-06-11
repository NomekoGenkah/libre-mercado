// ===========================================================================
//  Modelo de navegación por PERFIL — fuente única de verdad del acceso interno.
//
//  Cada ítem declara `roles`: los perfiles que lo ven en el sidebar Y pueden
//  entrar a la ruta (el guard <ConRol> de App.jsx usa la misma lista). 'admin'
//  pasa siempre (igual que en el backend), así que no hace falta listarlo;
//  `roles: []` => solo admin.
//
//  Perfiles internos:
//    · vendedor  → ventas + catálogo de cara al cliente (sin infra).
//    · bodeguero → inventario + reabastecimiento + proveedores (sin infra).
//    · admin     → todo, incluida la capa de infraestructura (clúster, CAP,
//                  usuarios). Es el único que ve la naturaleza distribuida.
//
//  El comprador NO aparece aquí: navega la tienda pública, fuera de la consola.
// ===========================================================================

export const ROLES = {
  ADMIN: 'admin',
  VENDEDOR: 'vendedor',
  BODEGUERO: 'bodeguero',
}

// Ruta de aterrizaje tras el login y destino al que se devuelve a un perfil que
// intenta entrar a una sección que no le corresponde. Todos los perfiles
// internos aterrizan en el dashboard, cuyo contenido se adapta al rol.
export function inicioDeRol(_rol) {
  return '/dashboard'
}

export const SECCIONES = [
  {
    grupo: 'Operación',
    items: [
      { to: '/dashboard', etiqueta: 'Dashboard', icono: 'dashboard', roles: ['vendedor', 'bodeguero'] },
      { to: '/ventas', etiqueta: 'Ventas', icono: 'ventas', roles: ['vendedor'] },
      { to: '/stock', etiqueta: 'Inventario', icono: 'inventario', roles: ['vendedor', 'bodeguero'] },
      { to: '/compras', etiqueta: 'Reabastecimiento', icono: 'compras', roles: ['bodeguero'] },
    ],
  },
  {
    grupo: 'Catálogo',
    items: [
      { to: '/productos', etiqueta: 'Productos', icono: 'productos', roles: ['vendedor', 'bodeguero'] },
      { to: '/clientes', etiqueta: 'Clientes', icono: 'clientes', roles: ['vendedor'] },
      { to: '/proveedores', etiqueta: 'Proveedores', icono: 'proveedores', roles: ['bodeguero'] },
    ],
  },
  {
    grupo: 'Sistema',
    items: [
      { to: '/usuarios', etiqueta: 'Usuarios', icono: 'usuarios', roles: [] },
      { to: '/simulador-cap', etiqueta: 'Simulador CAP', icono: 'simulador', roles: [], destacado: true },
    ],
  },
]
