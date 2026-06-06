# Arquitectura distribuida y decisión CAP — Libre Mercado

> Documento de arquitectura para la segunda evaluación de Sistemas Distribuidos.
> Resume el sistema, justifica la elección **CP** del teorema CAP y señala la
> evidencia en el código.

## 1. Descripción del sistema

**Libre Mercado** es un prototipo de e-commerce **distribuido**: los datos no
viven en una sola base de datos, sino repartidos en **cuatro nodos MariaDB**
independientes, coordinados por una capa de aplicación en PHP.

| Nodo | Contenedor | Datos que almacena |
|---|---|---|
| Central | `nodo_central` | Catálogo (`productos`, `categorias`), `clientes`, `usuarios`, `proveedores`, y las **ventas** (`ventas`, `detalle_ventas`) |
| Sucursal Norte (id_suc 1) | `nodo_sucursal_norte` | `stock`, `movimientos_stock`, `compras`, `carrito` locales |
| Sucursal Sur (id_suc 2) | `nodo_sucursal_sur` | ídem, datos de la sucursal Sur |
| Sucursal Este (id_suc 3) | `nodo_sucursal_este` | ídem, datos de la sucursal Este |

La aplicación (`app_php`, Apache + PHP 8.2) expone una API REST y decide a qué
nodo conectarse: el catálogo y las ventas van al central; el inventario va al
nodo de la sucursal correspondiente (`Database::getNodoPorSucursal()`). Una
**venta** es por naturaleza una operación **distribuida**: registra la venta en
el central y descuenta el stock en la sucursal, es decir, escribe en **dos
nodos a la vez**.

## 2. El teorema CAP en un e-commerce

El teorema **CAP** (Brewer) dice que un sistema distribuido, **ante una
partición de red (P)**, solo puede garantizar **una** de estas dos
propiedades:

- **Consistencia (C):** todos los nodos ven los mismos datos; nunca se lee/
  escribe un estado inválido.
- **Disponibilidad (A):** toda petición recibe una respuesta exitosa, aunque
  algún nodo esté incomunicado.

La tolerancia a particiones (**P**) no es opcional: en un sistema con varios
nodos en red, las caídas y cortes de comunicación **van a ocurrir**. Por lo
tanto la decisión real es **C vs A** cuando hay partición.

## 3. Decisión de diseño: **CP** (Consistencia + Partición)

En un e-commerce, la **sobreventa es inaceptable**: vender una unidad de stock
que ya no existe genera pedidos incumplibles, reembolsos y pérdida de
confianza. Entre "responder siempre" y "nunca vender de más", el negocio exige
lo segundo.

Por eso Libre Mercado elige **CP**: si durante una venta un nodo de sucursal no
responde (partición), **la transacción completa se revierte (rollback)** y la
venta **no se concreta**. El sistema queda **temporalmente indisponible** para
esa operación —se sacrifica la **Disponibilidad** de forma deliberada— a cambio
de que el inventario **siempre** sea correcto. Nunca se sobrevende, nunca
quedan datos a medias.

> Si hubiéramos elegido **AP**, el sistema aceptaría la venta aunque no pueda
> confirmar el stock, y resolvería inconsistencias después (riesgo de
> sobreventa). Para inventario y dinero, eso no es aceptable.

## 4. Comportamiento ante una partición (transacción distribuida)

La venta usa un patrón **Two-Phase Commit (2PC)** con el nodo **central como
coordinador**:

1. **Fase 0 – Validación** (sin abrir transacción): se valida cliente,
   productos activos y **stock suficiente**. Si la sucursal no responde →
   **HTTP 503** sin haber tocado ningún dato. Si falta stock → **HTTP 409**.
2. **Fase 1 – Prepare:** `BEGIN` en central y en sucursal; se inserta la venta
   y su detalle (central) y se descuenta el stock + se registra el movimiento
   (sucursal). El descuento usa
   `UPDATE stock SET cantidad = cantidad - N WHERE ... AND cantidad >= N` y se
   verifica que afecte **exactamente 1 fila**: esto bloquea la sobreventa
   incluso con ventas concurrentes (aislamiento de InnoDB).
3. **Fase 2 – Commit:** `COMMIT` en sucursal y luego en central.

**Si cualquier paso falla** (nodo caído, error intermedio, stock que cambió por
concurrencia), se ejecuta **`ROLLBACK` en ambos nodos** y se responde con un
código de error (503 / 409 / 500). Garantías **ACID**: Atomicidad (todo o
nada en los dos nodos), Consistencia (stock nunca negativo), Aislamiento
(bloqueo de fila en el `UPDATE`), Durabilidad (InnoDB tras el `COMMIT`).

## 5. Trade-off asumido

| Se gana (CP) | Se sacrifica |
|---|---|
| Inventario siempre consistente | La venta no se completa si un nodo cae |
| Cero sobreventa, incluso con concurrencia | Disponibilidad parcial durante la partición |
| Datos atómicos (sin estados a medias) | El usuario debe reintentar más tarde |

Es el trade-off correcto para inventario y transacciones de dinero: preferimos
un "no se pudo, reintenta" antes que vender algo que no existe.

## 6. Evidencia en el código

- **`src/controllers/VentaController.php` → `procesarVenta()`**: la transacción
  distribuida 2PC. Ver la fase de validación previa, el `UPDATE ... AND
  cantidad >= N` con verificación de `rowCount()`, y el `catch` que hace
  `rollBack()` en **ambos** nodos mapeando el error a 503/409/500.
- **`src/controllers/DebugController.php` → `POST /debug/simular-fallo`**:
  reproduce la venta y lanza una **excepción controlada justo después del
  `UPDATE` de stock y antes del `COMMIT`**, luego hace rollback en ambos nodos.
  Devuelve un informe con el `timeline`, y el stock **antes / durante / después**:
  durante la transacción el stock aparece descontado, pero tras el rollback
  vuelve a su valor original y la venta no queda registrada
  (`consistencia_preservada: true`). Es la demostración en vivo del
  comportamiento CP.
- **`src/config/Database.php` → `NodoException` (HTTP 503)**: distingue "nodo
  caído" de un error de aplicación, habilitando la respuesta correcta ante
  partición.

### Cómo demostrarlo en la demo

```bash
# Login como admin (guarda la cookie de sesión)
curl -c cookies.txt -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}'

# Simular el fallo CAP: ver stock "durante" (descontado) vs "después" (revertido)
curl -b cookies.txt -X POST http://localhost:8080/debug/simular-fallo \
  -H 'Content-Type: application/json' -d '{"id_suc":1,"items":[{"id_prod":1,"cantidad":2}]}'
```

El JSON de respuesta muestra `stock.durante_transaccion` con el valor
descontado y `stock.despues_rollback` igual a `stock.antes` →
**no hubo sobreventa: CP en acción.**
