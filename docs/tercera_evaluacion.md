# Tercera Evaluación — Documento técnico

> **Libre Mercado Distribuido: compras, fallos de nodos y consistencia en una
> arquitectura LAN.** Este documento cubre los entregables de la Tercera
> Evaluación: arquitectura, modelo distribuido, procedimientos almacenados,
> manejo de fallos/recuperación, decisión CAP y conclusiones. Complementa a
> [`arquitectura_CAP.md`](./arquitectura_CAP.md) (justificación CAP de la 2ª ev.).

---

## 1. Arquitectura distribuida en red LAN

El sistema corre como **5 procesos independientes** en la red Docker
`red_distribuida` (driver *bridge*), que actúa como **LAN** entre los nodos:

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

- Cada **sucursal es un nodo independiente** con su propia base de datos local.
- El **nodo central** actúa como coordinador de datos globales (catálogo,
  clientes, ventas) y de la transacción distribuida (2PC).
- La app PHP resuelve a qué nodo conectarse (`Database::getNodoPorSucursal()`).

**LAN real de demostración.** El nodo Este puede ejecutarse en **otra máquina
física** de la red y alcanzarse por **Tailscale** (VPN L3 tipo LAN): el
`ESTE_HOST`/`ESTE_PORT` apuntan a un *forward* hacia el host remoto, sin cambiar
una línea de código. Así se evidencia una topología distribuida entre equipos,
no solo contenedores en un host.

---

## 2. Modelo distribuido y flujo de compra

La **compra del cliente** (venta) es la operación distribuida central. Recorre:

1. **Seleccionar producto** → catálogo (`GET /catalogo`, `GET /productos`).
2. **Consultar disponibilidad** → stock de la sucursal (`GET /stock/:id_suc`).
3. **Crear/armar el pedido** → líneas en la UI.
4. **Ejecutar la compra** → `POST /ventas` (2PC).
5. **Actualizar stock** → `sp_realizar_compra` en la sucursal.
6. **Registrar venta** → `sp_registrar_venta` + `sp_agregar_detalle_venta` en central.

La venta escribe en **dos nodos a la vez** (central + sucursal), por eso exige
una transacción distribuida.

---

## 3. Transacciones distribuidas con procedimientos almacenados

La venta usa **Two-Phase Commit (2PC)** coordinado por PHP
(`VentaController::procesarVenta`), pero **cada leg se ejecuta con
procedimientos almacenados**:

| Nodo | Procedimiento | Rol en la transacción |
|---|---|---|
| Central | `sp_registrar_venta(id_cli, id_suc, total)` | Inserta la cabecera y devuelve `id_venta`. |
| Central | `sp_agregar_detalle_venta(id_venta, id_prod, cant, precio)` | Inserta cada línea. |
| Sucursal | `sp_realizar_compra(id_prod, id_suc, cant, motivo)` | **Valida stock, descuenta atómico anti-sobreventa y registra el movimiento**. |

Secuencia (coordinador = central):

```
FASE 0  Validación previa (cliente/producto/stock) — sin abrir transacción.
FASE 1  BEGIN central + BEGIN sucursal
        CALL sp_registrar_venta         (central)
        por línea:
          CALL sp_agregar_detalle_venta (central)
          CALL sp_realizar_compra       (sucursal)  ← SIGNAL si no hay stock
FASE 2  COMMIT sucursal → COMMIT central
```

Si **cualquier** `CALL` falla (nodo caído, `SIGNAL` de stock insuficiente,
concurrencia), se hace **`ROLLBACK` en ambos nodos** y se responde con el código
adecuado (503 / 409 / 500). Los procedimientos de venta **no abren su propia
transacción**: corren dentro del `BEGIN` que abre PHP, de modo que participan del
2PC. Garantías ACID: atomicidad (todo o nada en dos nodos), consistencia (stock
nunca negativo), aislamiento (`SELECT … FOR UPDATE` + `UPDATE … cantidad >= N`),
durabilidad (InnoDB tras el commit).

### Procedimientos almacenados del sistema

| Procedimiento | Nodo | Función |
|---|---|---|
| `sp_realizar_compra` | sucursal | Leg de sucursal de la venta: valida y descuenta stock (anti-sobreventa). |
| `sp_registrar_venta` / `sp_agregar_detalle_venta` | central | Leg central: cabecera + líneas de la venta. |
| `sp_actualizar_stock` | sucursal | Ajuste absoluto de existencia + movimiento `ajuste` (transacción local). |
| `sp_reponer_stock` | sucursal | Reabastecimiento (compra a proveedor): upsert de stock + movimiento. |
| `sp_reconstruir_stock` | sucursal | **Recuperación**: reconstruye el stock desde el libro de movimientos. |

Además hay una **VISTA** con función de ventana (`v_ranking_productos`,
`RANK() OVER`) y un **TRIGGER** de auditoría (`trg_stock_auditoria`).

---

## 4. Manejo de fallos y recuperación

### 4.1 Simular falla (nodo OFFLINE)

El estado de cada nodo se persiste en la tabla `estado_nodos` del central.
Marcar una sucursal `offline` (`POST /nodos/:nodo/estado {"estado":"offline"}`)
hace que `Database::conectarSucursal()` lance **`NodoException` (HTTP 503)** ante
cualquier operación hacia ese nodo — **igual que si el contenedor estuviera
caído**, pero sin apagar Docker. Es la opción *"Simular falla"* del enunciado.

- **Compra normal** → venta exitosa (201).
- **Nodo apagado** → `POST /ventas` a esa sucursal responde **503 controlado**;
  el stock no se toca (la validación previa falla antes de escribir).
- **Pérdida de conexión** → mismo comportamiento **CP** (ver §5).

`GET /nodos` distingue el **flag** (`estado`, falla simulada) de la
**reachability real** (`alcanzable`, ping al contenedor).

### 4.2 Recuperación y sincronización

`POST /nodos/:nodo/recuperar` reactiva el nodo (`online`) y ejecuta
`sp_reconstruir_stock(id_suc)`. La reconstrucción se apoya en un **invariante**:

```
stock.cantidad  ==  Σ(reabastecimiento, ajuste, devolución)  −  Σ(venta)
```

Toda operación de negocio (venta, compra, ajuste) registra su movimiento en
`movimientos_stock`, y las operaciones fallidas hacen rollback (no dejan
movimiento). Por lo tanto el **libro de movimientos es la fuente de verdad** y
permite recomputar el stock consistente tras una falla, reparando cualquier
desincronización. El endpoint devuelve un informe `antes / reconstruido / Δ` por
producto → *"Recuperación nodo: datos sincronizados"*.

---

## 5. Aplicación del Teorema CAP: **CP**

Ante una partición (nodo caído o marcado OFFLINE), el sistema prioriza
**Consistencia + Tolerancia a particiones (CP)**: **no vende** si no puede
confirmar el stock. Se sacrifica la **Disponibilidad** (la venta responde 503 y
debe reintentarse) a cambio de que **nunca haya sobreventa**. La justificación
completa está en [`arquitectura_CAP.md`](./arquitectura_CAP.md). La demostración
en vivo del rollback distribuido está en `POST /debug/simular-fallo` (pantalla
*Simulador CAP* de la consola).

> En un e-commerce la sobreventa es inaceptable (pedidos incumplibles,
> reembolsos). Entre "responder siempre" y "nunca vender de más", el negocio
> exige lo segundo → **CP**.

---

## 6. Pruebas obligatorias (cubiertas por `tests/e2e/api.sh`)

| Prueba | Resultado esperado | Estado |
|---|---|---|
| Compra normal | Venta exitosa (201), stock baja atómico | ✅ |
| Nodo apagado | Error controlado (503), stock intacto | ✅ |
| Recuperación nodo | Datos sincronizados (`sp_reconstruir_stock`) | ✅ |
| Compra simultánea | No duplicar stock (`UPDATE … cantidad >= N` + `SIGNAL`) | ✅ |
| Pérdida de conexión | Aplica CAP (CP): rollback total | ✅ |

Ejecutar: `bash tests/run.sh` (unit + e2e, requiere el stack levantado).

---

## 7. Backend y Frontend con PHP + AJAX

- **Backend:** PHP 8.2 puro + PDO, API REST modular con controllers, sesiones y
  roles. Procedimientos almacenados para las transacciones y la recuperación.
- **Frontend:** **consola PHP + AJAX** en `src/ui/` (servida por el mismo
  `app_php`, mismo origen `:8080`). Las páginas son PHP renderizado en el
  servidor; **toda la data se pide por AJAX** (`fetch`, `credentials:'include'`)
  contra la API JSON. Sin frameworks ni Node/npm. Tiene **dos mundos**:
  - **Vitrina pública** (`tienda.php`, `producto.php`) — el catálogo del
    comprador **sin sesión**, que consume el endpoint público `GET /catalogo`.
    Es la puerta de entrada (`/ui/`); ningún detalle de la infraestructura
    distribuida asoma aquí.
  - **Consola interna** (con login + roles) — panel, ventas, compras, stock,
    CRUD (productos/clientes/proveedores/usuarios), **nodos** (simular falla +
    recuperar) y **simulador CAP**. Se entra por **"Ingresar"**.

---

## 8. Conclusiones

- La arquitectura demuestra un **sistema distribuido real**: datos fragmentados
  por nodo, coordinación por 2PC y una LAN (Docker/Tailscale) entre procesos.
- Las **transacciones distribuidas con procedimientos almacenados** encapsulan
  la lógica crítica (descuento anti-sobreventa) en la base de datos y mantienen
  la atomicidad entre dos nodos.
- El **manejo de fallos** es explícito y demostrable: falla simulada (OFFLINE),
  respuesta CP (503) y **recuperación reconstruyendo el estado desde el ledger**.
- La decisión **CP** es coherente con el dominio (inventario/dinero): preferimos
  indisponibilidad temporal antes que datos inconsistentes.
- El stack **compila y corre** de punta a punta (`docker compose up` + consola
  PHP+AJAX + pruebas automatizadas), listo para la defensa.
