<?php
// ===========================================================================
//  Libre Mercado — ProductoController (Etapa 5 / Bloque B1)
//  CRUD del catálogo (nodo CENTRAL). Borrado lógico vía `activo`.
//  Expone helpers estáticos reutilizados por Stock/Carrito/Venta para
//  resolver nombres de producto (que viven en central) desde otros nodos.
// ===========================================================================

class ProductoController
{
    /** GET /productos  — lista catálogo (solo activos salvo ?todos=1). */
    public function listar(array $params, array $body): void
    {
        $central = Database::conectarCentral();
        $incluirInactivos = (($_GET['todos'] ?? '') === '1');

        $sql = "SELECT p.id_prod, p.producto, p.precio, p.descripcion,
                       p.id_cat, c.categoria, p.activo
                FROM productos p
                LEFT JOIN categorias c ON c.id_cat = p.id_cat";
        if (!$incluirInactivos) {
            $sql .= " WHERE p.activo = 1";
        }
        $sql .= " ORDER BY p.id_prod";

        Response::exito($central->query($sql)->fetchAll());
    }

    /** GET /productos/:id */
    public function obtener(array $params, array $body): void
    {
        $id = Validador::entero($params['id'] ?? null, 'id', 1);
        $prod = self::buscar(Database::conectarCentral(), $id);
        if (!$prod) {
            Response::error("Producto $id no encontrado (nodo central).", 404);
        }
        Response::exito($prod);
    }

    /** POST /productos */
    public function crear(array $params, array $body): void
    {
        $producto    = Validador::texto($body['producto'] ?? null, 'producto', 150);
        $precio      = Validador::decimal($body['precio'] ?? null, 'precio', 0);
        $descripcion = Validador::texto($body['descripcion'] ?? null, 'descripcion', 65535, false);
        $id_cat      = Validador::enteroOpc($body['id_cat'] ?? null, 'id_cat', 1);

        $central = Database::conectarCentral();
        if ($id_cat !== null && !self::categoriaExiste($central, $id_cat)) {
            Response::error("La categoría $id_cat no existe (nodo central).", 400);
        }

        $stmt = $central->prepare(
            "INSERT INTO productos (producto, precio, descripcion, id_cat, activo)
             VALUES (?, ?, ?, ?, 1)"
        );
        $stmt->execute([$producto, $precio, $descripcion, $id_cat]);
        $id = (int) $central->lastInsertId();

        Response::exito(self::buscar($central, $id), 201);
    }

    /** PUT /productos/:id  — actualización parcial. */
    public function actualizar(array $params, array $body): void
    {
        $id = Validador::entero($params['id'] ?? null, 'id', 1);
        $central = Database::conectarCentral();
        $prod = self::buscar($central, $id);
        if (!$prod) {
            Response::error("Producto $id no encontrado (nodo central).", 404);
        }

        $producto    = array_key_exists('producto', $body)
            ? Validador::texto($body['producto'], 'producto', 150)         : $prod['producto'];
        $precio      = array_key_exists('precio', $body)
            ? Validador::decimal($body['precio'], 'precio', 0)             : $prod['precio'];
        $descripcion = array_key_exists('descripcion', $body)
            ? Validador::texto($body['descripcion'], 'descripcion', 65535, false) : $prod['descripcion'];

        $id_cat = $prod['id_cat'];
        if (array_key_exists('id_cat', $body)) {
            $id_cat = Validador::enteroOpc($body['id_cat'], 'id_cat', 1);
            if ($id_cat !== null && !self::categoriaExiste($central, $id_cat)) {
                Response::error("La categoría $id_cat no existe (nodo central).", 400);
            }
        }

        $stmt = $central->prepare(
            "UPDATE productos SET producto = ?, precio = ?, descripcion = ?, id_cat = ?
             WHERE id_prod = ?"
        );
        $stmt->execute([$producto, $precio, $descripcion, $id_cat, $id]);

        Response::exito(self::buscar($central, $id));
    }

    /** DELETE /productos/:id  — borrado lógico (activo = 0). */
    public function eliminar(array $params, array $body): void
    {
        $id = Validador::entero($params['id'] ?? null, 'id', 1);
        $central = Database::conectarCentral();
        $prod = self::buscar($central, $id);
        if (!$prod) {
            Response::error("Producto $id no encontrado (nodo central).", 404);
        }
        if ((int) $prod['activo'] === 0) {
            Response::error("El producto $id ya está inactivo.", 409);
        }
        $central->prepare("UPDATE productos SET activo = 0 WHERE id_prod = ?")->execute([$id]);
        Response::exito(['id_prod' => $id, 'activo' => 0]);
    }

    /** GET /categorias  — catálogo de categorías (apoyo al frontend). */
    public function categorias(array $params, array $body): void
    {
        $central = Database::conectarCentral();
        Response::exito($central->query("SELECT id_cat, categoria FROM categorias ORDER BY categoria")->fetchAll());
    }

    // -----------------------------------------------------------------------
    //  Helpers estáticos (reutilizados por otros controllers/cross-node)
    // -----------------------------------------------------------------------

    /** Busca un producto por id (incluye inactivos) o null. */
    public static function buscar(PDO $central, int $id): ?array
    {
        $stmt = $central->prepare(
            "SELECT p.id_prod, p.producto, p.precio, p.descripcion,
                    p.id_cat, c.categoria, p.activo
             FROM productos p
             LEFT JOIN categorias c ON c.id_cat = p.id_cat
             WHERE p.id_prod = ?"
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    /** Devuelve el producto si existe y está activo; si no, null. */
    public static function obtenerActivo(PDO $central, int $id): ?array
    {
        $prod = self::buscar($central, $id);
        return ($prod && (int) $prod['activo'] === 1) ? $prod : null;
    }

    /** Mapa id_prod => {producto, precio} para un conjunto de ids. */
    public static function mapaPorIds(PDO $central, array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if (!$ids) {
            return [];
        }
        $marcadores = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $central->prepare(
            "SELECT id_prod, producto, precio FROM productos WHERE id_prod IN ($marcadores)"
        );
        $stmt->execute($ids);

        $mapa = [];
        foreach ($stmt->fetchAll() as $fila) {
            $mapa[(int) $fila['id_prod']] = $fila;
        }
        return $mapa;
    }

    private static function categoriaExiste(PDO $central, int $id_cat): bool
    {
        $stmt = $central->prepare("SELECT 1 FROM categorias WHERE id_cat = ?");
        $stmt->execute([$id_cat]);
        return (bool) $stmt->fetchColumn();
    }
}
