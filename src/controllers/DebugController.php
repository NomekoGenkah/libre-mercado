<?php
// ===========================================================================
//  Libre Mercado — DebugController (Etapa 7 / Bloque D1)  ⭐ CLAVE EN LA DEFENSA
//  POST /debug/simular-fallo
//
//  Reproduce EXACTAMENTE el flujo de una venta distribuida (VentaController),
//  pero lanza una excepción CONTROLADA en el peor momento posible: DESPUÉS de
//  haber descontado el stock en la sucursal y ANTES del COMMIT. Luego hace
//  ROLLBACK en ambos nodos y devuelve un informe paso a paso.
//
//  Objetivo pedagógico: demostrar el comportamiento CP. Durante la transacción
//  el stock SE VE descontado (cambio no confirmado), pero tras el rollback
//  vuelve a su valor original → NO hay sobreventa, la consistencia se preserva
//  y el sistema prefirió "fallar" (no completar la venta) antes que quedar
//  inconsistente. Disponibilidad sacrificada a propósito.
//
//  Es una simulación segura: NADA se persiste (todo se revierte).
// ===========================================================================

class DebugController
{
    /** POST /debug/simular-fallo — body opcional: {id_cli, id_suc, items}. */
    public function simularFallo(array $params, array $body): void
    {
        // Parámetros con valores por defecto (para poder dispararla sin body
        // en la demo). Se validan igual que en una venta real.
        $id_cli = Validador::entero($body['id_cli'] ?? 1, 'id_cli', 1);
        $id_suc = Validador::entero($body['id_suc'] ?? 1, 'id_suc', 1);
        $items  = (!empty($body['items']) && is_array($body['items']))
            ? $body['items']
            : [['id_prod' => 1, 'cantidad' => 1]];

        $cantidades = [];
        foreach ($items as $i => $item) {
            $id_prod  = Validador::entero($item['id_prod'] ?? null, "items[$i].id_prod", 1);
            $cantidad = Validador::entero($item['cantidad'] ?? null, "items[$i].cantidad", 1);
            $cantidades[$id_prod] = ($cantidades[$id_prod] ?? 0) + $cantidad;
        }

        $timeline = [];
        $paso = fn(string $accion, string $resultado) => $timeline[] = compact('accion', 'resultado');

        // --- Conexiones ---
        $central = Database::conectarCentral();
        $nodo = Database::getNodoPorSucursal($id_suc);
        $suc  = Database::conectarSucursal($nodo);
        $paso("1. Conectar a nodo central y a sucursal '$nodo'", 'ok');

        // --- Validaciones (cliente/productos/stock) ---
        if (!ClienteController::obtenerActivo($central, $id_cli)) {
            Response::error("El cliente $id_cli no existe o está inactivo.", 404);
        }
        $lineas = [];
        foreach ($cantidades as $id_prod => $cantidad) {
            $prod = ProductoController::obtenerActivo($central, $id_prod);
            if (!$prod) {
                Response::error("El producto $id_prod no existe o está inactivo.", 404);
            }
            $st = $suc->prepare("SELECT cantidad FROM stock WHERE id_prod = ? AND id_suc = ?");
            $st->execute([$id_prod, $id_suc]);
            $disp = $st->fetchColumn();
            if ($disp === false || (int) $disp < $cantidad) {
                Response::error("Stock insuficiente del producto $id_prod para la simulación.", 409);
            }
            $lineas[$id_prod] = ['cantidad' => $cantidad, 'precio_unitario' => (float) $prod['precio']];
        }
        $paso('2. Validar cliente, productos activos y stock suficiente', 'ok');

        $ids = array_keys($lineas);
        $stockAntes = $this->snapshot($suc, $id_suc, $ids);

        $stockDurante = [];
        $idVentaSimulada = null;
        $rollback = ['central' => 'no ejecutado', 'sucursal' => 'no ejecutado'];

        try {
            // ---------------- FASE 1: prepare (BEGIN + escrituras) ----------
            $central->beginTransaction();
            $suc->beginTransaction();
            $paso('3. BEGIN en central y en sucursal', 'ok');

            $insVenta = $central->prepare(
                "INSERT INTO ventas (id_cli, id_suc, total, estado) VALUES (?, ?, ?, 'completada')"
            );
            $total = 0.0;
            foreach ($lineas as $l) {
                $total += $l['precio_unitario'] * $l['cantidad'];
            }
            $insVenta->execute([$id_cli, $id_suc, $total]);
            $idVentaSimulada = (int) $central->lastInsertId();
            $paso("4. INSERT ventas (central) → id_venta=$idVentaSimulada (sin confirmar)", 'ok');

            $insDet = $central->prepare(
                "INSERT INTO detalle_ventas (id_venta, id_prod, cantidad, precio_unitario) VALUES (?, ?, ?, ?)"
            );
            foreach ($lineas as $id_prod => $l) {
                $insDet->execute([$idVentaSimulada, $id_prod, $l['cantidad'], $l['precio_unitario']]);
            }
            $paso('5. INSERT detalle_ventas (central, sin confirmar)', 'ok');

            $updStock = $suc->prepare(
                "UPDATE stock SET cantidad = cantidad - ? WHERE id_prod = ? AND id_suc = ? AND cantidad >= ?"
            );
            foreach ($lineas as $id_prod => $l) {
                $updStock->execute([$l['cantidad'], $id_prod, $id_suc, $l['cantidad']]);
            }
            $paso('6. UPDATE stock − N (sucursal, SIN confirmar)', 'ok');

            // El stock ya se ve descontado DENTRO de la transacción (misma
            // conexión ve su propio cambio no confirmado).
            $stockDurante = $this->snapshot($suc, $id_suc, $ids);
            $paso('7. Leer stock dentro de la transacción → aparece descontado', 'ok');

            // ---------------- PUNTO DE FALLO CONTROLADO --------------------
            // Simula la caída de un nodo / crash JUSTO antes del COMMIT.
            throw new RuntimeException('FALLO SIMULADO: caída del nodo antes del COMMIT.');

            // (inalcanzable) $suc->commit(); $central->commit();
        } catch (Throwable $e) {
            $paso('8. ⚠ Excepción controlada DESPUÉS del UPDATE y ANTES del COMMIT', $e->getMessage());

            if ($suc->inTransaction()) {
                $suc->rollBack();
                $rollback['sucursal'] = 'ejecutado';
            }
            if ($central->inTransaction()) {
                $central->rollBack();
                $rollback['central'] = 'ejecutado';
            }
            $paso('9. ROLLBACK en ambos nodos', 'ok');
        }

        // --- Verificación posterior al rollback ---
        $stockDespues = $this->snapshot($suc, $id_suc, $ids);

        // ¿La venta quedó realmente revertida en central?
        $chk = $central->prepare("SELECT 1 FROM ventas WHERE id_venta = ?");
        $chk->execute([$idVentaSimulada]);
        $ventaPersistida = (bool) $chk->fetchColumn();

        $consistente = ($stockAntes == $stockDespues) && !$ventaPersistida;

        Response::exito([
            'simulacion'  => 'Fallo distribuido durante una venta (comportamiento CP)',
            'parametros'  => ['id_cli' => $id_cli, 'id_suc' => $id_suc, 'nodo' => $nodo],
            'timeline'    => $timeline,
            'punto_de_fallo' => 'Excepción lanzada DESPUÉS del UPDATE de stock y ANTES del COMMIT.',
            'stock' => [
                'antes'               => $stockAntes,
                'durante_transaccion' => $stockDurante,   // descontado (no confirmado)
                'despues_rollback'    => $stockDespues,    // == antes
            ],
            'rollback'             => $rollback,
            'venta_persistida'     => $ventaPersistida,    // false: central también revirtió
            'consistencia_preservada' => $consistente,
            'explicacion_CP' =>
                'El sistema es CP (Consistencia + tolerancia a Particiones). Ante el fallo ' .
                'de un nodo durante la venta, la transacción se revierte por completo en ' .
                'ambos nodos: el stock vuelve a su valor original y la venta no se registra. ' .
                'Se sacrifica la Disponibilidad (la venta no se completa) para garantizar que ' .
                'NUNCA haya sobreventa ni datos inconsistentes.',
        ]);
    }

    /** Lee {id_prod, cantidad} de los productos indicados en una conexión dada. */
    private function snapshot(PDO $conn, int $id_suc, array $ids): array
    {
        if (!$ids) {
            return [];
        }
        $marcadores = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $conn->prepare(
            "SELECT id_prod, cantidad FROM stock WHERE id_suc = ? AND id_prod IN ($marcadores)
             ORDER BY id_prod"
        );
        $stmt->execute(array_merge([$id_suc], array_values($ids)));
        // Normaliza cantidad a int para comparar de forma estable.
        return array_map(
            fn($f) => ['id_prod' => (int) $f['id_prod'], 'cantidad' => (int) $f['cantidad']],
            $stmt->fetchAll()
        );
    }
}
