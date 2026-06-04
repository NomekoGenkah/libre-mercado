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
- ⬜ Etapas 3–11 (conexión PHP, router, CRUD, transacciones ACID,
  simulación CAP, auth, frontend, documento CAP, testing)

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

El paso 5 debe devolver un JSON con `"status": "ok"` y los hosts de cada nodo.

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
│   └── index.php          # placeholder de salud (router real en Etapa 4)
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
