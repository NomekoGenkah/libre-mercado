# Libre Mercado — Lo que falta por implementar

> Documento base para repartir el trabajo entre **3 personas**.
> Cruza lo exigido por la **evaluación** (CRUD, ACID, CAP, PHP/PDO, defensa) con
> el **estado real del repositorio** a la fecha.

## Estado actual del repo (lo que YA está hecho)

- ✅ **Infraestructura Docker** — `docker-compose.yml`, `Dockerfile`, `.env`.
  5 contenedores: `nodo_central`, `nodo_sucursal_norte/sur/este` (MariaDB) y
  `app_php` (Apache + PHP 8.2). Red `red_distribuida`.
- ✅ **Schemas SQL + seed** — `sql/central`, `sql/norte`, `sql/sur`, `sql/este`
  con `01_schema.sql` y `02_seed.sql`. Tablas, FKs locales, índices, datos de
  demo (productos, clientes, usuarios con hash bcrypt, stock bajo para alertas).
- ⚠️ **PHP** — solo existe `src/index.php` (placeholder de health-check).
  **No hay backend funcional todavía.**

**Conclusión: falta TODO el backend PHP, TODO el frontend, el documento CAP y el testing.**

---

## Mapa: Requisito de la evaluación → Qué falta

| Requisito de la rúbrica | Estado | Dónde se resuelve |
|---|---|---|
| **R1 — CRUD distribuido** (crear/leer/actualizar/eliminar + borrado lógico) | ❌ Falta | Capa conexión + Router + Controllers |
| **R2 — Transacciones ACID** (venta atómica, rollback si falla un nodo) | ❌ Falta | `VentaController` (Two-Phase Commit) |
| **R3 — Teorema CAP** (elección CP + simulación de partición + documento) | ❌ Falta | `DebugController` + `docs/arquitectura_CAP.md` |
| **R4 — Backend PHP limpio + PDO + manejo de excepciones** | ❌ Falta | Toda la capa PHP |
| **Defensa y demo** (que compile, corra y se explique en vivo) | ❌ Falta | Frontend + testing end-to-end |

---

## TAREAS PENDIENTES (agrupadas por bloque)

### BLOQUE A — Fundamentos del backend PHP ✅ COMPLETADO
*Sin esto no funciona nada más. Hay que hacerlo primero.*

- [x] **A1. Capa de conexión PDO** (`src/config/`)
  - `Config.php`: lee credenciales/puertos desde `getenv()`.
  - `Database.php`: `conectarCentral()`, `conectarSucursal('norte'|'sur'|'este')`,
    `getNodoPorSucursal(id_suc)`. Singleton por nodo.
  - PDO con `ERRMODE_EXCEPTION`, `FETCH_ASSOC`, `EMULATE_PREPARES=false`.
  - Manejo de `PDOException` indicando **qué nodo falló** (`NodoException` → 503).
- [x] **A2. Router y estructura base** (`src/`)
  - `index.php` real (CORS con credenciales, sesión, parseo de body JSON,
    manejo global de excepciones, autoloader).
  - `router.php` (mapea `MÉTODO /ruta` → `Controller@método`, params `:id`,
    middleware de auth/roles por ruta; tabla de rutas completa).
  - `helpers/Response.php` (respuestas JSON `{ok,data|error}` con códigos HTTP).
  - `helpers/Auth.php` (sesiones + guards) y `middleware/AuthMiddleware.php`.
  - `.htaccess` + `Dockerfile` (AllowOverride All) para el front controller.

> **Convención fijada para los controllers (Bloque B/C/D):** son clases con
> métodos de instancia y firma `metodo(array $params, array $body)`. El router
> los instancia con `new` y, si la clase aún no existe, responde **501** limpio.
> Endpoint de diagnóstico: `GET /salud` pingea los 4 nodos.

### BLOQUE B — CRUD de entidades (Requisito 1) ✅ COMPLETADO
*Cada controller: validación de input, solo prepared statements, try/catch.*

- [x] **B1. ProductoController** — CRUD + borrado lógico (`activo=0`) + `GET /categorias`.
- [x] **B2. ClienteController** — CRUD + borrado lógico (email único → 409).
- [x] **B3. UsuarioController** — CRUD + borrado lógico + roles (nunca expone `password_hash`).
- [x] **B4. ProveedorController** — CRUD completo + borrado lógico.
- [x] **B5. SucursalController** — listar sucursales (agrega los 3 nodos) + stock por sucursal.
- [x] **B6. StockController** — stock por sucursal (semáforo verde/amarillo/rojo),
  ajuste manual (transacción local) y `GET /movimientos/:id_suc`.
- [x] **B7. CarritoController** — crear carrito, agregar/quitar ítems.
- [x] Validación de input (`helpers/Validador.php`), solo prepared statements,
  códigos HTTP 200/201/400/404/409 y manejo de duplicados.

> **Notas de implementación del Bloque B:**
> - `helpers/Validador.php` centraliza la validación de input y traduce los
>   errores a 400 (y duplicados UNIQUE a 409).
> - Controllers central: Producto/Cliente/Usuario/Proveedor. Controllers de
>   sucursal: Sucursal/Stock/Carrito (cruzan con central para nombres/precios).
> - `getNodoPorSucursal(id_suc)` mapea la sucursal al nodo; los endpoints de
>   sucursal aceptan `id_suc ∈ {1,2,3}`.
> - **Carrito**: como el `id_carrito` es autoincremental local de cada nodo (no
>   único entre sucursales), las operaciones sobre ítems exigen `id_suc`
>   (en body para agregar, en query `?id_suc=` para quitar).
> - Lecturas multi-nodo (`GET /sucursales`, `GET /carrito/:id_cli`) son
>   resilientes: si un nodo está caído lo reportan en `nodos_caidos`.
> - ⚠️ **Pendiente para probar B end-to-end:** las rutas exigen sesión, así que
>   hace falta el **Bloque E (login)** o desactivar temporalmente el middleware.

### BLOQUE C — Transacciones ACID (Requisito 2) ✅ COMPLETADO ⭐ CRÍTICO PARA LA NOTA
*Es el corazón distribuido del proyecto. Es lo más valorado en la rúbrica.*

- [x] **C1. VentaController::procesarVenta()** — Two-Phase Commit:
  - Conexión a central + sucursal.
  - Validar producto activo (central) y stock suficiente (sucursal).
  - `BEGIN` en ambos nodos.
  - `INSERT ventas` + `INSERT detalle_ventas` (central).
  - `UPDATE stock - N` + `INSERT movimientos_stock` tipo `'venta'` (sucursal).
  - Verificar que el UPDATE afectó exactamente 1 fila.
  - COMMIT en ambos; si algo falla → **ROLLBACK en ambos**.
  - Errores: stock insuficiente → 409; nodo caído → 503 + rollback; cantidad ≤ 0 → 400.
- [x] **C2. CompraController::procesarReabastecimiento()** — transacción ACID
  **local** (compras/stock/movimientos viven todas en el nodo de sucursal):
  registra compra + aumenta stock (upsert) + `movimientos_stock`
  tipo `'reabastecimiento'`. Valida proveedor/productos activos en central.
- [x] **C3. Endpoints GET de ventas/compras/movimientos** (`/ventas`, `/ventas/:id`,
  `/compras`, `/movimientos/:id_suc`).

> **Aclaración C1 vs C2:** la **venta** es la transacción **distribuida** real
> (escribe `ventas` en central + `stock` en sucursal → 2PC con central como
> coordinador). El **reabastecimiento** resultó ser **local** porque el schema
> ubica `compras` en el nodo de sucursal (la línea original de C2 decía
> "compra (central)", pero el modelo de datos manda → es local).
> La cobertura e2e (`tests/e2e/api.sh`) verifica: descuento atómico de stock,
> sobreventa → 409 sin alterar stock, y reabastecimiento que sube el stock.

### BLOQUE D — Teorema CAP (Requisito 3) ⭐ CLAVE EN LA DEFENSA
- [ ] **D1. DebugController — `POST /debug/simular-fallo`**
  - Ejecuta los pasos de la venta, lanza excepción **después** del UPDATE de
    stock y **antes** del COMMIT, hace rollback en ambos nodos.
  - Devuelve JSON explicativo: operaciones ejecutadas, punto de fallo,
    rollbacks, stock sin cambios y explicación del comportamiento **CP**.
- [ ] **D2. `docs/arquitectura_CAP.md`** (máx. 2 páginas) — **ENTREGABLE**:
  descripción del sistema, teorema CAP en e-commerce, justificación de la
  elección **CP** (consistencia sobre disponibilidad → evitar sobreventa),
  comportamiento ante partición, trade-off y evidencia en código
  (`procesarVenta()` y `/debug/simular-fallo`).

### BLOQUE E — Autenticación (apoya CRUD y demo) ✅ COMPLETADO
- [x] **E1. AuthController** — `login()`, `logout()`, `me()` con sesiones PHP.
- [x] **E2. Auth helper** — `requerirLogin()` (401), `requerirRol(...)` (403).
- [x] **E3. Roles**: admin (total), vendedor (ventas + ver), bodeguero (stock + compras).
- [x] Contraseñas con `password_hash()` / `password_verify()`.

> **Notas del Bloque E:** `login` responde 401 genérico (no revela si el
> usuario existe) y regenera el id de sesión al autenticar. Las rutas CRUD ya
> son probables end-to-end (login con `admin/admin123`). Los guards de rol
> aplican: `admin` pasa siempre; `vendedor`/`bodeguero` según la ruta.

### BLOQUE F — Frontend React (para la demo en vivo)
*No lo pide explícitamente la rúbrica, pero la "Defensa y Demo" lo necesita.*

- [ ] **F1. Setup** — Vite + React 18 + Tailwind v3 + axios + react-router-dom
  en `frontend/`. `axios` con `withCredentials: true`.
- [ ] **F2. Auth** — `AuthContext`, página de Login, rutas protegidas.
- [ ] **F3. Páginas CRUD** — Productos, Clientes, Proveedores, (Usuarios).
- [ ] **F4. Dashboard** — métricas generales.
- [ ] **F5. Stock** — indicador verde/amarillo/rojo + alertas de stock bajo.
- [ ] **F6. Ventas y Compras** — formularios + listados.
- [ ] **F7. SimuladorCAP** ⭐ — timeline del fallo + estado de stock antes/después
  (consume `/debug/simular-fallo`). Es la pantalla estrella de la defensa.

### BLOQUE G — Testing y cierre (Defensa y Demo)
- [ ] **G1.** Levantar todo con `docker compose up -d` y verificar los 5 nodos.
- [x] **G2.** Probar cada CRUD end-to-end (crear/leer/editar/borrar lógico). *(cubierto por `tests/e2e/api.sh`)*
- [ ] **G3.** Probar una venta completa y confirmar que el stock baja atómicamente. *(pendiente Bloque C)*
- [ ] **G4.** Probar `/debug/simular-fallo` y confirmar que el stock NO cambia (rollback). *(pendiente Bloque D)*
- [x] **G5.** Probar login/roles (admin/vendedor/bodeguero). *(cubierto por `tests/e2e/api.sh`)*
- [x] **G6.** Actualizar `README.md` con instrucciones de ejecución y pruebas.
- [ ] **G7.** Ensayar la defensa: explicar arquitectura distribuida + por qué CP.

> **Infraestructura de pruebas (nueva):** `bash tests/run.sh` corre todo de una.
> - `tests/unit/` — modulares de PHP puro (mapeo de nodos + `Validador`), se
>   ejecutan en el contenedor (`./tests` montado en `/var/www/tests`).
> - `tests/e2e/api.sh` — end-to-end con `curl` (auth, CRUD, 400/401/403/409,
>   semáforo de stock). Se ampliará con ventas/CAP al cerrar los Bloques C/D.

---

## Sugerencia de reparto para 3 personas

> Es solo una propuesta de balance de carga; ajústenla como prefieran.
> **El Bloque A debe hacerse primero entre todos o por una persona rápido**,
> porque los demás bloques dependen de él.

- **Persona 1 — "Backend / Datos" (CRUD):**
  Bloque A (fundamentos) + Bloque B (todos los CRUD) + parte del Bloque G.
- **Persona 2 — "Distribuido / ACID-CAP" ⭐ (lo más valorado):**
  Bloque C (transacciones ACID) + Bloque D (CAP: simulación + documento) +
  Bloque E (auth).
- **Persona 3 — "Frontend / Demo":**
  Bloque F (todo el frontend, incluido el SimuladorCAP) + liderar Bloque G
  (testing end-to-end y ensayo de la defensa).

### Dependencias importantes
- B, C, D, E **dependen de A** (conexión + router). Hacer A primero.
- F **depende de** que existan los endpoints (B, C, D, E) para consumir.
  Mientras tanto, Persona 3 puede adelantar setup, layout y páginas con datos mock.
- D2 (documento CAP) puede escribirse en paralelo; D1 (simulación) necesita C1.

### Riesgos / lo que más peso tiene en la nota
1. **ACID distribuido (Bloque C)** — si la venta no es atómica o permite
   sobreventa, cae el criterio más importante.
2. **Simulación CAP (Bloque D)** — el profesor evalúa que el sistema reaccione
   **exactamente** como dice el documento ante una partición.
3. **Que compile y corra en la demo (Bloque G)** — "no se presentan o no
   ejecuta" es la nota más baja de la rúbrica.
