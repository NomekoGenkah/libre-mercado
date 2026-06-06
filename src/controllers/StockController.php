<?php
// ===========================================================================
//  Libre Mercado — StockController (Etapa 5 / Bloque B6)
//  Stock y movimientos viven en los nodos de SUCURSAL. Los nombres/precios de
//  producto viven en CENTRAL -> se resuelven cruzando ambos nodos en PHP.
//  El ajuste manual usa una transacción LOCAL (UPDATE stock + INSERT
//  movimiento tipo 'ajuste') para que ambos cambios sean atómicos.
// ===========================================================================

class StockController
{
    /** GET /stock/:id_suc  — stock de una sucursal con estado verde/amarillo/rojo. */
    public function porSucursal(array $params, array $body): void
    {
        $id_suc = Validador::entero($params['id_suc'] ?? null, 'id_suc', 1);
        Response::exito(self::obtenerStock($id_suc));
    }

    /** PUT /stock/:id_suc/:id_prod  — ajuste manual de cantidad (absoluta). */
    public function ajustar(array $params, array $body): void
    {
        $id_suc  = Validador::entero($params['id_suc'] ?? null, 'id_suc', 1);
        $id_prod = Validador::entero($params['id_prod'] ?? null, 'id_prod', 1);
        $nueva   = Validador::entero($body['cantidad'] ?? null, 'cantidad', 0);
        $motivo  = Validador::texto($body['motivo'] ?? null, 'motivo', 200, false)
            ?? 'Ajuste manual de inventario';

        // El producto debe existir y estar activo (catálogo en central).
        $central = Database::conectarCentral();
        if (!ProductoController::obtenerActivo($central, $id_prod)) {
            Response::error("El producto $id_prod no existe o está inactivo (nodo central).", 404);
        }

        $nodo = Database::getNodoPorSucursal($id_suc);
        $suc  = Database::conectarSucursal($nodo);

        $stmt = $suc->prepare("SELECT id_stock, cantidad FROM stock WHERE id_prod = ? AND id_suc = ?");
        $stmt->execute([$id_prod, $id_suc]);
        $fila = $stmt->fetch();
        if (!$fila) {
            Response::error("No hay registro de stock del producto $id_prod en la sucursal $id_suc (nodo $nodo).", 404);
        }

        $anterior = (int) $fila['cantidad'];
        $delta = $nueva - $anterior;

        try {
            $suc->beginTransaction();
            $suc->prepare("UPDATE stock SET cantidad = ? WHERE id_stock = ?")
                ->execute([$nueva, $fila['id_stock']]);
            $suc->prepare(
                "INSERT INTO movimientos_stock (id_prod, id_suc, tipo, cantidad, motivo)
                 VALUES (?, ?, 'ajuste', ?, ?)"
            )->execute([$id_prod, $id_suc, $delta, $motivo]);
            $suc->commit();
        } catch (Throwable $e) {
            if ($suc->inTransaction()) {
                $suc->rollBack();
            }
            error_log("[StockController::ajustar] Rollback en nodo '$nodo': " . $e->getMessage());
            throw $e;
        }

        Response::exito([
            'id_prod'          => $id_prod,
            'id_suc'           => $id_suc,
            'cantidad_anterior' => $anterior,
            'cantidad_nueva'    => $nueva,
            'delta'            => $delta,
            'motivo'           => $motivo,
        ]);
    }

    /** GET /movimientos/:id_suc  — historial de movimientos de la sucursal. */
    public function movimientos(array $params, array $body): void
    {
        $id_suc = Validador::entero($params['id_suc'] ?? null, 'id_suc', 1);
        $nodo = Database::getNodoPorSucursal($id_suc);
        $suc  = Database::conectarSucursal($nodo);

        $limite = (int) ($_GET['limit'] ?? 100);
        $limite = max(1, min($limite, 500)); // cota de seguridad

        $sql = "SELECT id_mov, id_prod, id_suc, tipo, cantidad, motivo, fecha
                FROM movimientos_stock WHERE id_suc = ?";
        $valores = [$id_suc];
        if (!empty($_GET['tipo'])) {
            $tipo = Validador::enLista($_GET['tipo'], 'tipo', ['venta', 'reabastecimiento', 'ajuste', 'devolucion']);
            $sql .= " AND tipo = ?";
            $valores[] = $tipo;
        }
        $sql .= " ORDER BY fecha DESC, id_mov DESC LIMIT $limite";

        $stmt = $suc->prepare($sql);
        $stmt->execute($valores);
        $movs = $stmt->fetchAll();

        // Enriquecer con nombre de producto (catálogo en central).
        $mapa = ProductoController::mapaPorIds(Database::conectarCentral(), array_column($movs, 'id_prod'));
        foreach ($movs as &$m) {
            $m['producto'] = $mapa[(int) $m['id_prod']]['producto'] ?? null;
        }
        unset($m);

        Response::exito($movs);
    }

    // -----------------------------------------------------------------------

    /**
     * Devuelve el stock enriquecido de una sucursal (helper compartido con
     * SucursalController). Cruza el nodo de sucursal con el catálogo central.
     */
    public static function obtenerStock(int $id_suc): array
    {
        $nodo = Database::getNodoPorSucursal($id_suc);
        $suc  = Database::conectarSucursal($nodo);

        $stmt = $suc->prepare(
            "SELECT id_stock, id_prod, id_suc, cantidad, cantidad_minima
             FROM stock WHERE id_suc = ? ORDER BY id_prod"
        );
        $stmt->execute([$id_suc]);
        $filas = $stmt->fetchAll();

        $mapa = ProductoController::mapaPorIds(Database::conectarCentral(), array_column($filas, 'id_prod'));

        foreach ($filas as &$f) {
            $cant = (int) $f['cantidad'];
            $min  = (int) $f['cantidad_minima'];
            $prod = $mapa[(int) $f['id_prod']] ?? null;
            $f['producto'] = $prod['producto'] ?? null;
            $f['precio']   = $prod['precio'] ?? null;
            $f['estado']   = self::estadoStock($cant, $min);
        }
        unset($f);

        return $filas;
    }

    /** Semáforo de inventario: rojo (≤ mínimo), amarillo (cerca), verde (ok). */
    private static function estadoStock(int $cantidad, int $minimo): string
    {
        if ($cantidad <= $minimo) {
            return 'rojo';
        }
        if ($cantidad <= $minimo * 1.5) {
            return 'amarillo';
        }
        return 'verde';
    }
}
