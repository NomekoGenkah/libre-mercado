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

            // --- CENTRAL: cabecera de la venta vía PROCEDIMIENTO ALMACENADO ---
            //  sp_registrar_venta corre DENTRO de esta transacción y devuelve el
            //  id generado. La transacción distribuida se apoya en SPs en ambos
            //  nodos (Tercera Evaluación, Requisito 2 y 3).
            $resVenta = Database::llamarProc(
                $central,
                "CALL sp_registrar_venta(?, ?, ?)",
                [$id_cli, $id_suc, $total]
            );
            $id_venta = (int) ($resVenta['id_venta'] ?? 0);
            if ($id_venta <= 0) {
                throw new RuntimeException('No se pudo registrar la cabecera de la venta (central).');
            }

            // --- Por línea: detalle (central) + descuento de stock (sucursal) ---
            //  sp_realizar_compra hace el descuento ATÓMICO y anti-sobreventa; si
            //  el stock no alcanza o cambió por concurrencia, lanza SIGNAL y toda
            //  la transacción distribuida se revierte.
            foreach ($lineas as $id_prod => $l) {
                Database::llamarProc(
                    $central,
                    "CALL sp_agregar_detalle_venta(?, ?, ?, ?)",
                    [$id_venta, $id_prod, $l['cantidad'], $l['precio_unitario']]
                );
                Database::llamarProc(
                    $suc,
                    "CALL sp_realizar_compra(?, ?, ?, ?)",
                    [$id_prod, $id_suc, $l['cantidad'], "Venta #$id_venta"]
                );
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
            // Errores lanzados por SIGNAL en sp_realizar_compra (stock insuficiente
            // o concurrencia): MYSQL_ERRNO 1643/1644 -> 409.
            $mysqlErrno = ($e instanceof PDOException) ? (int) ($e->errorInfo[1] ?? 0) : 0;
            if (in_array($mysqlErrno, [1643, 1644], true)) {
                Response::error(
                    'La venta no se completó (stock insuficiente) y fue revertida.',
                    409,
                    ['motivo' => $e->errorInfo[2] ?? null]
                );
            }
            $codigo = in_array((int) $e->getCode(), [400, 404, 409], true) ? (int) $e->getCode() : 500;
            Response::error('La venta no se completó y fue revertida: ' . $e->getMessage(), $codigo);
        }
    }

    /** GET /ventas  — listado de cabeceras (filtros opcionales ?id_suc, ?id_cli). */
    public function listar(array $params, array $body): void
    {
        $central = Database::conectarCentral();
        $sql = "SELECT * FROM v_ventas";
        $where = [];
        $valores = [];
        if (!empty($_GET['id_suc'])) {
            $where[] = 'id_suc = ?';
            $valores[] = Validador::entero($_GET['id_suc'], 'id_suc', 1);
        }
        if (!empty($_GET['id_cli'])) {
            $where[] = 'id_cli = ?';
            $valores[] = Validador::entero($_GET['id_cli'], 'id_cli', 1);
        }
        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY fecha DESC, id_venta DESC LIMIT 200';

        $stmt = $central->prepare($sql);
        $stmt->execute($valores);
        Response::exito($stmt->fetchAll());
    }

    /** GET /ventas/:id  — cabecera + líneas con nombre de producto. */
    public function obtener(array $params, array $body): void
    {
        $id = Validador::entero($params['id'] ?? null, 'id', 1);
        $central = Database::conectarCentral();

        $stmt = $central->prepare("SELECT * FROM v_ventas WHERE id_venta = ?");
        $stmt->execute([$id]);
        $venta = $stmt->fetch();
        if (!$venta) {
            Response::error("Venta $id no encontrada (nodo central).", 404);
        }

        // Líneas con nombre de producto y subtotal: resueltos por la vista.
        $det = $central->prepare(
            "SELECT id_prod, producto, cantidad, precio_unitario, subtotal
             FROM v_ventas_detalle
             WHERE id_venta = ?
             ORDER BY id_detalle"
        );
        $det->execute([$id]);

        $venta['items'] = $det->fetchAll();
        Response::exito($venta);
    }
}
