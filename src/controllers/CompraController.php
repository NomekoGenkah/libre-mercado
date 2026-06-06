<?php
// ===========================================================================
//  Libre Mercado — CompraController (Etapa 6 / Bloque C2)
//  Reabastecimiento: registra una COMPRA a proveedor y AUMENTA el stock.
//
//  ⚠️ A diferencia de la venta, aquí la transacción es LOCAL (un solo nodo):
//  según el modelo de datos, `compras`, `detalle_compras`, `stock` y
//  `movimientos_stock` viven TODAS en el nodo de la SUCURSAL. Por eso el
//  reabastecimiento es una transacción ACID de un único nodo (atómica entre
//  los 4 INSERT/UPDATE), no un Two-Phase Commit. El nodo CENTRAL sólo se usa
//  para VALIDAR referencias cross-node (proveedor activo, productos activos).
//
//  La venta (VentaController) sí es distribuida porque escribe en central
//  (ventas) y en sucursal (stock) a la vez.
// ===========================================================================

class CompraController
{
    private const NODOS = ['norte', 'sur', 'este'];

    /** POST /compras  — body: {id_prov, id_suc, items:[{id_prod, cantidad, precio_unitario?}]}. */
    public function procesarReabastecimiento(array $params, array $body): void
    {
        // --- FASE 0: validación (sin transacción) ---
        $id_prov = Validador::entero($body['id_prov'] ?? null, 'id_prov', 1);
        $id_suc  = Validador::entero($body['id_suc'] ?? null, 'id_suc', 1);

        if (empty($body['items']) || !is_array($body['items'])) {
            Response::error("La compra debe incluir al menos un ítem en 'items'.", 400);
        }

        $central = Database::conectarCentral();
        if (!ProveedorController::obtenerActivo($central, $id_prov)) {
            Response::error("El proveedor $id_prov no existe o está inactivo (nodo central).", 404);
        }

        // Validar productos (activos en central) y normalizar líneas.
        $lineas = [];
        $total = 0.0;
        foreach ($body['items'] as $i => $item) {
            $id_prod  = Validador::entero($item['id_prod'] ?? null, "items[$i].id_prod", 1);
            $cantidad = Validador::entero($item['cantidad'] ?? null, "items[$i].cantidad", 1);

            $prod = ProductoController::obtenerActivo($central, $id_prod);
            if (!$prod) {
                Response::error("El producto $id_prod no existe o está inactivo (nodo central).", 404);
            }
            // Precio de compra: el del body o, por defecto, el precio del catálogo.
            $precio = array_key_exists('precio_unitario', $item)
                ? Validador::decimal($item['precio_unitario'], "items[$i].precio_unitario", 0)
                : (float) $prod['precio'];

            $lineas[] = ['id_prod' => $id_prod, 'cantidad' => $cantidad, 'precio_unitario' => $precio];
            $total += $precio * $cantidad;
        }

        $nodo = Database::getNodoPorSucursal($id_suc);
        $suc  = Database::conectarSucursal($nodo);   // NodoException -> 503

        // --- FASE 1+2: transacción LOCAL en la sucursal ---
        try {
            $suc->beginTransaction();

            $insCompra = $suc->prepare(
                "INSERT INTO compras (id_prov, id_suc, total, estado)
                 VALUES (?, ?, ?, 'completada')"
            );
            $insCompra->execute([$id_prov, $id_suc, $total]);
            $id_compra = (int) $suc->lastInsertId();

            $insDet = $suc->prepare(
                "INSERT INTO detalle_compras (id_compra, id_prod, cantidad, precio_unitario)
                 VALUES (?, ?, ?, ?)"
            );
            // UPSERT de stock: si existe la fila, suma; si no, la crea.
            $selStock = $suc->prepare("SELECT id_stock FROM stock WHERE id_prod = ? AND id_suc = ?");
            $updStock = $suc->prepare("UPDATE stock SET cantidad = cantidad + ? WHERE id_stock = ?");
            $insStock = $suc->prepare("INSERT INTO stock (id_prod, id_suc, cantidad, cantidad_minima) VALUES (?, ?, ?, 0)");
            $insMov   = $suc->prepare(
                "INSERT INTO movimientos_stock (id_prod, id_suc, tipo, cantidad, motivo)
                 VALUES (?, ?, 'reabastecimiento', ?, ?)"
            );

            foreach ($lineas as $l) {
                $insDet->execute([$id_compra, $l['id_prod'], $l['cantidad'], $l['precio_unitario']]);

                $selStock->execute([$l['id_prod'], $id_suc]);
                $id_stock = $selStock->fetchColumn();
                if ($id_stock !== false) {
                    $updStock->execute([$l['cantidad'], $id_stock]);
                } else {
                    $insStock->execute([$l['id_prod'], $id_suc, $l['cantidad']]);
                }

                $insMov->execute([$l['id_prod'], $id_suc, $l['cantidad'], "Compra #$id_compra"]);
            }

            $suc->commit();
        } catch (Throwable $e) {
            if ($suc->inTransaction()) {
                $suc->rollBack();
            }
            error_log("[CompraController::procesarReabastecimiento] ROLLBACK (nodo '$nodo'): " . $e->getMessage());
            if ($e instanceof NodoException) {
                Response::error("Nodo '{$e->getNodo()}' no disponible: compra revertida.", 503, ['nodo' => $e->getNodo()]);
            }
            Response::error('La compra no se completó y fue revertida: ' . $e->getMessage(), 500);
        }

        Response::exito([
            'id_compra' => $id_compra,
            'id_prov'   => $id_prov,
            'id_suc'    => $id_suc,
            'nodo'      => $nodo,
            'total'     => $total,
            'estado'    => 'completada',
            'items'     => $lineas,
        ], 201);
    }

    /** GET /compras  — agrega las compras de los 3 nodos (filtro opcional ?id_suc). */
    public function listar(array $params, array $body): void
    {
        $central = Database::conectarCentral();

        // Proveedores (catálogo central) para resolver nombres.
        $provs = [];
        foreach ($central->query("SELECT id_prov, proveedor FROM proveedores")->fetchAll() as $p) {
            $provs[(int) $p['id_prov']] = $p['proveedor'];
        }

        $nodos = self::NODOS;
        if (!empty($_GET['id_suc'])) {
            $id_suc = Validador::entero($_GET['id_suc'], 'id_suc', 1);
            $nodos = [Database::getNodoPorSucursal($id_suc)];
        }

        $compras = [];
        $caidos = [];
        foreach ($nodos as $nodo) {
            try {
                $suc = Database::conectarSucursal($nodo);
                $filas = $suc->query(
                    "SELECT id_compra, id_prov, id_suc, fecha, total, estado
                     FROM compras ORDER BY fecha DESC, id_compra DESC"
                )->fetchAll();
                foreach ($filas as $c) {
                    $c['proveedor'] = $provs[(int) $c['id_prov']] ?? null;
                    $compras[] = $c;
                }
            } catch (NodoException $e) {
                $caidos[] = $nodo;
            }
        }

        Response::exito(['compras' => $compras, 'nodos_caidos' => $caidos]);
    }
}
