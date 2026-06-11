<?php
// ===========================================================================
//  Libre Mercado — CatalogoController (vitrina pública)
//  Superficie PÚBLICA y de SOLO LECTURA del catálogo: la consume el feed de
//  la tienda que ve un comprador SIN iniciar sesión. Por eso vive aparte de
//  ProductoController (que sigue protegido para la consola interna).
//
//  Devuelve productos activos del nodo central enriquecidos con la
//  DISPONIBILIDAD agregada (suma de stock de las tres sucursales).
//
//  Nota CAP: este es un camino de LECTURA pública, no la venta. Si un nodo de
//  sucursal está caído, NO tumbamos toda la vitrina: degradamos sumando solo
//  los nodos que responden y marcamos `parcial`. La consistencia estricta (CP)
//  se reserva para la transacción de venta (procesarVenta).
// ===========================================================================

class CatalogoController
{
    private const NODOS = ['norte', 'sur', 'este'];

    /** GET /catalogo — feed público: productos activos + disponibilidad. */
    public function listar(array $params, array $body): void
    {
        $central = Database::conectarCentral();
        $productos = $central->query(
            "SELECT p.id_prod, p.producto, p.precio, p.descripcion,
                    p.id_cat, c.categoria
             FROM productos p
             LEFT JOIN categorias c ON c.id_cat = p.id_cat
             WHERE p.activo = 1
             ORDER BY p.producto"
        )->fetchAll();

        [$disp, $caidos] = self::disponibilidadGlobal();

        foreach ($productos as &$p) {
            $cant = $disp[(int) $p['id_prod']] ?? 0;
            $p['disponible'] = $cant;
            $p['agotado']    = $cant <= 0;
        }
        unset($p);

        Response::exito([
            'productos' => $productos,
            'parcial'   => !empty($caidos),       // true si faltó algún nodo
            'nodos_sin_respuesta' => $caidos,     // p.ej. ['este']
        ]);
    }

    /** GET /catalogo/:id — detalle público de un producto activo. */
    public function obtener(array $params, array $body): void
    {
        $id = Validador::entero($params['id'] ?? null, 'id', 1);
        $central = Database::conectarCentral();

        $stmt = $central->prepare(
            "SELECT p.id_prod, p.producto, p.precio, p.descripcion,
                    p.id_cat, c.categoria
             FROM productos p
             LEFT JOIN categorias c ON c.id_cat = p.id_cat
             WHERE p.id_prod = ? AND p.activo = 1"
        );
        $stmt->execute([$id]);
        $prod = $stmt->fetch();

        if (!$prod) {
            Response::error("Producto $id no disponible en la tienda.", 404);
        }

        [$disp, $caidos] = self::disponibilidadGlobal($id);
        $cant = $disp[$id] ?? 0;
        $prod['disponible'] = $cant;
        $prod['agotado']    = $cant <= 0;
        $prod['parcial']    = !empty($caidos);
        $prod['nodos_sin_respuesta'] = $caidos;

        Response::exito($prod);
    }

    /**
     * Suma el stock de cada producto a través de las tres sucursales.
     * Tolerante a particiones: un nodo caído se omite (se anota en $caidos)
     * en lugar de propagar la NodoException y romper la vitrina.
     *
     * @param int|null $idProd si se indica, agrega solo ese producto.
     * @return array{0: array<int,int>, 1: array<int,string>} [disponibles, nodosCaidos]
     */
    private static function disponibilidadGlobal(?int $idProd = null): array
    {
        $disp = [];
        $caidos = [];

        foreach (self::NODOS as $nodo) {
            try {
                $suc = Database::conectarSucursal($nodo);
                if ($idProd !== null) {
                    $stmt = $suc->prepare(
                        "SELECT id_prod, SUM(cantidad) AS cant FROM stock
                         WHERE id_prod = ? GROUP BY id_prod"
                    );
                    $stmt->execute([$idProd]);
                    $filas = $stmt->fetchAll();
                } else {
                    $filas = $suc->query(
                        "SELECT id_prod, SUM(cantidad) AS cant FROM stock GROUP BY id_prod"
                    )->fetchAll();
                }
                foreach ($filas as $f) {
                    $pid = (int) $f['id_prod'];
                    $disp[$pid] = ($disp[$pid] ?? 0) + (int) $f['cant'];
                }
            } catch (NodoException $e) {
                // Nodo no disponible: la vitrina sigue con los nodos restantes.
                error_log("[catalogo] nodo '$nodo' sin respuesta: " . $e->getMessage());
                $caidos[] = $nodo;
            }
        }

        return [$disp, $caidos];
    }
}
