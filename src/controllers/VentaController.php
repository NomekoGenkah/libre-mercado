<?php
// ===========================================================================
//  Libre Mercado — VentaController (Etapa 6 / Bloque C1)  ⭐ NÚCLEO ACID
//  Procesa una venta como una TRANSACCIÓN DISTRIBUIDA entre dos nodos:
//    · CENTRAL   → cabecera de la venta (ventas) + líneas (detalle_ventas)
//    · SUCURSAL  → descuento de stock + movimiento tipo 'venta'
//
//  Patrón Two-Phase Commit (2PC) "casero" con el nodo CENTRAL como coordinador:
//    Fase 0 (preparación/validación): se valida TODO antes de abrir cualquier
//      transacción (cliente activo, productos activos, stock suficiente). Si
//      algo falla aquí, se responde sin haber tocado dato alguno.
//    Fase 1 (prepare): BEGIN en ambos nodos y se ejecutan TODAS las escrituras.
//      Cualquier fallo lanza excepción → ROLLBACK en los dos nodos.
//    Fase 2 (commit): COMMIT en la sucursal y luego en central. Si la sucursal
//      no puede confirmar, se hace ROLLBACK de central (sigue abierta).
//
//  Decisión CP: ante un nodo caído o cualquier error intermedio se hace
//  ROLLBACK total → el sistema prefiere quedar indisponible antes que sobrevender.
// ===========================================================================

class VentaController
{
    /** POST /ventas  — body: {id_cli, id_suc, items:[{id_prod, cantidad}, ...]}. */
    public function procesarVenta(array $params, array $body): void
    {
        // ------------------------------------------------------------------
        //  FASE 0 — Validación y preparación (sin transacciones todavía).
        //  Todos los errores de esta fase responden directo (Response::error
        //  hace exit). NUNCA se llama a Response::error con transacciones
        //  abiertas: dentro del 2PC sólo se lanzan excepciones.
        // ------------------------------------------------------------------
        $id_cli = Validador::entero($body['id_cli'] ?? null, 'id_cli', 1);
        $id_suc = Validador::entero($body['id_suc'] ?? null, 'id_suc', 1);

        if (empty($body['items']) || !is_array($body['items'])) {
            Response::error("La venta debe incluir al menos un ítem en 'items'.", 400);
        }

        // Agrupar cantidades por producto (evita dos líneas para el mismo prod).
        $cantidades = [];
        foreach ($body['items'] as $i => $item) {
            $id_prod  = Validador::entero($item['id_prod'] ?? null, "items[$i].id_prod", 1);
            $cantidad = Validador::entero($item['cantidad'] ?? null, "items[$i].cantidad", 1);
            $cantidades[$id_prod] = ($cantidades[$id_prod] ?? 0) + $cantidad;
        }

        // Conexiones: si la sucursal está caída -> 503 SIN abrir transacción.
        $central = Database::conectarCentral();
        $nodo = Database::getNodoPorSucursal($id_suc);   // 400 si id_suc inválido
        $suc  = Database::conectarSucursal($nodo);        // NodoException -> 503

        if (!ClienteController::obtenerActivo($central, $id_cli)) {
            Response::error("El cliente $id_cli no existe o está inactivo (nodo central).", 404);
        }

        // Validar producto activo (central) + stock suficiente (sucursal).
        $lineas = [];   // [id_prod => {cantidad, precio_unitario}]
        $total = 0.0;
        foreach ($cantidades as $id_prod => $cantidad) {
            $prod = ProductoController::obtenerActivo($central, $id_prod);
            if (!$prod) {
                Response::error("El producto $id_prod no existe o está inactivo (nodo central).", 404);
            }

            $st = $suc->prepare("SELECT cantidad FROM stock WHERE id_prod = ? AND id_suc = ?");
            $st->execute([$id_prod, $id_suc]);
            $disponible = $st->fetchColumn();
            if ($disponible === false) {
                Response::error("El producto $id_prod no tiene stock registrado en la sucursal $id_suc.", 404);
            }
            if ((int) $disponible < $cantidad) {
                // Stock insuficiente -> 409 SIN abrir transacción (regla CLAUDE.md).
                Response::error(
                    "Stock insuficiente para el producto $id_prod en la sucursal $id_suc.",
                    409,
                    ['id_prod' => $id_prod, 'solicitado' => $cantidad, 'disponible' => (int) $disponible]
                );
            }

            $precio = (float) $prod['precio'];
            $lineas[$id_prod] = ['cantidad' => $cantidad, 'precio_unitario' => $precio];
            $total += $precio * $cantidad;
        }

        // ------------------------------------------------------------------
        //  FASE 1 (prepare) + FASE 2 (commit) — el 2PC propiamente dicho.
        // ------------------------------------------------------------------
        try {
            $central->beginTransaction();   // BEGIN coordinador
            $suc->beginTransaction();        // BEGIN participante

            // --- Escrituras en CENTRAL: cabecera + líneas ---
            $insVenta = $central->prepare(
                "INSERT INTO ventas (id_cli, id_suc, total, estado)
                 VALUES (?, ?, ?, 'completada')"
            );
            $insVenta->execute([$id_cli, $id_suc, $total]);
            $id_venta = (int) $central->lastInsertId();

            $insDet = $central->prepare(
                "INSERT INTO detalle_ventas (id_venta, id_prod, cantidad, precio_unitario)
                 VALUES (?, ?, ?, ?)"
            );

            // --- Escrituras en SUCURSAL: descuento de stock + movimiento ---
            //  El WHERE ... AND cantidad >= ? hace el descuento ATÓMICO y evita
            //  sobreventa por concurrencia: si otra venta ya bajó el stock, el
            //  UPDATE afecta 0 filas y abortamos toda la transacción.
            $updStock = $suc->prepare(
                "UPDATE stock SET cantidad = cantidad - ?
                 WHERE id_prod = ? AND id_suc = ? AND cantidad >= ?"
            );
            $insMov = $suc->prepare(
                "INSERT INTO movimientos_stock (id_prod, id_suc, tipo, cantidad, motivo)
                 VALUES (?, ?, 'venta', ?, ?)"
            );

            foreach ($lineas as $id_prod => $l) {
                $insDet->execute([$id_venta, $id_prod, $l['cantidad'], $l['precio_unitario']]);

                $updStock->execute([$l['cantidad'], $id_prod, $id_suc, $l['cantidad']]);
                if ($updStock->rowCount() !== 1) {
                    // Verificación del paso 6: el UPDATE debía afectar 1 fila.
                    throw new RuntimeException(
                        "Stock insuficiente o concurrente para el producto $id_prod (venta abortada).",
                        409
                    );
                }
                $insMov->execute([$id_prod, $id_suc, $l['cantidad'], "Venta #$id_venta"]);
            }

            // --- FASE 2: commit. Participante primero, luego coordinador. ---
            $suc->commit();
            try {
                $central->commit();
            } catch (Throwable $e) {
                // Caso crítico de 2PC: la sucursal confirmó pero central no.
                // Se registra fuerte para reconciliación manual (situación rara).
                error_log("[Venta 2PC] INCONSISTENCIA: sucursal '$nodo' confirmada pero CENTRAL falló el commit. " . $e->getMessage());
                throw $e;
            }

            Response::exito([
                'id_venta' => $id_venta,
                'id_cli'   => $id_cli,
                'id_suc'   => $id_suc,
                'nodo'     => $nodo,
                'total'    => $total,
                'estado'   => 'completada',
                'items'    => array_map(
                    fn($id, $l) => [
                        'id_prod'         => $id,
                        'cantidad'        => $l['cantidad'],
                        'precio_unitario' => $l['precio_unitario'],
                        'subtotal'        => $l['precio_unitario'] * $l['cantidad'],
                    ],
                    array_keys($lineas),
                    array_values($lineas)
                ),
            ], 201);

        } catch (Throwable $e) {
            // ROLLBACK en AMBOS nodos (lo que siga abierto).
            if ($suc->inTransaction()) {
                $suc->rollBack();
            }
            if ($central->inTransaction()) {
                $central->rollBack();
            }
            error_log("[VentaController::procesarVenta] ROLLBACK total (nodo '$nodo'): " . $e->getMessage());

            if ($e instanceof NodoException) {
                Response::error("Nodo '{$e->getNodo()}' no disponible: venta revertida.", 503, ['nodo' => $e->getNodo()]);
            }
            $codigo = in_array((int) $e->getCode(), [400, 404, 409], true) ? (int) $e->getCode() : 500;
            Response::error('La venta no se completó y fue revertida: ' . $e->getMessage(), $codigo);
        }
    }

    /** GET /ventas  — listado de cabeceras (filtros opcionales ?id_suc, ?id_cli). */
    public function listar(array $params, array $body): void
    {
        $central = Database::conectarCentral();
        $sql = "SELECT v.id_venta, v.id_cli, c.nombre AS cliente, v.id_suc,
                       v.fecha, v.total, v.estado
                FROM ventas v
                LEFT JOIN clientes c ON c.id_cli = v.id_cli";
        $where = [];
        $valores = [];
        if (!empty($_GET['id_suc'])) {
            $where[] = 'v.id_suc = ?';
            $valores[] = Validador::entero($_GET['id_suc'], 'id_suc', 1);
        }
        if (!empty($_GET['id_cli'])) {
            $where[] = 'v.id_cli = ?';
            $valores[] = Validador::entero($_GET['id_cli'], 'id_cli', 1);
        }
        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY v.fecha DESC, v.id_venta DESC LIMIT 200';

        $stmt = $central->prepare($sql);
        $stmt->execute($valores);
        Response::exito($stmt->fetchAll());
    }

    /** GET /ventas/:id  — cabecera + líneas con nombre de producto. */
    public function obtener(array $params, array $body): void
    {
        $id = Validador::entero($params['id'] ?? null, 'id', 1);
        $central = Database::conectarCentral();

        $stmt = $central->prepare(
            "SELECT v.id_venta, v.id_cli, c.nombre AS cliente, v.id_suc,
                    v.fecha, v.total, v.estado
             FROM ventas v
             LEFT JOIN clientes c ON c.id_cli = v.id_cli
             WHERE v.id_venta = ?"
        );
        $stmt->execute([$id]);
        $venta = $stmt->fetch();
        if (!$venta) {
            Response::error("Venta $id no encontrada (nodo central).", 404);
        }

        // detalle_ventas y productos viven en el mismo nodo central -> JOIN directo.
        $det = $central->prepare(
            "SELECT d.id_prod, p.producto, d.cantidad, d.precio_unitario,
                    (d.cantidad * d.precio_unitario) AS subtotal
             FROM detalle_ventas d
             LEFT JOIN productos p ON p.id_prod = d.id_prod
             WHERE d.id_venta = ?
             ORDER BY d.id_detalle"
        );
        $det->execute([$id]);

        $venta['items'] = $det->fetchAll();
        Response::exito($venta);
    }
}
