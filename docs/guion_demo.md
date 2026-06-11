# Guion de defensa — Libre Mercado (~10 min)

> Demo distribuida: **central + Norte + Sur locales** (Docker en tu laptop) y
> **sucursal Este en el servidor privado**. La partición se demuestra cortando
> el nodo remoto. Evidencia mostrada en **UI + base de datos** (mysql CLI).
>
> Mensaje central a repetir: *"Elegimos **CP**: ante una partición, preferimos
> que la venta no se complete antes que sobrevender. Consistencia sobre
> disponibilidad."*

---

## A. Setup distribuido (cómo está montado / cómo reproducirlo)

Como los contenedores Docker **no ven la subred de Tailscale**, `app_php` se
conecta al **host** (`host.docker.internal:33060`) y un **`socat`** en la laptop
reenvía ese puerto al nodo Este remoto por Tailscale. Cadena completa:

```
app_php (contenedor) → host.docker.internal:33060 → socat (host WSL) → 100.73.123.84:3306 (servidor)
```

El `.env` ya está configurado: `ESTE_HOST=host.docker.internal`, `ESTE_PORT=33060`.
(`Config.php` admite puerto por nodo; si no, cae a `DB_PORT=3306`.)

### Datos de la red Tailscale (no perder)
| Dispositivo | Rol | IP Tailscale |
|---|---|---|
| `homeserver` | Servidor donde corre el **nodo Este** | **100.73.123.84** |
| `desktop-1sb4pja` | Laptop de la demo (backend + frontend + central/Norte/Sur + socat) | 100.67.120.22 |

### A.1 En el servidor (una sola vez — ya hecho)
```bash
# Desde la laptop: subir los scripts SQL de Este
scp -r sql/este genkah@100.73.123.84:~/lm_este_sql

# En el servidor: nodo Este, enlazado SOLO a la IP de Tailscale (no a internet)
docker run -d --name nodo_sucursal_este --restart unless-stopped \
  -e MARIADB_ROOT_PASSWORD=root_lm_2026 -e MARIADB_DATABASE=lm_este \
  -e MARIADB_USER=lm_user -e MARIADB_PASSWORD=lm_este_2026 \
  -p 100.73.123.84:3306:3306 \
  -v ~/lm_este_sql:/docker-entrypoint-initdb.d:ro \
  mariadb:10.6

sudo ufw allow in on tailscale0     # permitir tráfico por la interfaz Tailscale
```

### A.2 En la laptop (CADA VEZ que arrancas la máquina)
⚠️ El `socat` **muere al apagar/reiniciar la laptop** (o con `wsl --shutdown`).
Hay que relanzarlo antes de la demo:
```bash
# 1) Puente socat host -> Tailscale
nohup socat TCP-LISTEN:33060,fork,reuseaddr TCP:100.73.123.84:3306 >/tmp/socat-este.log 2>&1 &

# 2) Levantar el stack y verificar
docker compose up -d
curl http://localhost:8080/salud      # 'este' debe salir "ok"
```

### A.3 Plan B (100 % local, si el aula/servidor/Tailscale falla)
En `.env`: `ESTE_HOST=nodo_sucursal_este` y `ESTE_PORT=3306`; mata el socat
(`pkill socat`); `docker compose up -d`. El guion es **idéntico**; la partición
la haces con `docker stop nodo_sucursal_este` localmente.

---

## B. Checklist ~30 min antes de exponer

**Conectividad distribuida (lo que más se rompe):**
- [ ] Servidor vivo: SSH OK + `docker ps` muestra `nodo_sucursal_este` *Up* + `tailscale status` OK.
- [ ] La laptop ve el servidor: `ping 100.73.123.84 -c 2`.
- [ ] **`socat` corriendo** (muere al reiniciar la laptop): `pgrep -af socat`; si no aparece, relánzalo (A.2 paso 1).

**Stack y app:**
- [ ] `docker compose ps` → 5 contenedores `Up`/`healthy`.
- [ ] `curl http://localhost:8080/salud` → los 4 nodos en `ok` (incl. Este remoto). **Este es el semáforo maestro.**
- [ ] Frontend corriendo: `cd frontend && npm run dev` → `localhost:5173`.
- [ ] Navegador con sesión **admin** ya iniciada, en el **Dashboard**.

**Prueba en seco (segura, no ensucia datos):**
- [ ] Corre el **SimuladorCAP** una vez (no persiste nada) → confirma que responde.
- [ ] `docker stop nodo_sucursal_este` en el servidor → `curl /salud` debe dar Este `caído` → `docker start` → vuelve a `ok`. Así confirmas el corte ANTES de exponer.

**Terminales y material:**
- [ ] **T1 — Servidor (SSH)**: para `docker stop/start nodo_sucursal_este` y consultas a Este:
  `docker exec nodo_sucursal_este mariadb -ulm_user -plm_este_2026 lm_este -e "SELECT ..."`
- [ ] **T2 — BD Central (laptop)**: `docker compose exec nodo_central mariadb -ulm_user -plm_central_2026 lm_central`
- [ ] `docs/arquitectura_CAP.md` abierto en una pestaña.
- [ ] **Producto de prueba** con stock en Este anotado (ej. `id_prod=1`, `id_suc=3`) y su cantidad inicial.

---

## C. Guion minuto a minuto (~10 min)

### 1 · Arquitectura (≈1:30) — pantalla *Dashboard*
**Hacer:** mostrar el panel de nodos / topología (consume `/salud`).
**Decir:**
- "El sistema NO es una sola base de datos: son **4 MariaDB independientes**.
  El **central** guarda catálogo, clientes, usuarios y las **ventas**; cada
  **sucursal** (Norte, Sur, Este) guarda su **stock** local."
- "Para que sea distribuido de verdad, la sucursal **Este está físicamente en
  otro servidor** —ahí, en la nube/servidor privado—. La capa PHP decide a qué
  nodo conectarse según el `id_suc`."
- "Una **venta** escribe en **dos nodos a la vez**: la venta en el central y el
  descuento de stock en la sucursal. Eso es lo que hace interesante el problema
  ACID y CAP."

### 2 · CRUD + roles (≈1:30) — pantalla *Productos*
**Hacer:** crear un producto → aparece en la tabla. Luego **eliminarlo** y
mostrar que no se borra de verdad sino que queda inactivo (borrado lógico).
**Decir:**
- "CRUD completo sobre todas las entidades, solo con **prepared statements**
  (PDO) — sin concatenar SQL, no hay inyección."
- "Las bajas de productos/clientes/usuarios son **borrado lógico** (`activo=0`)
  para no romper integridad referencial con ventas históricas."
- "Hay **roles**: admin total, vendedor (ventas) y bodeguero (stock/compras).
  El backend rechaza con 401/403 según la sesión." *(opcional si hay tiempo:
  mostrar que vendedor no puede crear productos)*

### 3 · Venta normal = transacción distribuida (≈2:00) — *Stock* + *Ventas*
**Hacer:**
1. En *Stock* de la sucursal **Este**, anota la cantidad del producto elegido.
2. En *Ventas*, registra una venta de ese producto a la sucursal **Este**.
3. Vuelve a *Stock*: la cantidad **bajó**.
4. **Evidencia en BD** (las dos máquinas):
   - **T1 (Este, en el servidor):** `docker exec nodo_sucursal_este mariadb -ulm_user -plm_este_2026 lm_este -e "SELECT id_prod, cantidad FROM stock WHERE id_prod=1 AND id_suc=3;"` → bajó.
   - **T2 (Central, laptop):** `SELECT id_venta, id_suc, total, estado FROM ventas ORDER BY id_venta DESC LIMIT 1;` → la venta quedó registrada.

**Decir:**
- "Esto fue una transacción **distribuida**: la venta se escribió en el central
  (esta máquina) y el stock se descontó en Este (**el otro servidor**),
  **atómicamente**. Patrón **Two-Phase Commit** con el central como coordinador."
- "El descuento usa `UPDATE ... WHERE cantidad >= N` y verifica que afecte
  exactamente 1 fila → **imposible sobrevender**, incluso con ventas concurrentes."

### 4 · ⭐ Partición REAL (≈3:00) — el momento clave
**Hacer:**
1. **T1 (Servidor):** `docker stop nodo_sucursal_este` → "acabo de cortar la
   conexión con la sucursal Este: hay una **partición de red**."
2. En el navegador, refresca el **Dashboard**: Este aparece **caído**
   (el `/salud` ya no lo alcanza).
3. Intenta una **venta a Este** en la UI → sale un error/toast **503: "Nodo
   'este' no disponible: venta revertida."**
4. **Evidencia de que NO quedó basura** — **T2 (Central):**
   `SELECT id_venta FROM ventas ORDER BY id_venta DESC LIMIT 1;` → es la **misma**
   venta de antes; **no se insertó** ninguna venta huérfana. El central hizo rollback.
5. **Prueba de tolerancia a particiones:** registra una venta a **Norte**
   (nodo local, sano) → **funciona**. "El sistema sigue operando en las
   sucursales sanas; solo se sacrifica la rama particionada."
6. **T1:** `docker start nodo_sucursal_este`. Espera unos segundos, refresca el
   Dashboard → Este **verde** otra vez.
7. **T1 (Este, servidor):** `docker exec nodo_sucursal_este mariadb -ulm_user -plm_este_2026 lm_este -e "SELECT cantidad FROM stock WHERE id_prod=1 AND id_suc=3;"`
   → **igual que antes del intento fallido**. Cero sobreventa.

**Decir:**
- "Ante la partición, el sistema eligió **Consistencia sobre Disponibilidad**:
  prefirió **no completar la venta** (rollback total en los dos nodos) antes que
  arriesgar una sobreventa. Eso es **CP**."
- "Si fuéramos **AP**, habríamos aceptado la venta a ciegas y resuelto el
  descuadre después → riesgo de vender stock inexistente. Para inventario y
  dinero, inaceptable."

### 5 · Reproducción controlada (≈1:00) — pantalla *SimuladorCAP*
**Hacer:** ejecutar el simulador (`/debug/simular-fallo`) y mostrar el
**timeline** + tabla de stock **antes / durante / después**.
**Decir:**
- "Además del corte real, tenemos una reproducción automática y segura del
  fallo: lanza la excepción **justo después de descontar el stock y antes del
  COMMIT**. Verán que **durante** la transacción el stock aparece descontado,
  pero tras el **rollback** vuelve a su valor original."
- Señalar `consistencia_preservada: true` y `venta_persistida: false`.

### 6 · Cierre (≈1:00)
**Decir:**
- "Resumen: BD **distribuida** en 4 nodos (uno en otro servidor), **CRUD**
  completo con borrado lógico, ventas **ACID** con 2PC anti-sobreventa, y una
  decisión **CP** que demostramos ante una **partición real**."
- "El documento de arquitectura está en `docs/arquitectura_CAP.md`. ¿Preguntas?"

---

## D. Preguntas probables del profesor (ten la respuesta lista)

**"¿Esto es un Two-Phase Commit de verdad?"**
> Es 2PC con el central como coordinador: fase de preparación (BEGIN +
> escrituras en ambos nodos) y fase de commit. Es un 2PC *a nivel de
> aplicación*, no XA nativo. La ventana teórica es: si la sucursal confirma y
> luego falla el commit del central. La mitigamos confirmando el coordinador al
> final y dejándolo auditado en `error_log` para reconciliación; en producción
> se usaría `XA START/PREPARE/COMMIT`.

**"¿Cómo evitan la sobreventa con dos clientes comprando a la vez?"**
> El descuento es `UPDATE stock SET cantidad = cantidad - N WHERE ... AND
> cantidad >= N` y verificamos `rowCount() == 1`. InnoDB bloquea la fila; si el
> stock ya no alcanza, el UPDATE afecta 0 filas y abortamos toda la transacción.
> Es atómico a nivel de fila, no un read-then-write con condición de carrera.

**"¿Por qué CP y no AP?"**
> Porque el costo de una sobreventa (pedido incumplible, reembolso, pérdida de
> confianza) es mayor que el de pedir "reintenta en un momento". En inventario y
> dinero la consistencia manda.

**"¿Qué pasó exactamente cuando cayó el nodo?"**
> La conexión PDO al nodo Este falló → lanzamos `NodoException` (HTTP 503), se
> hizo `rollBack()` en el central, y no se escribió ninguna venta. Lo
> verificamos en la BD: no hay venta huérfana y el stock quedó intacto.

**"¿Cómo garantizan la atomicidad si un nodo se cae?" (respuesta corta de memoria)**
> "La venta abre transacción en los dos nodos a la vez. Si la sucursal no
> responde, saltamos al `catch` y hacemos `rollBack()` en ambos: el INSERT de la
> venta en central se deshace y el stock nunca se confirma. Es todo-o-nada a
> través de la red: o se escribe en los dos nodos, o en ninguno. Esa es nuestra
> elección CP — preferimos no vender antes que quedar inconsistentes."

**"¿La partición fue real o simulada?"**
> Real: detuvimos el contenedor MariaDB que corre en otro servidor. Además
> tenemos el simulador (`/debug/simular-fallo`) para reproducir el fallo en el
> punto exacto del flujo de forma controlada.

---

## E. Comandos de rescate (por si algo falla en vivo)

```bash
docker compose ps                          # ¿todo arriba?
docker compose up -d                        # relevantar lo que se cayó
curl http://localhost:8080/salud            # estado de los 4 nodos
docker compose logs -f app_php              # ver errores PHP en vivo

# Si 'este' sale caído: casi siempre es el socat. Revisar y relanzar:
pgrep -af socat || nohup socat TCP-LISTEN:33060,fork,reuseaddr TCP:100.73.123.84:3306 >/tmp/socat-este.log 2>&1 &

# Revertir a 100% local (plan B): en .env -> ESTE_HOST=nodo_sucursal_este, ESTE_PORT=3306
pkill socat ; docker compose up -d
```

> Regla de oro: si el servidor remoto o el socat dan problemas durante la demo,
> **cambia a plan B sin dramatizar** ("lo corremos en modo local") y haz la
> partición con `docker stop nodo_sucursal_este`. El profesor evalúa el
> **comportamiento CP**, no dónde vive físicamente el nodo.
