# Libre Mercado — Frontend (Etapa 9)

Consola de operaciones del e-commerce distribuido. **React 18 + Vite + Tailwind
v3 + axios + react-router-dom**. Corre fuera de Docker en `localhost:5173` y
consume la API PHP en `localhost:8080` (sesiones por cookie, `withCredentials`).

Estética: *consola técnica clara* — esquinas rectas, tipografías industriales
(Archivo / Public Sans / IBM Plex Mono), acento azul eléctrico y decoración
geométrica de líneas finas (retícula, crosshairs, diagrama de nodos).

## Puesta en marcha

Requiere el backend levantado (`docker compose up -d` en la raíz del repo).

```bash
cd frontend
npm install
cp .env.example .env     # ajusta VITE_API_URL si el backend no está en :8080
npm run dev              # http://localhost:5173
```

Compilar para producción: `npm run build` (sale a `dist/`).

## Credenciales de demo

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | admin (acceso total) |
| `vendedor` | `vendedor123` | ventas + lectura |
| `bodeguero` | `bodeguero123` | stock + reabastecimiento |

En la pantalla de login hay botones que rellenan estas credenciales.

## Pantallas

| Ruta | Pantalla | Endpoints | Rol mínimo |
|---|---|---|---|
| `/login` | Login | `POST /auth/login`, `GET /auth/me` | — |
| `/dashboard` | Métricas + topología + alertas | `/salud`, `/productos`, `/clientes`, `/ventas`, `/stock/:id` | autenticado |
| `/ventas` | Historial + **nueva venta (2PC)** | `GET/POST /ventas`, `GET /ventas/:id`, `/stock/:id` | vendedor |
| `/stock` | Inventario por sucursal + ajuste + movimientos | `/stock/:id`, `PUT /stock/:id/:prod`, `/movimientos/:id` | lectura / bodeguero |
| `/compras` | Reabastecimiento (ACID local) | `GET/POST /compras` | bodeguero |
| `/productos` | CRUD catálogo | `/productos`, `/categorias` | lectura / admin edita |
| `/clientes` | CRUD clientes | `/clientes` | lectura / vendedor edita |
| `/proveedores` | CRUD proveedores | `/proveedores` | lectura / bodeguero edita |
| `/usuarios` | CRUD usuarios | `/usuarios` | **admin** |
| `/simulador-cap` | ⭐ Simulación de fallo CP | `POST /debug/simular-fallo` | **admin** |

La barra superior pinta el estado de los 4 nodos consultando `/salud` cada 15 s.

## Estructura

```
src/
├── main.jsx / App.jsx        # entrada + rutas protegidas (sesión + rol)
├── index.css                 # sistema de diseño (Tailwind + capas)
├── api/client.js             # axios withCredentials + sobre {ok,data|error}
├── context/                  # AuthContext (sesión) · ToastContext
├── hooks/useFetch.js         # lectura GET con estados
├── lib/format.js             # dinero/fecha/folio + mapa id_suc→nodo
├── components/
│   ├── layout/               # Sidebar · Topbar · AppLayout · nav
│   └── ui/                    # primitives · DataTable · Modal · Field ·
│                              #   StatCard · NodeDiagram · SucursalTabs
└── pages/                    # una por pantalla de la tabla de arriba
```
