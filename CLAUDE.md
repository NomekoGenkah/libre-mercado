# CLAUDE.md — Guía de desarrollo de Libre Mercado

Guía para sesiones de Claude Code que trabajen en este repo. Contiene la
arquitectura, el plan de etapas y las convenciones. El `README.md` es la
versión orientada a personas.

> **Contexto académico:** prototipo de e-commerce distribuido para la segunda
> evaluación del curso de Sistemas Distribuidos (prof. Juan Torres O.).
> La rúbrica evalúa: (1) modelado y CRUD, (2) transacciones ACID, (3)
> justificación CAP, (4) calidad del código PHP, (5) defensa y demo en vivo.

## Estado actual

- ✅ **Etapa 1 — Infraestructura Docker** (COMPLETADA)
- ✅ **Etapa 2 — Schemas SQL** (COMPLETADA)
- ✅ **Etapa 3 — Capa de conexión PHP** (`config/`) (COMPLETADA)
- ✅ **Etapa 4 — Router y estructura base PHP** (COMPLETADA)
- ✅ **Etapa 5 — Controllers CRUD** (COMPLETADA)
- ✅ **Etapa 6 — Transacciones ACID (Two-Phase Commit)** (COMPLETADA)
- ✅ **Etapa 7 — Endpoint de simulación de fallo CAP** (COMPLETADA)
- ✅ **Etapa 8 — Autenticación con sesiones PHP** (COMPLETADA, adelantada)
- ✅ **Etapa 9 — Frontend React + Vite + Tailwind** (`frontend/`) (COMPLETADA)
- ✅ **Etapa 10 — Documento de arquitectura CAP** (`docs/arquitectura_CAP.md`) (COMPLETADA, adelantada con el Bloque D)
- ⬜ Etapa 11 — Testing y verificación final

Completar cada etapa y confirmar que funciona antes de avanzar a la siguiente.

---

## Arquitectura

### Infraestructura Docker (red `red_distribuida`, bridge)

| Contenedor | Rol | Puerto externo | Puerto interno |
|---|---|---|---|
| `nodo_central` | MariaDB 10.6 — tablas globales | 3306 | 3306 |
| `nodo_sucursal_norte` | MariaDB 10.6 — sucursal Norte | 3307 | 3306 |
| `nodo_sucursal_sur` | MariaDB 10.6 — sucursal Sur | 3308 | 3306 |
| `nodo_sucursal_este` | MariaDB 10.6 — sucursal Este | 3309 | 3306 |
| `app_php` | Apache + PHP 8.2 — lógica de negocio | 8080 | 80 |

El frontend React corre **fuera de Docker** en `localhost:5173` (Vite dev server).

### Decisión CAP: **CP** (Consistencia + Tolerancia a Particiones)

En e-commerce la sobreventa es inaceptable. Si cualquier nodo de sucursal no
responde durante una venta, la transacción completa hace **rollback**. El
sistema queda temporalmente indisponible pero los datos siempre son correctos.
La disponibilidad se sacrifica intencionalmente.

### Distribución de datos por nodo

**Nodo Central** — datos globales y coordinación:
- `productos` (id_prod, producto, precio, descripcion, activo)
- `categorias` (id_cat, categoria)
- `clientes` (id_cli, nombre, email, telefono, activo)
- `usuarios` (id_usr, id_cli, username, password_hash, rol, activo)
- `roles` (id_rol, rol, descripcion)
- `ventas` (id_venta, id_cli, id_suc, fecha, total, estado)
- `detalle_ventas` (id_detalle, id_venta, id_prod, cantidad, precio_unitario)
- `proveedores` (id_prov, proveedor, contacto, email, activo)

**Nodos de Sucursal (Norte / Sur / Este)** — datos locales:
- `sucursales` (id_suc, sucursal, direccion, region, nodo)
- `stock` (id_stock, id_prod, id_suc, cantidad, cantidad_minima)
- `movimientos_stock` (id_mov, id_prod, id_suc, tipo, cantidad, motivo, fecha)
- `compras` (id_compra, id_prov, id_suc, fecha, total, estado)
- `detalle_compras` (id_detalle, id_compra, id_prod, cantidad, precio_unitario)
- `carrito` (id_carrito, id_cli, id_suc, fecha_creacion, estado)
- `detalle_carrito` (id_detalle, id_carrito, id_prod, cantidad)

> El campo `nodo` en `sucursales` almacena el **nombre del contenedor Docker**
> (`nodo_sucursal_norte`, etc.) para que PHP sepa a qué MariaDB conectarse.

### Stack tecnológico

- **Backend**: PHP 8.2 puro (sin framework), PDO, Apache.
- **Frontend**: React 18 + Vite + Tailwind CSS v3.
- **Base de datos**: MariaDB 10.6 (un contenedor por sucursal).
- **Infra**: Docker + Docker Compose.
- **Auth**: login con sesiones PHP (`$_SESSION`) + roles (admin, vendedor, bodeguero).
- **Comunicación**: API REST JSON, CORS habilitado para `localhost:5173`.

---

## Plan de etapas (detalle)

### Etapa 1 — Setup e infraestructura Docker ✅
Archivos: `docker-compose.yml`, `Dockerfile`, `.env`, `.env.example`, `.gitignore`.
- Healthchecks MariaDB con `mysqladmin ping`.
- `app_php` con `depends_on` → `service_healthy` de los 4 nodos.
- Mounts: `./src` → `/var/www/html`; `./sql/<nodo>` → `/docker-entrypoint-initdb.d`.
- Variables de entorno con hosts y credenciales por nodo.

### Etapa 2 — Schemas SQL ✅
Archivos: `sql/central/{01_schema,02_seed}.sql` y equivalentes para `norte`,
`sur`, `este`.

> **Decisiones de implementación:**
> - `id_suc` es **globalmente único** entre nodos (Norte=1, Sur=2, Este=3),
>   asignado explícito en el seed → así `getNodoPorSucursal()` mapea limpio.
> - Cada nodo de sucursal hospeda **una** sucursal.
> - Columnas cross-node (`id_prod`, `id_cli`, `id_prov`) NO llevan FK (viven
>   en otro nodo) pero sí índice. Las FK locales usan `ON DELETE RESTRICT`.
> - `usuarios.rol` es FK a `roles(rol)`; `usuarios.id_cli` es nullable (el admin
>   no es cliente). `productos.id_cat` es FK a `categorias`.
> - **Seed de demo:** 5 categorías, 10 productos, 8 clientes, 4 proveedores,
>   3 usuarios. Credenciales: `admin/admin123`, `vendedor/vendedor123`,
>   `bodeguero/bodeguero123` (hashes bcrypt reales). 6 productos con stock bajo
>   en total (2 por sucursal) para las alertas. `ventas` se deja vacía a
>   propósito (se generan en la demo de la Etapa 6).
> - ⚠️ Los scripts de `/docker-entrypoint-initdb.d` solo corren con el volumen
>   **vacío**. Para re-aplicar cambios de schema/seed: `docker compose down -v
>   && docker compose up -d`.
- PKs `AUTO_INCREMENT`; FKs `ON DELETE RESTRICT`.
- `activo TINYINT(1) DEFAULT 1` en productos, clientes, usuarios, proveedores.
- Índices en campos de búsqueda frecuente (username, id_prod en stock, id_venta
  en detalle).
- `ENGINE=InnoDB` en todas las tablas (requerido para transacciones).
- `movimientos_stock.tipo ∈ {venta, reabastecimiento, ajuste, devolucion}`.
- Seed: 10 productos, 5 clientes, 1 usuario admin; **mínimo 3 productos con
  stock bajo** para mostrar alertas en la demo.

### Etapa 3 — Capa de conexión PHP
- `src/config/Database.php`: `conectarCentral(): PDO`,
  `conectarSucursal(string $nodo): PDO` (`'norte'|'sur'|'este'`),
  `getNodoPorSucursal(int $id_suc): string`.
- `src/config/Config.php`: lee `getenv()`, centraliza puertos y credenciales.
- PDO: `ERRMODE_EXCEPTION`, `FETCH_ASSOC`, `EMULATE_PREPARES => false`.
- Singleton por nodo. Manejar `PDOException` indicando qué nodo falló.

### Etapa 4 — Router y estructura base PHP
- `src/index.php` (CORS, parseo body JSON, invoca router),
  `src/router.php` (`MÉTODO /ruta` → `Controller::método`),
  `src/helpers/Response.php`, `src/helpers/Auth.php`,
  `src/middleware/AuthMiddleware.php`.
- Tabla de rutas: ver sección "Rutas API" abajo.

### Etapa 5 — Controllers CRUD
- `src/controllers/{Auth,Producto,Cliente,Usuario,Sucursal,Stock,Carrito,Proveedor}Controller.php`.
- Validación de input antes de cualquier query. Solo prepared statements.
- Borrado lógico (`activo = 0`) en productos, clientes, usuarios, proveedores.
- Validar dependencias antes de borrar. Códigos HTTP: 200/201/400/401/403/404/409/500.

### Etapa 6 — Transacciones ACID (Two-Phase Commit)
- `src/controllers/VentaController.php::procesarVenta()` — flujo:
  1. Conexión PDO central + conexión PDO a la sucursal.
  2. Validar producto activo (central) y stock suficiente (sucursal).
  3. `BEGIN` en central y en sucursal.
  4. `INSERT ventas` + `INSERT detalle_ventas` (central).
  5. `UPDATE stock - N` + `INSERT movimientos_stock tipo='venta'` (sucursal).
  6. Verificar que el `UPDATE` afectó exactamente 1 fila.
  7. OK → COMMIT sucursal → COMMIT central; si falla → ROLLBACK ambos.
  - Errores: stock insuficiente → 409 (sin abrir transacción); nodo caído →
    503 + rollback central; fallo intermedio → rollback ambos + `error_log`;
    cantidad ≤ 0 → 400.
- `src/controllers/CompraController.php::procesarReabastecimiento()` — registra
  compra (central) + aumenta stock (sucursal) + `movimientos_stock`
  tipo `'reabastecimiento'`; chequea `cantidad_minima`; transacción distribuida.

### Etapa 7 — Endpoint de simulación de fallo CAP
- `src/controllers/DebugController.php` — `POST /debug/simular-fallo`.
- Ejecuta pasos 1–9 de la venta, lanza excepción controlada **después** del
  UPDATE de stock y **antes** del COMMIT, hace rollback en ambos nodos.
- Devuelve JSON explicativo: operaciones ejecutadas, punto de fallo, rollbacks,
  estado del stock (sin cambios) y explicación del comportamiento CP.
- **Clave para la defensa.**

### Etapa 8 — Autenticación con sesiones PHP
- Roles: `admin` (total), `vendedor` (ventas + ver productos/stock),
  `bodeguero` (ver/ajustar stock, registrar compras).
- `AuthController`: `login()`, `logout()`, `me()`.
- `Auth`: `requerirLogin()` (401), `requerirRol(string ...$roles)` (403).
- Contraseñas con `password_hash()` / `password_verify()`.

### Etapa 9 — Frontend React + Vite + Tailwind
- Setup: Vite (template react) en `frontend/`, Tailwind v3, `axios`,
  `react-router-dom`.
- Estructura: `src/api/client.js`, `components/{ui,layout}`, `pages/*`,
  `context/AuthContext.jsx`, `App.jsx`.
- Páginas: Login, Dashboard (métricas), Productos, Clientes, Ventas, Stock
  (indicador verde/amarillo/rojo), Compras, **SimuladorCap** (timeline del
  fallo + estado de stock antes/después).
- Diseño: paleta slate/gris + acento azul, sidebar fijo, tablas con hover,
  badges semánticos, validación cliente, estados de carga y toasts.
- **CORS + sesiones**: axios con `withCredentials: true` y PHP con
  `Access-Control-Allow-Credentials: true`.

### Etapa 10 — Documento de arquitectura CAP
- `docs/arquitectura_CAP.md` (máx. 2 páginas): descripción del sistema, teorema
  CAP en e-commerce, decisión CP, comportamiento ante partición, trade-off,
  evidencia en código (`procesarVenta()` y `/debug/simular-fallo`).

### Etapa 11 — Testing y verificación final
Checklist end-to-end (ver `README.md`).

---

## Rutas API (Etapa 4)

> **Añadidos en la Etapa 5** respecto a la tabla original: `GET /categorias`
> (apoyo al formulario de productos) y el CRUD completo de proveedores
> (`GET/PUT/DELETE /proveedores/:id`, antes solo estaban listar y crear).

```
POST   /auth/login
POST   /auth/logout
GET    /auth/me

GET    /categorias

GET    /productos
POST   /productos
GET    /productos/:id
PUT    /productos/:id
DELETE /productos/:id

GET    /clientes
POST   /clientes
GET    /clientes/:id
PUT    /clientes/:id
DELETE /clientes/:id        (borrado lógico)

GET    /sucursales
GET    /sucursales/:id/stock

GET    /stock/:id_suc
PUT    /stock/:id_suc/:id_prod    (ajuste manual)

POST   /carrito
GET    /carrito/:id_cli
POST   /carrito/:id/items
DELETE /carrito/:id/items/:id_prod

POST   /ventas                    (Two-Phase Commit)
GET    /ventas
GET    /ventas/:id

GET    /proveedores
POST   /proveedores
GET    /proveedores/:id
PUT    /proveedores/:id
DELETE /proveedores/:id           (borrado lógico)

POST   /compras                   (reabastecimiento)
GET    /compras

GET    /movimientos/:id_suc       (historial de stock)

POST   /debug/simular-fallo       (simulación CAP)
```

---

## Convenciones de código

- PHP: clases en `PascalCase`, métodos en `camelCase`, variables `$camelCase`,
  constantes `UPPER_SNAKE_CASE`.
- React: componentes `PascalCase`, hooks `camelCase` con prefijo `use`.
- Cada controller con su `try/catch` y mensajes que indican el **nodo afectado**.
- **Nunca** concatenar input del usuario en SQL — siempre prepared statements.
- Todo endpoint responde `Content-Type: application/json`.
- Errores también a `error_log()` además de la respuesta HTTP.
- CORS: frontend en `localhost:5173`, backend en `localhost:8080`; sesiones
  requieren `credentials: 'include'` + `Access-Control-Allow-Credentials: true`.
