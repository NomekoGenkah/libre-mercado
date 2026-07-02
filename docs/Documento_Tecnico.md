# Documento Técnico — Libre Mercado Distribuido

> Sistema de comercio electrónico distribuido para la asignatura **Sistemas Distribuidos (2026)**.
> Arquitectura **CP** (Consistencia + Tolerancia a Particiones) con 4 nodos MariaDB independientes,
> Two-Phase Commit en PHP puro, procedimientos almacenados y consola PHP + AJAX.

---

## 1. Arquitectura

El sistema se despliega como **5 procesos independientes** en una red Docker bridge (`red_distribuida`) que actúa como **LAN** entre los nodos:

```
Cliente Web (navegador)
        │  HTTP + AJAX (fetch)
        ▼
   app_php  (Apache + PHP 8.2)   ← Nodo COORDINADOR de la lógica
        │
        ├──────────────┬──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
   nodo_central   sucursal_norte  sucursal_sur   sucursal_este
   (MariaDB)        (MariaDB)       (MariaDB)      (MariaDB)
   catálogo,        stock,          stock,         stock,
   clientes,        movimientos,    movimientos,   movimientos,
   usuarios,        compras,        compras,       compras,
   ventas           carrito         carrito        carrito
```

| Contenedor | Rol | Puerto host | Datos |
|---|---|---|---|
| `nodo_central` | Coordinador de transacciones y datos globales | `3306` | Catálogo (`productos`, `categorias`), `clientes`, `usuarios`, `proveedores`, `ventas`, `detalle_ventas`, `estado_nodos` |
| `nodo_sucursal_norte` | Sucursal Norte (id_suc=1) | `3307` | `stock`, `movimientos_stock`, `compras`, `detalle_compras`, `carrito`, `detalle_carrito` |
| `nodo_sucursal_sur` | Sucursal Sur (id_suc=2) | `3308` | Ídem |
| `nodo_sucursal_este` | Sucursal Este (id_suc=3) | `3309` | Ídem (puede ejecutarse en servidor remoto vía Tailscale) |
| `app_php` | Apache + PHP 8.2 — API REST + consola PHP/AJAX | `8080` | Lógica de aplicación, frontend |

La aplicación `app_php` se conecta a los 4 nodos MariaDB mediante **PDO** con credenciales y hosts independientes por nodo, configurados mediante variables de entorno. Cada nodo puede tener su propio host, puerto, base de datos y credenciales. Para el nodo **Este remoto**, la conexión utiliza un `socat` que hace forwarding: `app_php → host.docker.internal:33060 → socat (host) → servidor remoto:3306`, demostrando una topología distribuida entre equipos reales.

---

## 2. Modelo Distribuido

### Fragmentación (sharding) por nodo

Los datos están **fragmentados funcionalmente**: el nodo central almacena los datos globales del catálogo, clientes y ventas; cada sucursal almacena su propio inventario, movimientos, compras y carrito. No existe una base de datos única.

**Nodo Central:**
- `categorias`, `productos` — catálogo con borrado lógico (`activo`)
- `clientes`, `usuarios` (con bcrypt y roles: admin, vendedor, bodeguero)
- `proveedores`
- `ventas`, `detalle_ventas` — registro centralizado de transacciones
- `estado_nodos` — tabla de estado para simulación de fallos

**Nodos Sucursal (Norte, Sur, Este — esquema idéntico):**
- `sucursales` — metadato de la sucursal
- `stock` — inventario local con UNIQUE por `(id_prod, id_suc)`
- `movimientos_stock` — libro de movimientos (fuente de verdad para recuperación)
- `compras`, `detalle_compras` — reabastecimiento local
- `carrito`, `detalle_carrito` — carritos de compra locales

Las columnas que referencian datos de otro nodo (ej. `id_prod` en stock, `id_prov` en compras) no tienen Foreign Keys entre nodos, pero sí índices locales. La integridad referencial cross-node se valida en la capa de aplicación PHP.

### Transacciones distribuidas (Two-Phase Commit)

La **venta** es la operación distribuida central: escribe en **dos nodos a la vez** (central + sucursal). Usa un patrón **Two-Phase Commit (2PC)** "casero" desde PHP:

```
FASE 0 — Validación previa (sin transacciones):
  ┌─ Validar cliente activo (central)
  └─ Por cada producto: validar activo (central) + stock suficiente (sucursal)
     Si stock < solicitado → HTTP 409 (sin abrir transacción)
     Si nodo caído → HTTP 503 (NodoException)

FASE 1 — Prepare:
  BEGIN TRANSACTION en central
  BEGIN TRANSACTION en sucursal
  ┌─ CENTRAL: CALL sp_registrar_venta(id_cli, id_suc, total) → devuelve id_venta
  ├─ Por cada línea:
  │   ├─ CENTRAL: CALL sp_agregar_detalle_venta(id_venta, id_prod, cant, precio)
  │   └─ SUCURSAL: CALL sp_realizar_compra(id_prod, id_suc, cant, motivo)
  │       └─ SELECT ... FOR UPDATE + UPDATE cantidad >= N + INSERT movimiento
  │       └─ Si ROW_COUNT() ≠ 1 → SIGNAL SQLSTATE '45000' (sobreventa evitada)

FASE 2 — Commit:
  ┌─ COMMIT sucursal (participante primero)
  └─ COMMIT central (coordinador al final)

  Si cualquier paso falla:
    ROLLBACK en ambos nodos
    Error mapping: NodoException → 503, SIGNAL → 409, otros → 500
```

El **reabastecimiento** (compra a proveedor) es una transacción **local** en la sucursal, pues `compras`, `stock` y `movimientos_stock` viven en el mismo nodo. El central solo se usa para validar referencias cross-node.

### Procedimientos almacenados

| Procedimiento | Nodo | Función |
|---|---|---|
| `sp_realizar_compra` | sucursal | Leg de sucursal de la venta: valida y descuenta stock (anti-sobreventa). Usa `SELECT ... FOR UPDATE` y `UPDATE ... cantidad >= N` con `SIGNAL` si no hay stock. |
| `sp_registrar_venta` | central | Inserta cabecera de venta y devuelve `id_venta`. |
| `sp_agregar_detalle_venta` | central | Inserta cada línea de detalle. |
| `sp_actualizar_stock` | sucursal | Ajuste absoluto de existencia con movimiento `ajuste` (transacción local). |
| `sp_reponer_stock` | sucursal | UPSERT de stock para reabastecimiento + movimiento. |
| `sp_reconstruir_stock` | sucursal | Recuperación: reconstruye el stock desde el libro de movimientos. |

Además hay vistas con funciones de ventana (`v_ranking_productos` con `RANK() OVER`) y un trigger de auditoría (`trg_stock_auditoria`).

---

## 3. CAP Elegido: **CP** (Consistencia + Tolerancia a Particiones)

### Justificación

En un sistema de comercio electrónico, la **sobreventa es inaceptable**: vender una unidad de stock que ya no existe genera pedidos incumplibles, reembolsos y pérdida de confianza. Entre "responder siempre" (AP) y "nunca vender de más" (CP), el negocio exige lo segundo.

La tolerancia a particiones (**P**) no es opcional: en un sistema con varios nodos en red, las caídas y cortes de comunicación van a ocurrir. Por lo tanto la decisión real es **C vs A** cuando hay partición.

### Comportamiento ante una partición

Si durante una venta un nodo de sucursal no responde (partición):
1. La conexión PDO falla → se lanza `NodoException` (HTTP 503).
2. La transacción completa se revierte (**rollback** en ambos nodos).
3. La venta **no se concreta** — el sistema queda temporalmente indisponible para esa operación.
4. El inventario **siempre** se mantiene correcto. Nunca se sobrevende.

### Trade-off asumido

| Se gana (CP) | Se sacrifica |
|---|---|
| Inventario siempre consistente | La venta no se completa si un nodo cae |
| Cero sobreventa (incluso con concurrencia) | Disponibilidad parcial durante la partición |
| Datos atómicos (sin estados a medias) | El usuario debe reintentar más tarde |

### Evidencia en el código

- **`VentaController::procesarVenta()`** — transacción distribuida 2PC con `UPDATE ... AND cantidad >= N` y `rowCount()`, y `catch` que hace `rollBack()` en ambos nodos.
- **`DebugController::simularFallo()`** — reproduce la venta y lanza excepción **después** del UPDATE de stock y **antes** del COMMIT, luego hace rollback. Devuelve stock antes/durante/después y `consistencia_preservada: true`.
- **`Database::conectarSucursal()`** — verifica si el nodo está marcado OFFLINE y lanza `NodoException` (HTTP 503) antes de cualquier operación.
- **`NodoException`** — distingue "nodo caído" de errores de aplicación, clave para la respuesta CP.

### Endpoint de demostración

```bash
curl -b cookies.txt -X POST http://localhost:8080/debug/simular-fallo \
  -H 'Content-Type: application/json' -d '{"id_suc":1,"items":[{"id_prod":1,"cantidad":2}]}'
```

Respuesta: `consistencia_preservada: true`, stock después del rollback igual al stock antes.

---

## 4. Manejo de Fallos

### 4.1 Falla simulada (nodo OFFLINE)

El estado de cada nodo se persiste en la tabla `estado_nodos` del nodo central. Marcar una sucursal `offline` (`POST /nodos/:nodo/estado {"estado":"offline"}`) hace que `Database::conectarSucursal()` lance `NodoException` (HTTP 503) ante cualquier operación hacia ese nodo, **igual que si el contenedor estuviera caído**, pero sin apagar Docker.

- **Compra normal** → venta exitosa (201).
- **Nodo apagado** → `POST /ventas` a esa sucursal responde **503 controlado**; el stock no se toca (la validación previa falla antes de escribir).
- **Pérdida de conexión** → mismo comportamiento CP: rollback total.

`GET /nodos` distingue el **flag** (`estado`, falla simulada) de la **reachability real** (`alcanzable`, ping al contenedor).

### 4.2 Falla real (Docker)

El `ChaosController` usa el socket Docker montado en `app_php` para **apagar o encender contenedores de sucursal reales** (`docker stop` / `docker start`), provocando una falla genuina de nodo. La respuesta es la misma: `NodoException` → 503 → rollback.

### 4.3 Recuperación

`POST /nodos/:nodo/recuperar` reactiva el nodo (`online`) y ejecuta `sp_reconstruir_stock(id_suc)`. La reconstrucción se basa en el **invariante**:

```
stock.cantidad = Σ(reabastecimiento, ajuste, devolución) − Σ(venta)
```

Toda operación de negocio registra su movimiento en `movimientos_stock`, y las operaciones fallidas hacen rollback (no dejan movimiento). Por lo tanto el **libro de movimientos es la fuente de verdad** y permite recomputar el stock consistente tras una falla. El endpoint devuelve un informe `antes / reconstruido / Δ` por producto.

### 4.4 Partición real (demostración en defensa)

En la demo, la sucursal **Este** corre en un servidor remoto vía Tailscale. Se demuestra:
1. `docker stop nodo_sucursal_este` en el servidor remoto → partición real.
2. Intento de venta → **503** (rollback total, sin venta huérfana).
3. Verificación en BD central: `SELECT id_venta FROM ventas ORDER BY id_venta DESC LIMIT 1` → misma venta de antes, **no se insertó ninguna venta huérfana**.
4. Venta a sucursal Norte (local, sana) → **funciona**. El sistema sigue operando en las sucursales sanas.
5. `docker start nodo_sucursal_este` → nodo verde otra vez; stock intacto.

### 4.5 Atomicidad en la transacción distribuida

La garantía ACID se implementa mediante:
- **Atomicidad**: `BEGIN` en ambos nodos; si algo falla → `ROLLBACK` en ambos. Todo o nada.
- **Consistencia**: `UPDATE ... AND cantidad >= N` impide stock negativo. `SIGNAL` en `sp_realizar_compra` si no hay stock suficiente.
- **Aislamiento**: `SELECT ... FOR UPDATE` bloquea la fila de stock; `UPDATE ... cantidad >= N` con verificación de `rowCount()` evita condiciones de carrera.
- **Durabilidad**: InnoDB tras el `COMMIT`.

---

## 5. Conclusiones

La implementación de **Libre Mercado** demuestra un sistema distribuido real que cumple con los objetivos planteados en las evaluaciones:

1. **Arquitectura distribuida funcional**: 4 nodos MariaDB independientes (uno en servidor remoto) coordinados por una capa de aplicación PHP, comunicados en una LAN Docker/Tailscale. Los datos están fragmentados por dominio (central vs. sucursales) y la aplicación resuelve la topología mediante mapeo `id_suc → nodo`.

2. **Transacciones distribuidas con procedimientos almacenados**: la venta utiliza un patrón Two-Phase Commit donde cada leg se ejecuta mediante procedimientos almacenados (`sp_registrar_venta`, `sp_agregar_detalle_venta`, `sp_realizar_compra`). Esto encapsula la lógica crítica en la base de datos y mantiene la atomicidad entre dos nodos. El descuento anti-sobreventa con `SELECT ... FOR UPDATE` y `SIGNAL` garantiza consistencia incluso bajo concurrencia.

3. **Decisión CP coherente con el dominio**: ante una partición de red, el sistema prioriza la consistencia sobre la disponibilidad. Una venta que no puede confirmar stock se revierte completamente (rollback en ambos nodos) antes que arriesgar una sobreventa. En inventario y dinero, la consistencia es obligatoria.

4. **Manejo de fallos completo y demostrable**:
   - **Falla simulada**: marcar nodo OFFLINE desde la UI → 503 controlado sin apagar Docker.
   - **Falla real**: apagar/encender contenedores Docker mediante el socket montado.
   - **Recuperación**: `sp_reconstruir_stock` reconstruye el estado desde el libro de movimientos (fuente de verdad), con informe antes/reconstruido/delta.
   - **Simulador CAP**: reproducción controlada del fallo en el punto exacto del flujo, demostrando el rollback y la preservación de consistencia.

5. **Stack completo y listo para defensa**: PHP 8.2 + PDO + MariaDB 10.6 + Docker. Backend modular con 16 controllers, frontend PHP + AJAX sin frameworks (vitrina pública + consola interna), y suite de pruebas automatizadas (22 unit + 52 e2e). Todo se levanta con un solo comando: `docker compose up -d`.
