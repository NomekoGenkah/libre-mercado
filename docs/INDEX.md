# Libre Mercado — Índice del repositorio

> Listado completo de archivos del proyecto, agrupados por directorio,
> con una breve descripción de cada uno.

---

## Raíz

| Archivo | Descripción |
|---|---|
| `docker-compose.yml` | Orquestación de 6 servicios Docker: 4 nodos MariaDB + app PHP + Prometheus. Red `red_distribuida` bridge, healthchecks, volúmenes persistentes, socket Docker montado para chaos real. |
| `Dockerfile` | Imagen PHP 8.2 + Apache con pdo_mysql, cliente Docker, mod_rewrite, AllowOverride All. |
| `.env` | Variables de entorno con credenciales reales (ignorado por git). |
| `.env.example` | Template del `.env` con valores de ejemplo. Documenta todas las variables requeridas. |
| `.gitignore` | Ignora `.env`, `node_modules/`, etc. |
| `prometheus.yml` | Config de Prometheus: scrapea `GET /metrics` de `app_php:80` cada 5 s. |
| `README.md` | Documentación principal del proyecto: arquitectura, puesta en marcha, tests, estructura. |
| `PENDIENTES.md` | Estado histórico de tareas pendientes (2ª y 3ª evaluación), reparto sugerido para 3 personas. |
| `Segunda_Evaluacion_SD_2026.md` | Enunciado original de la 2ª evaluación: objetivos, requisitos CRUD/ACID/CAP, rúbrica. |
| `Tercera_Evaluacion_SD_2026.md` | Enunciado original de la 3ª evaluación: transacciones distribuidas, SP, falla de nodos, CAP, PHP+AJAX. |

---

## `docs/`

| Archivo | Descripción |
|---|---|
| `PRESENTACION_BASE.md` | **Documento base para presentación.** Cubre stack, arquitectura, modelo de datos, backend, 2PC, SPs, CAP, frontend, pruebas y guion de defensa. |
| `INDEX.md` | **Este archivo.** Índice completo del repositorio. |
| `arquitectura_CAP.md` | Justificación de la elección CP: teorema CAP en e-commerce, comportamiento ante partición, evidencia en código, trade-off. |
| `tercera_evaluacion.md` | Documento técnico de la 3ª evaluación: arquitectura LAN, procedimientos almacenados, manejo de fallos/recuperación, pruebas. |
| `guion_demo.md` | Guion minuto a minuto para la defensa (~10 min). Incluye setup distribuido (Tailscale + socat), checklist pre-demo, preguntas probables, comandos de rescate. |

---

## `sql/` — Scripts de inicialización de bases de datos

Cada nodo tiene su propia carpeta con 3 scripts que se ejecutan en orden alfabético por `docker-entrypoint-initdb.d`.

### `sql/central/` — Nodo central (catálogo, clientes, usuarios, ventas)

| Archivo | Descripción |
|---|---|
| `01_schema.sql` | Schema del nodo central: `categorias`, `productos`, `clientes`, `roles`, `usuarios`, `proveedores`, `ventas`, `detalle_ventas`. Todo InnoDB, borrado lógico con `activo`, FKs, índices. |
| `02_seed.sql` | Datos de demo: categorías, productos (10), clientes (3), roles (admin/vendedor/bodeguero), usuarios con bcrypt, proveedores (3), ventas históricas (5) con detalle. |
| `03_objetos.sql` | Vistas (`v_catalogo`, `v_ventas`, `v_ventas_detalle`, `v_ranking_productos` con `RANK() OVER`), tabla `estado_nodos`, SPs `sp_registrar_venta` y `sp_agregar_detalle_venta`. |

### `sql/norte/`, `sql/sur/`, `sql/este/` — Nodos de sucursal (idénticos)

| Archivo | Descripción |
|---|---|
| `01_schema.sql` | Schema de sucursal: `sucursales`, `stock` (UNIQUE por prod+suc), `movimientos_stock`, `compras`, `detalle_compras`, `carrito`, `detalle_carrito`. Columnas cross-node sin FK pero con índice. |
| `02_seed.sql` | Sucursal con su id único, stock inicial para 10 productos (cantidades variables para demo), stock mínimo bajo para activar alertas. |
| `03_objetos.sql` | Vista `v_stock` con semáforo (rojo/amarillo/verde), tabla `stock_auditoria`, trigger `trg_stock_auditoria`, SPs: `sp_actualizar_stock` (ajuste), `sp_reponer_stock` (UPSERT), `sp_realizar_compra` (anti-sobreventa con `SIGNAL`), `sp_reconstruir_stock` (recuperación desde ledger). |

---

## `src/` — Código PHP (montado en `app_php:/var/www/html`)

### Raíz de `src/`

| Archivo | Descripción |
|---|---|
| `index.php` | Front controller único: autoloader por carpetas, CORS, sesión PHP, manejador global de excepciones (NodoException→503, InvalidArgument→400), parseo de body JSON, despacho al Router. |
| `router.php` | Clase `Router` con parámetros `:id`, middleware por ruta, handlers tipo Closure o `Clase@metodo`. Tabla de rutas completa (~50 rutas) con healthcheck público, auth, roles y rutas admin. |
| `.htaccess` | Reescribe todo a `index.php` (front controller) excepto archivos/directorios reales. |

### `src/config/`

| Archivo | Descripción |
|---|---|
| `Config.php` | Lee variables de entorno con prefijos por nodo (`CENTRAL_`, `NORTE_`, `SUR_`, `ESTE_`). Puerto por nodo con fallback a `DB_PORT`. CORS, lista de nodos. |
| `Database.php` | Capa de conexión PDO: singleton por nodo y request, `conectarCentral()`, `conectarSucursal(nodo)`, `getNodoPorSucursal(id_suc)` (mapeo 1→norte, 2→sur, 3→este), `llamarProc()` para CALL con drenado de rowsets. Estado de nodos (OFFLINE/ONLINE desde `estado_nodos` central), `marcarEstadoNodo()`, `pingNodo()`, `olvidarCaches()`. |
| `NodoException.php` | Excepción con propiedad `nodo` y HTTP 503. Distingue "nodo caído" de errores de aplicación (clave para comportamiento CP). |

### `src/helpers/`

| Archivo | Descripción |
|---|---|
| `Response.php` | Helper de respuestas JSON: `json()`, `exito(data, código)`, `error(mensaje, código, detalle)`. Formato `{ok, data}` / `{ok, error}`. Todos terminan con `exit`. |
| `Auth.php` | Autenticación con sesiones PHP: `iniciarSesion()` con regeneración de session_id, `cerrarSesion()`, `usuarioActual()`, `requerirLogin()` (→401), `requerirRol(...)` (→403, admin siempre pasa). |
| `Validador.php` | Validación de input: `entero()`, `enteroOpc()`, `decimal()`, `texto()`, `email()`, `enLista()`, `esDuplicado()`. Todos responden 400 con `exit` si fallan. |

### `src/middleware/`

| Archivo | Descripción |
|---|---|
| `AuthMiddleware.php` | Aplica guards de `auth` o `roles` según las opciones declaradas en cada ruta del router. |

### `src/controllers/` — 16 controllers

| Archivo | Descripción |
|---|---|
| `AuthController.php` | `POST /auth/login` (verifica bcrypt, mensaje genérico 401), `POST /auth/logout`, `GET /auth/me`. |
| `CatalogoController.php` | `GET /catalogo` y `GET /catalogo/:id` — vitrina pública. Productos activos + disponibilidad agregada de sucursales. Tolerante a nodos caídos (degrada en vez de 503). |
| `ProductoController.php` | CRUD de productos sobre nodo central. Borrado lógico (`activo=0`). `GET /categorias` para el formulario. Helper estático `obtenerActivo()` y `mapaPorIds()` para otros controllers. |
| `ClienteController.php` | CRUD de clientes sobre central. Email único (→409). Helper `obtenerActivo()`. |
| `UsuarioController.php` | CRUD de usuarios sobre central (solo admin). Nunca expone `password_hash`. Contraseñas con bcrypt. |
| `ProveedorController.php` | CRUD de proveedores sobre central. Helper `obtenerActivo()`. |
| `SucursalController.php` | `GET /sucursales` (todas con resolución cross-node), `GET /sucursales/:id/stock`. |
| `StockController.php` | `GET /stock/:id_suc` (vista `v_stock` con semáforo + enriquecimiento desde central), `PUT /stock/:id_suc/:id_prod` (ajuste vía `sp_actualizar_stock`), `GET /movimientos/:id_suc` (historial con nombre de producto). |
| `CarritoController.php` | CRUD de carrito por cliente. Soporta crear, agregar/quitar items, listar multi-nodo con resiliencia a caídas. |
| `VentaController.php` | **⭐ Núcleo ACID distribuido.** `POST /ventas` con Two-Phase Commit (Fase 0: validación sin transacción; Fase 1: BEGIN + SPs en central y sucursal; Fase 2: COMMIT). Rollback en ambos nodos si falla. Soporta SPs (`sp_registrar_venta`, `sp_agregar_detalle_venta`, `sp_realizar_compra`). |
| `CompraController.php` | `POST /compras` — reabastecimiento (transacción LOCAL en sucursal). Valida proveedor/productos en central. Usa `sp_reponer_stock`. `GET /compras` multi-nodo. |
| `NodoAdminController.php` | Estado de la red: `GET /nodos` (flag + reachability), `GET /nodos/stream` (SSE cada 2 s), `POST /nodos/:nodo/estado` (simular falla OFFLINE/ONLINE), `POST /nodos/:nodo/recuperar` (reactiva + `sp_reconstruir_stock` con informe antes/después/delta). |
| `DebugController.php` | **⭐ Simulador CAP.** `POST /debug/simular-fallo`: reproduce venta, lanza excepción ANTES del COMMIT, hace rollback, devuelve timeline + stock antes/durante/después + veredicto. |
| `ChaosController.php` | `POST /nodos/:nodo/chaos` — falla REAL con Docker (stop/start del contenedor). Usa socket Docker montado. |
| `ReporteController.php` | `GET /reportes/ranking` — ranking de productos desde `v_ranking_productos` (filtro `?limit=`). |
| `MetricsController.php` | `GET /metrics` — exposición Prometheus (text/plain). Métricas: alcanzabilidad por nodo, flag OFFLINE, ventas totales, ingresos, productos activos. |

---

## `src/ui/` — Frontend PHP + AJAX

### Raíz de `src/ui/`

| Archivo | Descripción |
|---|---|
| `.htaccess` | DirectoryIndex `index.php` (las páginas PHP+AJAX se sirven como archivos reales, no pasan por el front controller de la API). |
| `_layout.php` | Layout principal: función `ui_head()` (sidebar con navegación agrupada + topbar), `ui_foot()`, `ui_head_publico()` (vitrina sin sidebar), `ui_foot_publico()`, logo SVG. |
| `index.php` | Redirige a `tienda.php` (puerta de entrada pública). |
| `tienda.php` | **Vitrina pública.** Catálogo con slider de destacados, búsqueda por texto, filtros por categoría, tarjetas de producto con disponibilidad e imágenes. Sin sesión. |
| `producto.php` | **Ficha de producto público.** Galería de imágenes con thumbs, precio, descripción, disponibilidad agregada. Sin sesión. |
| `login.php` | Formulario de login con credenciales pre-rellenadas (admin/admin123). Redirige a `dashboard.php`. Si ya hay sesión, salta directo al panel. |
| `dashboard.php` | **Panel de operaciones.** KPIs (productos, clientes, ventas, ingresos), topología de red EN VIVO (SSE), ranking de productos. |
| `ventas.php` | **Ventas.** Modal "Nueva venta" con selector de cliente/sucursal/productos+stock, líneas ajustables, confirmación vía 2PC. Historial con detalle. Mensajes de error 409/503. |
| `compras.php` | **Compras.** Modal "Nueva compra" con proveedor/sucursal/productos. Historial multi-nodo. |
| `stock.php` | **Stock por sucursal.** Tabs para cambiar sucursal, tabla con semáforo (rojo/amarillo/verde), movimientos recientes, botón "Ajustar" que abre modal con `sp_actualizar_stock`. |
| `productos.php` | CRUD de productos (tabla + modal crear/editar, borrado lógico). |
| `clientes.php` | CRUD de clientes. |
| `proveedores.php` | CRUD de proveedores. |
| `usuarios.php` | CRUD de usuarios (solo admin). |
| `nodos.php` | **Nodos de la red.** Topología en vivo (SSE), cards por sucursal con "Simular falla"/"Reactivar", "Recuperar" (con informe de `sp_reconstruir_stock`), "Apagar/Encender contenedor" (chaos real Docker). |
| `simulador.php` | **⭐ Simulador CAP.** Selector de sucursal/cliente/producto/cantidad. Ejecuta `/debug/simular-fallo` y muestra veredicto, timeline paso a paso, tabla stock antes/durante/después, explicación CP. |

### `src/ui/assets/`

| Archivo | Descripción |
|---|---|
| `app.js` | **Motor del frontend.** Función `pedir()` (fetch con credentials), objeto `api` (get/post/put/del), helpers (`money`, `num`, `folio`, `fechaHora`, `esc`), toasts, modal, `guard()` (valida sesión + oculta elementos por rol), `page()`/`pagePublica()`, `streamNodos()` (SSE con fallback a polling), galería de imágenes con multi-extension. |
| `styles.css` | Hoja de estilos completa: variables CSS, layout (sidebar + main), tipografía (IBM Plex Mono + Public Sans), paneles, tablas, formularios, botones, toasts, modal, topología, slider, galería, login, responsive. |
| `productos/` | Imágenes de productos (formato `{id}.{jpg|webp|png}` y `{id}_{N}.{jpg|webp|png}` para galería). El motor `app.js` prueba múltiples extensiones si no encuentra la primera. |
| `productos/README.md` | Notas sobre las imágenes de productos. |

---

## `tests/` — Pruebas automatizadas

| Archivo | Descripción |
|---|---|
| `run.sh` | **Suite unificada.** Corre unit (en contenedor) + e2e (curl). Resumen verde/rojo al final. |
| `lib/harness.php` | Helpers de aserción: `it()`, `assertSame()`, `assertLanza()`, `assertContiene()`, `resumenUnit()`. Framework mínimo sin dependencias. |
| `unit/run.php` | **22 tests modulares** (PHP puro, sin BD). Prueba mapeo `id_suc↔nodo` y validación de input (entero, decimal, texto, email, enLista, duplicados). Usa subprocesos para probar los casos que hacen `exit`. |
| `e2e/api.sh` | **52 tests end-to-end** (curl contra la API real). Cubre: salud, login/roles/logout, CRUD (200/201/400/404/409), venta 2PC (stock atómico), sobreventa (409 sin alterar stock), reabastecimiento, ajuste vía SP, ranking, simulación CAP, falla simulada (OFFLINE→503), recuperación (`sp_reconstruir_stock`), guards de rol (403). |

---

## Imágenes de productos (`src/ui/assets/productos/`)

| Archivo | Descripción |
|---|---|
| `1.jpg` | Laptop |
| `2.webp` | Smartphone |
| `3.png` | Auriculares Bluetooth |
| `4.jpg`, `4_1.jpg`, `4_2.jpeg` | Cargador Solar + vistas adicionales (galería) |
| `5.jpg` | Cámara |
| `7.jpg`, `7_1.jpg` | Teclado mecánico + vista adicional |
| `8.jpg` | Monitor |
| `9.webp` | Disco SSD |
| `10.webp` | Impresora |
| `README.md` | Notas sobre las imágenes (formato, nombrado). |
