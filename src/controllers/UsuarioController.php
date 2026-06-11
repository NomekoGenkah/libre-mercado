<?php
// ===========================================================================
//  Libre Mercado — UsuarioController (Etapa 5 / Bloque B3)
//  CRUD de usuarios (nodo CENTRAL). Borrado lógico vía `activo`.
//  - username es UNIQUE -> duplicado = 409.
//  - rol es FK a roles(rol) -> se valida contra el catálogo.
//  - id_cli es opcional (el admin no es cliente); si viene, debe existir.
//  - NUNCA se devuelve password_hash en las respuestas.
//  - Las contraseñas se guardan con password_hash() (bcrypt).
// ===========================================================================

class UsuarioController
{
    /** GET /usuarios  — solo activos salvo ?todos=1 (sin password_hash). */
    public function listar(array $params, array $body): void
    {
        $central = Database::conectarCentral();
        $sql = "SELECT u.id_usr, u.id_cli, c.nombre AS cliente, u.username, u.rol, u.activo
                FROM usuarios u
                LEFT JOIN clientes c ON c.id_cli = u.id_cli";
        if (($_GET['todos'] ?? '') !== '1') {
            $sql .= " WHERE u.activo = 1";
        }
        $sql .= " ORDER BY u.id_usr";
        Response::exito($central->query($sql)->fetchAll());
    }

    /** GET /usuarios/:id */
    public function obtener(array $params, array $body): void
    {
        $id = Validador::entero($params['id'] ?? null, 'id', 1);
        $usr = self::buscar(Database::conectarCentral(), $id);
        if (!$usr) {
            Response::error("Usuario $id no encontrado (nodo central).", 404);
        }
        Response::exito($usr);
    }

    /** POST /usuarios */
    public function crear(array $params, array $body): void
    {
        $username = Validador::texto($body['username'] ?? null, 'username', 60);
        $password = Validador::texto($body['password'] ?? null, 'password', 255);
        $rol      = Validador::texto($body['rol'] ?? null, 'rol', 40);
        $id_cli   = Validador::enteroOpc($body['id_cli'] ?? null, 'id_cli', 1);

        $central = Database::conectarCentral();
        if (!self::rolExiste($central, $rol)) {
            Response::error("El rol '$rol' no existe en el catálogo de roles.", 400);
        }
        if ($id_cli !== null && !ClienteController::obtenerActivo($central, $id_cli)) {
            Response::error("El cliente $id_cli no existe o está inactivo.", 400);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        try {
            $stmt = $central->prepare(
                "INSERT INTO usuarios (id_cli, username, password_hash, rol, activo)
                 VALUES (?, ?, ?, ?, 1)"
            );
            $stmt->execute([$id_cli, $username, $hash, $rol]);
        } catch (PDOException $e) {
            if (Validador::esDuplicado($e)) {
                Response::error("Ya existe un usuario con username '$username'.", 409);
            }
            throw $e;
        }
        Response::exito(self::buscar($central, (int) $central->lastInsertId()), 201);
    }

    /** PUT /usuarios/:id  — actualización parcial (incl. password opcional). */
    public function actualizar(array $params, array $body): void
    {
        $id = Validador::entero($params['id'] ?? null, 'id', 1);
        $central = Database::conectarCentral();
        $usr = self::buscar($central, $id);
        if (!$usr) {
            Response::error("Usuario $id no encontrado (nodo central).", 404);
        }

        $username = array_key_exists('username', $body)
            ? Validador::texto($body['username'], 'username', 60) : $usr['username'];

        $rol = $usr['rol'];
        if (array_key_exists('rol', $body)) {
            $rol = Validador::texto($body['rol'], 'rol', 40);
            if (!self::rolExiste($central, $rol)) {
                Response::error("El rol '$rol' no existe en el catálogo de roles.", 400);
            }
        }

        $id_cli = $usr['id_cli'] !== null ? (int) $usr['id_cli'] : null;
        if (array_key_exists('id_cli', $body)) {
            $id_cli = Validador::enteroOpc($body['id_cli'], 'id_cli', 1);
            if ($id_cli !== null && !ClienteController::obtenerActivo($central, $id_cli)) {
                Response::error("El cliente $id_cli no existe o está inactivo.", 400);
            }
        }

        // Guard anti-bloqueo: no permitir quitarle el rol admin al último
        // administrador activo (dejaría al sistema sin forma de administrarse).
        if ($usr['rol'] === 'admin' && $rol !== 'admin' && self::esUltimoAdminActivo($central, $usr)) {
            Response::error('No se puede quitar el rol admin al último administrador activo del sistema.', 409);
        }

        // password sólo se reescribe si viene un valor no vacío.
        $sets   = ['username = ?', 'rol = ?', 'id_cli = ?'];
        $vals   = [$username, $rol, $id_cli];
        if (array_key_exists('password', $body)) {
            $password = Validador::texto($body['password'], 'password', 255);
            $sets[] = 'password_hash = ?';
            $vals[] = password_hash($password, PASSWORD_BCRYPT);
        }
        $vals[] = $id;

        try {
            $stmt = $central->prepare("UPDATE usuarios SET " . implode(', ', $sets) . " WHERE id_usr = ?");
            $stmt->execute($vals);
        } catch (PDOException $e) {
            if (Validador::esDuplicado($e)) {
                Response::error("Ya existe otro usuario con username '$username'.", 409);
            }
            throw $e;
        }
        Response::exito(self::buscar($central, $id));
    }

    /** DELETE /usuarios/:id  — borrado lógico (activo = 0). */
    public function eliminar(array $params, array $body): void
    {
        $id = Validador::entero($params['id'] ?? null, 'id', 1);
        $central = Database::conectarCentral();
        $usr = self::buscar($central, $id);
        if (!$usr) {
            Response::error("Usuario $id no encontrado (nodo central).", 404);
        }
        if ((int) $usr['activo'] === 0) {
            Response::error("El usuario $id ya está inactivo.", 409);
        }

        // Guards anti-bloqueo: evitar quedarse sin acceso administrativo.
        $actual = Auth::usuarioActual();
        if ($actual && (int) $actual['id_usr'] === $id) {
            Response::error('No puedes desactivar tu propio usuario mientras tu sesión está activa.', 409);
        }
        if (self::esUltimoAdminActivo($central, $usr)) {
            Response::error('No se puede desactivar al último administrador activo del sistema.', 409);
        }

        $central->prepare("UPDATE usuarios SET activo = 0 WHERE id_usr = ?")->execute([$id]);
        Response::exito(['id_usr' => $id, 'activo' => 0]);
    }

    // -----------------------------------------------------------------------

    /** Busca un usuario por id SIN exponer password_hash. */
    public static function buscar(PDO $central, int $id): ?array
    {
        $stmt = $central->prepare(
            "SELECT id_usr, id_cli, username, rol, activo FROM usuarios WHERE id_usr = ?"
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    private static function rolExiste(PDO $central, string $rol): bool
    {
        $stmt = $central->prepare("SELECT 1 FROM roles WHERE rol = ?");
        $stmt->execute([$rol]);
        return (bool) $stmt->fetchColumn();
    }

    /**
     * ¿El usuario dado es el ÚNICO administrador activo del sistema?
     * Sirve para impedir el auto-bloqueo (desactivar/degradar al último admin).
     *
     * @param array $usr fila de usuario (con 'id_usr', 'rol', 'activo').
     */
    private static function esUltimoAdminActivo(PDO $central, array $usr): bool
    {
        if ($usr['rol'] !== 'admin' || (int) $usr['activo'] !== 1) {
            return false;
        }
        $stmt = $central->prepare(
            "SELECT COUNT(*) FROM usuarios WHERE rol = 'admin' AND activo = 1 AND id_usr <> ?"
        );
        $stmt->execute([(int) $usr['id_usr']]);
        return (int) $stmt->fetchColumn() === 0;
    }
}
