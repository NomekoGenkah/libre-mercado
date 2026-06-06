<?php
// ===========================================================================
//  Libre Mercado — CarritoController (Etapa 5 / Bloque B7)
//  El carrito vive en el nodo de la SUCURSAL donde se compra. id_cli e id_prod
//  son referencias cross-node al catálogo CENTRAL (se validan contra central).
//
//  ⚠️ Nota de diseño distribuido: el id_carrito es AUTO_INCREMENT local de cada
//     nodo, por lo que NO es único entre sucursales. Por eso las operaciones
//     sobre ítems exigen además `id_suc` (en el body o query) para saber a qué
//     nodo conectarse. La creación del carrito devuelve su id_suc.
// ===========================================================================

class CarritoController
{
    private const NODOS = ['norte', 'sur', 'este'];

    /** POST /carrito  — crea un carrito abierto. body: {id_cli, id_suc}. */
    public function crear(array $params, array $body): void
    {
        $id_cli = Validador::entero($body['id_cli'] ?? null, 'id_cli', 1);
        $id_suc = Validador::entero($body['id_suc'] ?? null, 'id_suc', 1);

        $central = Database::conectarCentral();
        if (!ClienteController::obtenerActivo($central, $id_cli)) {
            Response::error("El cliente $id_cli no existe o está inactivo (nodo central).", 404);
        }

        $nodo = Database::getNodoPorSucursal($id_suc);
        $suc  = Database::conectarSucursal($nodo);
        $suc->prepare("INSERT INTO carrito (id_cli, id_suc, estado) VALUES (?, ?, 'abierto')")
            ->execute([$id_cli, $id_suc]);
        $id_carrito = (int) $suc->lastInsertId();

        Response::exito([
            'id_carrito' => $id_carrito,
            'id_cli'     => $id_cli,
            'id_suc'     => $id_suc,
            'estado'     => 'abierto',
            'items'      => [],
        ], 201);
    }

    /** GET /carrito/:id_cli  — carritos del cliente en todas las sucursales. */
    public function porCliente(array $params, array $body): void
    {
        $id_cli = Validador::entero($params['id_cli'] ?? null, 'id_cli', 1);
        $central = Database::conectarCentral();

        $carritos = [];
        $caidos = [];
        foreach (self::NODOS as $nodo) {
            try {
                $suc = Database::conectarSucursal($nodo);
                $stmt = $suc->prepare(
                    "SELECT id_carrito, id_cli, id_suc, fecha_creacion, estado
                     FROM carrito WHERE id_cli = ? ORDER BY id_carrito"
                );
                $stmt->execute([$id_cli]);
                foreach ($stmt->fetchAll() as $c) {
                    $c['items'] = self::items($suc, $central, (int) $c['id_carrito']);
                    $carritos[] = $c;
                }
            } catch (NodoException $e) {
                $caidos[] = $nodo;
            }
        }

        Response::exito(['carritos' => $carritos, 'nodos_caidos' => $caidos]);
    }

    /** POST /carrito/:id/items  — agrega/incrementa un ítem.
     *  body: {id_suc, id_prod, cantidad}. */
    public function agregarItem(array $params, array $body): void
    {
        $id_carrito = Validador::entero($params['id'] ?? null, 'id', 1);
        $id_suc     = Validador::entero($body['id_suc'] ?? null, 'id_suc', 1);
        $id_prod    = Validador::entero($body['id_prod'] ?? null, 'id_prod', 1);
        $cantidad   = Validador::entero($body['cantidad'] ?? null, 'cantidad', 1);

        $central = Database::conectarCentral();
        if (!ProductoController::obtenerActivo($central, $id_prod)) {
            Response::error("El producto $id_prod no existe o está inactivo (nodo central).", 404);
        }

        $nodo = Database::getNodoPorSucursal($id_suc);
        $suc  = Database::conectarSucursal($nodo);
        self::exigirCarritoAbierto($suc, $id_carrito, $id_suc, $nodo);

        // UPSERT manual: si el producto ya está, suma; si no, inserta.
        $stmt = $suc->prepare("SELECT id_detalle, cantidad FROM detalle_carrito WHERE id_carrito = ? AND id_prod = ?");
        $stmt->execute([$id_carrito, $id_prod]);
        $det = $stmt->fetch();

        if ($det) {
            $suc->prepare("UPDATE detalle_carrito SET cantidad = ? WHERE id_detalle = ?")
                ->execute([(int) $det['cantidad'] + $cantidad, $det['id_detalle']]);
        } else {
            $suc->prepare("INSERT INTO detalle_carrito (id_carrito, id_prod, cantidad) VALUES (?, ?, ?)")
                ->execute([$id_carrito, $id_prod, $cantidad]);
        }

        Response::exito([
            'id_carrito' => $id_carrito,
            'id_suc'     => $id_suc,
            'items'      => self::items($suc, $central, $id_carrito),
        ], $det ? 200 : 201);
    }

    /** DELETE /carrito/:id/items/:id_prod?id_suc=N  — quita un ítem. */
    public function quitarItem(array $params, array $body): void
    {
        $id_carrito = Validador::entero($params['id'] ?? null, 'id', 1);
        $id_prod    = Validador::entero($params['id_prod'] ?? null, 'id_prod', 1);
        $id_suc     = Validador::entero($_GET['id_suc'] ?? null, 'id_suc (query string)', 1);

        $central = Database::conectarCentral();
        $nodo = Database::getNodoPorSucursal($id_suc);
        $suc  = Database::conectarSucursal($nodo);
        self::exigirCarritoAbierto($suc, $id_carrito, $id_suc, $nodo);

        $stmt = $suc->prepare("DELETE FROM detalle_carrito WHERE id_carrito = ? AND id_prod = ?");
        $stmt->execute([$id_carrito, $id_prod]);
        if ($stmt->rowCount() === 0) {
            Response::error("El producto $id_prod no estaba en el carrito $id_carrito.", 404);
        }

        Response::exito([
            'id_carrito' => $id_carrito,
            'id_suc'     => $id_suc,
            'items'      => self::items($suc, $central, $id_carrito),
        ]);
    }

    // -----------------------------------------------------------------------

    /** Carga los ítems de un carrito enriquecidos con nombre/precio (central). */
    private static function items(PDO $suc, PDO $central, int $id_carrito): array
    {
        $stmt = $suc->prepare(
            "SELECT id_prod, cantidad FROM detalle_carrito WHERE id_carrito = ? ORDER BY id_prod"
        );
        $stmt->execute([$id_carrito]);
        $items = $stmt->fetchAll();

        $mapa = ProductoController::mapaPorIds($central, array_column($items, 'id_prod'));
        foreach ($items as &$it) {
            $prod = $mapa[(int) $it['id_prod']] ?? null;
            $it['producto'] = $prod['producto'] ?? null;
            $it['precio']   = $prod['precio'] ?? null;
        }
        unset($it);
        return $items;
    }

    /** Verifica que el carrito exista en el nodo y esté 'abierto' (404/409). */
    private static function exigirCarritoAbierto(PDO $suc, int $id_carrito, int $id_suc, string $nodo): void
    {
        $stmt = $suc->prepare("SELECT estado FROM carrito WHERE id_carrito = ? AND id_suc = ?");
        $stmt->execute([$id_carrito, $id_suc]);
        $estado = $stmt->fetchColumn();
        if ($estado === false) {
            Response::error("Carrito $id_carrito no encontrado en la sucursal $id_suc (nodo $nodo).", 404);
        }
        if ($estado !== 'abierto') {
            Response::error("El carrito $id_carrito no está abierto (estado: $estado).", 409);
        }
    }
}
