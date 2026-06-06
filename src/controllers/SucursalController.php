<?php
// ===========================================================================
//  Libre Mercado — SucursalController (Etapa 5 / Bloque B5)
//  Las sucursales viven en sus propios nodos (una fila por nodo). Listarlas
//  implica consultar los 3 nodos. Es lectura de metadatos: si un nodo está
//  caído, se reporta en `nodos_caidos` en vez de tumbar toda la respuesta.
// ===========================================================================

class SucursalController
{
    /** Nodos lógicos de sucursal (orden por id_suc: norte=1, sur=2, este=3). */
    private const NODOS = ['norte', 'sur', 'este'];

    /** GET /sucursales  — agrega las sucursales de los 3 nodos. */
    public function listar(array $params, array $body): void
    {
        $sucursales = [];
        $caidos = [];

        foreach (self::NODOS as $nodo) {
            try {
                $pdo = Database::conectarSucursal($nodo);
                $filas = $pdo->query(
                    "SELECT id_suc, sucursal, direccion, region, nodo FROM sucursales"
                )->fetchAll();
                foreach ($filas as $f) {
                    $sucursales[] = $f;
                }
            } catch (NodoException $e) {
                $caidos[] = $nodo;
            }
        }

        usort($sucursales, fn($a, $b) => (int) $a['id_suc'] <=> (int) $b['id_suc']);
        Response::exito(['sucursales' => $sucursales, 'nodos_caidos' => $caidos]);
    }

    /** GET /sucursales/:id/stock  — metadatos de la sucursal + su stock. */
    public function stock(array $params, array $body): void
    {
        $id_suc = Validador::entero($params['id'] ?? null, 'id', 1);
        $nodo = Database::getNodoPorSucursal($id_suc);
        $suc  = Database::conectarSucursal($nodo);

        $stmt = $suc->prepare(
            "SELECT id_suc, sucursal, direccion, region, nodo FROM sucursales WHERE id_suc = ?"
        );
        $stmt->execute([$id_suc]);
        $meta = $stmt->fetch();
        if (!$meta) {
            Response::error("Sucursal $id_suc no encontrada (nodo $nodo).", 404);
        }

        Response::exito([
            'sucursal' => $meta,
            'stock'    => StockController::obtenerStock($id_suc),
        ]);
    }
}
