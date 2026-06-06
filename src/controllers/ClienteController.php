<?php
// ===========================================================================
//  Libre Mercado — ClienteController (Etapa 5 / Bloque B2)
//  CRUD de clientes (nodo CENTRAL). Borrado lógico vía `activo`.
//  email es UNIQUE -> el duplicado se traduce a 409.
// ===========================================================================

class ClienteController
{
    /** GET /clientes  — solo activos salvo ?todos=1. */
    public function listar(array $params, array $body): void
    {
        $central = Database::conectarCentral();
        $sql = "SELECT id_cli, nombre, email, telefono, activo FROM clientes";
        if (($_GET['todos'] ?? '') !== '1') {
            $sql .= " WHERE activo = 1";
        }
        $sql .= " ORDER BY id_cli";
        Response::exito($central->query($sql)->fetchAll());
    }

    /** GET /clientes/:id */
    public function obtener(array $params, array $body): void
    {
        $id = Validador::entero($params['id'] ?? null, 'id', 1);
        $cli = self::buscar(Database::conectarCentral(), $id);
        if (!$cli) {
            Response::error("Cliente $id no encontrado (nodo central).", 404);
        }
        Response::exito($cli);
    }

    /** POST /clientes */
    public function crear(array $params, array $body): void
    {
        $nombre   = Validador::texto($body['nombre'] ?? null, 'nombre', 150);
        $email    = Validador::email($body['email'] ?? null, 'email');
        $telefono = Validador::texto($body['telefono'] ?? null, 'telefono', 30, false);

        $central = Database::conectarCentral();
        try {
            $stmt = $central->prepare(
                "INSERT INTO clientes (nombre, email, telefono, activo) VALUES (?, ?, ?, 1)"
            );
            $stmt->execute([$nombre, $email, $telefono]);
        } catch (PDOException $e) {
            if (Validador::esDuplicado($e)) {
                Response::error("Ya existe un cliente con el email '$email'.", 409);
            }
            throw $e;
        }
        Response::exito(self::buscar($central, (int) $central->lastInsertId()), 201);
    }

    /** PUT /clientes/:id  — actualización parcial. */
    public function actualizar(array $params, array $body): void
    {
        $id = Validador::entero($params['id'] ?? null, 'id', 1);
        $central = Database::conectarCentral();
        $cli = self::buscar($central, $id);
        if (!$cli) {
            Response::error("Cliente $id no encontrado (nodo central).", 404);
        }

        $nombre   = array_key_exists('nombre', $body)
            ? Validador::texto($body['nombre'], 'nombre', 150)        : $cli['nombre'];
        $email    = array_key_exists('email', $body)
            ? Validador::email($body['email'], 'email')               : $cli['email'];
        $telefono = array_key_exists('telefono', $body)
            ? Validador::texto($body['telefono'], 'telefono', 30, false) : $cli['telefono'];

        try {
            $stmt = $central->prepare(
                "UPDATE clientes SET nombre = ?, email = ?, telefono = ? WHERE id_cli = ?"
            );
            $stmt->execute([$nombre, $email, $telefono, $id]);
        } catch (PDOException $e) {
            if (Validador::esDuplicado($e)) {
                Response::error("Ya existe otro cliente con el email '$email'.", 409);
            }
            throw $e;
        }
        Response::exito(self::buscar($central, $id));
    }

    /** DELETE /clientes/:id  — borrado lógico (activo = 0). */
    public function eliminar(array $params, array $body): void
    {
        $id = Validador::entero($params['id'] ?? null, 'id', 1);
        $central = Database::conectarCentral();
        $cli = self::buscar($central, $id);
        if (!$cli) {
            Response::error("Cliente $id no encontrado (nodo central).", 404);
        }
        if ((int) $cli['activo'] === 0) {
            Response::error("El cliente $id ya está inactivo.", 409);
        }
        // Dependencia: un cliente con usuario activo no debería desactivarse.
        $stmt = $central->prepare("SELECT 1 FROM usuarios WHERE id_cli = ? AND activo = 1");
        $stmt->execute([$id]);
        if ($stmt->fetchColumn()) {
            Response::error("No se puede desactivar: el cliente $id tiene un usuario activo asociado.", 409);
        }

        $central->prepare("UPDATE clientes SET activo = 0 WHERE id_cli = ?")->execute([$id]);
        Response::exito(['id_cli' => $id, 'activo' => 0]);
    }

    // -----------------------------------------------------------------------

    /** Busca un cliente por id (incluye inactivos) o null. */
    public static function buscar(PDO $central, int $id): ?array
    {
        $stmt = $central->prepare(
            "SELECT id_cli, nombre, email, telefono, activo FROM clientes WHERE id_cli = ?"
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    /** Cliente si existe y está activo; si no, null. (cross-node helper) */
    public static function obtenerActivo(PDO $central, int $id): ?array
    {
        $cli = self::buscar($central, $id);
        return ($cli && (int) $cli['activo'] === 1) ? $cli : null;
    }
}
