<?php
// ===========================================================================
//  Libre Mercado — ProveedorController (Etapa 5 / Bloque B4)
//  CRUD de proveedores (nodo CENTRAL). Borrado lógico vía `activo`.
//  Los proveedores son referenciados por `compras` (que viven en los nodos de
//  sucursal, sin FK cross-node) -> el borrado lógico evita romper historiales.
// ===========================================================================

class ProveedorController
{
    /** GET /proveedores  — solo activos salvo ?todos=1. */
    public function listar(array $params, array $body): void
    {
        $central = Database::conectarCentral();
        $sql = "SELECT id_prov, proveedor, contacto, email, activo FROM proveedores";
        if (($_GET['todos'] ?? '') !== '1') {
            $sql .= " WHERE activo = 1";
        }
        $sql .= " ORDER BY id_prov";
        Response::exito($central->query($sql)->fetchAll());
    }

    /** GET /proveedores/:id */
    public function obtener(array $params, array $body): void
    {
        $id = Validador::entero($params['id'] ?? null, 'id', 1);
        $prov = self::buscar(Database::conectarCentral(), $id);
        if (!$prov) {
            Response::error("Proveedor $id no encontrado (nodo central).", 404);
        }
        Response::exito($prov);
    }

    /** POST /proveedores */
    public function crear(array $params, array $body): void
    {
        $proveedor = Validador::texto($body['proveedor'] ?? null, 'proveedor', 150);
        $contacto  = Validador::texto($body['contacto'] ?? null, 'contacto', 120, false);
        $email     = Validador::email($body['email'] ?? null, 'email', false);

        $central = Database::conectarCentral();
        $stmt = $central->prepare(
            "INSERT INTO proveedores (proveedor, contacto, email, activo) VALUES (?, ?, ?, 1)"
        );
        $stmt->execute([$proveedor, $contacto, $email]);
        Response::exito(self::buscar($central, (int) $central->lastInsertId()), 201);
    }

    /** PUT /proveedores/:id  — actualización parcial. */
    public function actualizar(array $params, array $body): void
    {
        $id = Validador::entero($params['id'] ?? null, 'id', 1);
        $central = Database::conectarCentral();
        $prov = self::buscar($central, $id);
        if (!$prov) {
            Response::error("Proveedor $id no encontrado (nodo central).", 404);
        }

        $proveedor = array_key_exists('proveedor', $body)
            ? Validador::texto($body['proveedor'], 'proveedor', 150)      : $prov['proveedor'];
        $contacto  = array_key_exists('contacto', $body)
            ? Validador::texto($body['contacto'], 'contacto', 120, false) : $prov['contacto'];
        $email     = array_key_exists('email', $body)
            ? Validador::email($body['email'], 'email', false)            : $prov['email'];

        $stmt = $central->prepare(
            "UPDATE proveedores SET proveedor = ?, contacto = ?, email = ? WHERE id_prov = ?"
        );
        $stmt->execute([$proveedor, $contacto, $email, $id]);
        Response::exito(self::buscar($central, $id));
    }

    /** DELETE /proveedores/:id  — borrado lógico (activo = 0). */
    public function eliminar(array $params, array $body): void
    {
        $id = Validador::entero($params['id'] ?? null, 'id', 1);
        $central = Database::conectarCentral();
        $prov = self::buscar($central, $id);
        if (!$prov) {
            Response::error("Proveedor $id no encontrado (nodo central).", 404);
        }
        if ((int) $prov['activo'] === 0) {
            Response::error("El proveedor $id ya está inactivo.", 409);
        }
        $central->prepare("UPDATE proveedores SET activo = 0 WHERE id_prov = ?")->execute([$id]);
        Response::exito(['id_prov' => $id, 'activo' => 0]);
    }

    // -----------------------------------------------------------------------

    /** Busca un proveedor por id (incluye inactivos) o null. */
    public static function buscar(PDO $central, int $id): ?array
    {
        $stmt = $central->prepare(
            "SELECT id_prov, proveedor, contacto, email, activo FROM proveedores WHERE id_prov = ?"
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    /** Proveedor si existe y está activo; si no, null. (cross-node helper) */
    public static function obtenerActivo(PDO $central, int $id): ?array
    {
        $prov = self::buscar($central, $id);
        return ($prov && (int) $prov['activo'] === 1) ? $prov : null;
    }
}
