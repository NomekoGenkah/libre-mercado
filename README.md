# Libre Mercado

Prototipo de sistema de **comercio electrónico distribuido** desarrollado para
la segunda evaluación del curso de Sistemas Distribuidos (prof. Juan Torres O.).

Simula un entorno de alta disponibilidad con múltiples nodos de base de datos
distribuidos, backend en **PHP puro + PDO** y frontend en **React + Vite +
Tailwind**. La arquitectura es **CP** (Consistencia + Tolerancia a Particiones):
ante la caída de un nodo de sucursal, las ventas hacen rollback antes que
permitir sobreventa.

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
| `app_php` | Apache + PHP 8.2 — API REST | `8080` |

El frontend React corre fuera de Docker en `localhost:5173` (Vite).

## Estado del proyecto

- ✅ **Etapa 1** — Infraestructura Docker
- ✅ **Etapa 2** — Schemas SQL + datos de demo (seed)
- ✅ **Etapa 3** — Capa de conexión PHP (PDO por nodo)
- ✅ **Etapa 4** — Router y estructura base (front controller)
- ✅ **Etapa 5** — Controllers CRUD (productos, clientes, usuarios,
  proveedores, sucursales, stock, carrito)
- ✅ **Etapa 6** — Transacciones ACID: venta distribuida (Two-Phase Commit) y
  reabastecimiento (transacción local)
- ✅ **Etapa 8** — Autenticación con sesiones PHP + roles
- ⬜ Etapas 7, 9, 10 (simulación CAP, frontend, documento CAP)

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
│   ├── index.php          # front controller (CORS, sesión, ruteo)
│   ├── router.php         # tabla de rutas → controllers
│   ├── config/            # Config, Database (PDO por nodo), NodoException
│   ├── helpers/           # Response, Auth, Validador
│   ├── middleware/        # AuthMiddleware (guards de sesión/rol)
│   └── controllers/       # Auth, Producto, Cliente, Usuario, Proveedor,
│                          #   Sucursal, Stock, Carrito
├── tests/                 # pruebas (montado en app_php:/var/www/tests)
│   ├── run.sh             # un comando: unit + e2e
│   ├── unit/  lib/        # pruebas modulares (PHP puro)
│   └── e2e/api.sh         # pruebas end-to-end (curl)
├── sql/                   # scripts de init por nodo (Etapa 2)
│   ├── central/  norte/  sur/  este/
├── docs/                  # documento de arquitectura CAP (Etapa 10)
└── CLAUDE.md              # arquitectura, plan de etapas y convenciones
```

## Decisión CAP: CP

En e-commerce la **sobreventa es inaceptable**. Si un nodo de sucursal no
responde durante una venta, la transacción distribuida completa hace rollback:
el sistema queda temporalmente indisponible para esa sucursal, pero el
inventario nunca queda inconsistente. La disponibilidad se sacrifica de forma
deliberada. La justificación detallada y la evidencia en código se entregan en
`docs/arquitectura_CAP.md` (Etapa 10).
