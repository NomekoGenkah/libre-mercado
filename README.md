# Libre Mercado

Prototipo de sistema de **comercio electrónico distribuido** para el curso de
Sistemas Distribuidos (prof. Juan Torres O.). Cubre la **2ª evaluación** (CRUD
distribuido, ACID, CAP, PHP/PDO) y la **3ª evaluación** (transacciones con
**procedimientos almacenados**, **simulación de caída de nodos + recuperación**
y consola **PHP + AJAX**).

Simula un entorno de alta disponibilidad con múltiples nodos de base de datos
distribuidos (LAN Docker) y backend en **PHP puro + PDO**. La arquitectura es
**CP** (Consistencia + Tolerancia a Particiones): ante la caída —real o
simulada— de un nodo de sucursal, las ventas hacen rollback antes que permitir
sobreventa. Hay **dos frontends**: la consola **PHP + AJAX** en `src/ui/`
(entregable de la 3ª ev.) y una consola **React + Vite** en `frontend/`.

> 📐 La arquitectura completa, el plan de etapas y las convenciones de código
> están documentados en [`CLAUDE.md`](./CLAUDE.md).

## Arquitectura (resumen)

Red Docker `red_distribuida` (bridge) con 5 contenedores:

| Contenedor | Rol | Puerto host |
|---|---|---|
| `nodo_central` | MariaDB 10.6 — tablas globales | `3306` |
| `nodo_sucursal_norte` | MariaDB 10.6 — sucursal Norte | `3307` |
| `nodo_sucursal_sur` | MariaDB 10.6 — sucursal Sur | `3308` |
| `nodo_sucursal_este` | MariaDB 10.6 — sucursal Este | `3309` |
| `app_php` | Apache + PHP 8.2 — API REST **+ consola PHP/AJAX (`/ui`)** | `8080` |

La consola **PHP + AJAX** se sirve desde el propio `app_php` en
`http://localhost:8080/ui/` (mismo origen que la API). El frontend **React**
opcional corre fuera de Docker en `localhost:5173` (Vite).

## Estado del proyecto

**2ª evaluación** — completa y verificada:

- ✅ Infraestructura Docker · Schemas SQL + seed · Capa PDO por nodo · Router
- ✅ CRUD de todas las entidades (borrado lógico)
- ✅ Transacciones ACID: venta distribuida 2PC + reabastecimiento local
- ✅ Simulación de fallo CAP (`/debug/simular-fallo`) + [documento CAP](./docs/arquitectura_CAP.md)
- ✅ Autenticación con sesiones PHP + roles · Frontend React ([`frontend/`](./frontend/README.md))

**3ª evaluación** — completa y verificada (ver [`docs/tercera_evaluacion.md`](./docs/tercera_evaluacion.md)):

- ✅ **Procedimientos almacenados** en la venta distribuida (`sp_registrar_venta`,
  `sp_realizar_compra`) y en el resto (`sp_actualizar_stock`, `sp_reponer_stock`,
  `sp_reconstruir_stock`)
- ✅ **Simulación de caída de nodos** (estado OFFLINE persistente) + **recuperación**
  (`POST /nodos/:nodo/recuperar` → `sp_reconstruir_stock`)
- ✅ **Consola PHP + AJAX** (`src/ui/`)
- ✅ Suite automatizada en verde: **22 unit + 52 e2e** (`bash tests/run.sh`)

### Credenciales de demo (seed)

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | admin |
| `vendedor` | `vendedor123` | vendedor |
| `bodeguero` | `bodeguero123` | bodeguero |

Ver el desglose completo en [`CLAUDE.md`](./CLAUDE.md).

## Requisitos

- Docker + Docker Compose v2
- (Para el frontend, más adelante) Node.js 18+

## Puesta en marcha (Etapa 1)

```bash
# 1. Copiar variables de entorno y ajustar credenciales si se desea
cp .env.example .env

# 2. Construir y levantar todos los contenedores
docker compose up -d --build

# 3. Verificar que todos los nodos estén "healthy"
docker compose ps

# 4. Verificar conectividad entre el nodo PHP y los nodos de BD
docker compose exec app_php ping nodo_central -c 2
docker compose exec app_php ping nodo_sucursal_norte -c 2
docker compose exec app_php ping nodo_sucursal_sur -c 2
docker compose exec app_php ping nodo_sucursal_este -c 2

# 5. Probar el endpoint de salud temporal (placeholder de la Etapa 1)
curl http://localhost:8080/
```

El paso 5 (`GET /`) devuelve un JSON con el estado de la API. Para verificar
además la conectividad a los 4 nodos de base de datos:

```bash
curl http://localhost:8080/salud     # { "ok": true, "data": { "nodos": {...} } }
```

### Iniciar sesión y consumir la API

Las rutas requieren sesión (cookie). Ejemplo con `curl` y un cookie jar:

```bash
# Login (guarda la cookie de sesión en cookies.txt)
curl -c cookies.txt -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'

# Usar la sesión en las siguientes peticiones
curl -b cookies.txt http://localhost:8080/productos
curl -b cookies.txt http://localhost:8080/stock/1
```

## Tercera Evaluación (SD 2026) — distribuido, fallos y PHP + AJAX

La Tercera evolución añade, sobre la base anterior:

- **Procedimientos almacenados** en la transacción distribuida y en la
  recuperación: `sp_realizar_compra` (descuento anti-sobreventa en sucursal),
  `sp_registrar_venta` / `sp_agregar_detalle_venta` (central), `sp_actualizar_stock`
  (ajuste), `sp_reponer_stock` (compra) y `sp_reconstruir_stock` (recuperación).
  Viven en `sql/*/03_objetos.sql`.
- **Simulación de caída de nodos**: marcar una sucursal `OFFLINE`
  (`POST /nodos/:nodo/estado`) hace que sus operaciones respondan **503
  controlado** (falla simulada, sin apagar Docker).
- **Recuperación**: `POST /nodos/:nodo/recuperar` reactiva el nodo y ejecuta
  `sp_reconstruir_stock`, reconstruyendo el stock desde el libro de movimientos.
- **Consola PHP + AJAX** servida por el propio `app_php` (mismo origen).

Documento técnico completo: [`docs/tercera_evaluacion.md`](./docs/tercera_evaluacion.md).

> ⚠️ Los procedimientos se cargan en el *initdb* de MariaDB (`03_objetos.sql`).
> Si actualizas desde una base ya creada, recrea los volúmenes para que se
> carguen: `docker compose down -v && docker compose up -d --build`.

### Consola PHP + AJAX

Abre **`http://localhost:8080/ui/`** en el navegador (login: `admin` /
`admin123`). Es un frontend en **PHP renderizado en el servidor** cuyas páginas
piden **toda la data por AJAX** (`fetch`) a la API JSON. Incluye panel, ventas,
compras, stock, CRUD, **Nodos** (simular falla + recuperar) y **Simulador CAP**.

> El frontend React de `frontend/` sigue disponible como alternativa; la consola
> **evaluada** en la Tercera es la de `src/ui/` (PHP + AJAX).

## Pruebas

La suite cubre dos niveles y se corre con **un solo comando** (requiere el
stack levantado):

```bash
bash tests/run.sh
```

- **Modulares (unit)** — `tests/unit/`: prueban lógica PHP pura (mapeo de
  `id_suc` a nodo y todas las reglas del `Validador`), sin tocar la base de
  datos. Se ejecutan con el `php` del contenedor `app_php` (la carpeta
  `./tests` se monta en `/var/www/tests`).
- **End-to-end (e2e)** — `tests/e2e/api.sh`: ejerce la API real con `curl`
  (salud, login/roles/logout, CRUD de productos y clientes, validación → 400,
  duplicados → 409, guards de auth → 401/403 y el semáforo de stock).

> Si añadiste el montaje de `./tests` por primera vez, recrea el contenedor
> para que lo tome: `docker compose up -d`.

También se pueden correr por separado:

```bash
docker compose exec -T app_php php /var/www/tests/unit/run.php   # solo unit
bash tests/e2e/api.sh                                            # solo e2e
```

### Comandos útiles

```bash
docker compose logs -f app_php        # logs de Apache/PHP
docker compose logs -f nodo_central   # logs de MariaDB central
docker compose down                   # detener contenedores
docker compose down -v                # detener y borrar volúmenes de datos
```

## Estructura del repositorio

```
.
├── docker-compose.yml     # 5 servicios en red_distribuida
├── Dockerfile             # imagen PHP 8.2 + Apache (pdo, pdo_mysql, mysqli)
├── .env / .env.example    # credenciales y hosts por nodo
├── src/                   # código PHP (montado en app_php:/var/www/html)
│   ├── index.php          # front controller de la API (CORS, sesión, ruteo)
│   ├── router.php         # tabla de rutas → controllers
│   ├── config/            # Config, Database (PDO + estado OFFLINE), NodoException
│   ├── helpers/           # Response, Auth, Validador
│   ├── middleware/        # AuthMiddleware (guards de sesión/rol)
│   ├── controllers/       # Auth, Producto, Cliente, Usuario, Proveedor, Sucursal,
│   │                      #   Stock, Carrito, Venta, Compra, Reporte, NodoAdmin, Debug
│   └── ui/                # consola PHP + AJAX (login, panel, nodos, simulador…)
│       └── assets/        #   app.js (motor fetch) + styles.css
├── tests/                 # pruebas (montado en app_php:/var/www/tests)
│   ├── run.sh             # un comando: unit + e2e
│   ├── unit/  lib/        # pruebas modulares (PHP puro)
│   └── e2e/api.sh         # pruebas end-to-end (curl)
├── sql/                   # scripts de init por nodo
│   ├── central/  norte/  sur/  este/
│   │   ├── 01_schema.sql  02_seed.sql
│   │   └── 03_objetos.sql # vistas, trigger y PROCEDIMIENTOS almacenados (3ª ev.)
├── docs/                  # arquitectura_CAP.md + tercera_evaluacion.md + guion_demo.md
└── CLAUDE.md              # arquitectura, plan de etapas y convenciones
```

## Decisión CAP: CP

En e-commerce la **sobreventa es inaceptable**. Si un nodo de sucursal no
responde durante una venta, la transacción distribuida completa hace rollback:
el sistema queda temporalmente indisponible para esa sucursal, pero el
inventario nunca queda inconsistente. La disponibilidad se sacrifica de forma
deliberada. La justificación detallada y la evidencia en código están en
[`docs/arquitectura_CAP.md`](./docs/arquitectura_CAP.md).

Se puede **ver en vivo** con el endpoint de simulación (requiere sesión admin):

```bash
curl -b cookies.txt -X POST http://localhost:8080/debug/simular-fallo \
  -H 'Content-Type: application/json' -d '{"id_suc":1,"items":[{"id_prod":1,"cantidad":2}]}'
```

Lanza una venta, falla a propósito **después** de descontar el stock y **antes**
del `COMMIT`, hace rollback en ambos nodos y responde con el stock
`antes/durante/después`: el stock vuelve a su valor original y la venta no se
registra (`consistencia_preservada: true`).
