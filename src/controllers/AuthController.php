<?php
// ===========================================================================
//  Libre Mercado — AuthController (Etapa 8 / Bloque E)
//  Autenticación con sesiones PHP. Los usuarios viven en el nodo CENTRAL.
//  Contraseñas verificadas con password_verify() contra el bcrypt almacenado.
//  El estado de sesión y los guards de rol viven en helpers/Auth.php.
// ===========================================================================

class AuthController
{
    /** POST /auth/login  — body: {username, password}. */
    public function login(array $params, array $body): void
    {
        $username = Validador::texto($body['username'] ?? null, 'username', 60);
        $password = Validador::texto($body['password'] ?? null, 'password', 255);

        $central = Database::conectarCentral();
        $stmt = $central->prepare(
            "SELECT id_usr, id_cli, username, password_hash, rol, activo
             FROM usuarios WHERE username = ? AND activo = 1"
        );
        $stmt->execute([$username]);
        $usuario = $stmt->fetch();

        // Mensaje genérico (no revela si el usuario existe) y mismo 401 siempre.
        if (!$usuario || !password_verify($password, $usuario['password_hash'])) {
            Response::error('Credenciales inválidas.', 401);
        }

        Auth::iniciarSesion($usuario);
        Response::exito([
            'id_usr'   => (int) $usuario['id_usr'],
            'username' => $usuario['username'],
            'rol'      => $usuario['rol'],
            'id_cli'   => $usuario['id_cli'] !== null ? (int) $usuario['id_cli'] : null,
        ]);
    }

    /** POST /auth/logout  — cierra la sesión actual. */
    public function logout(array $params, array $body): void
    {
        Auth::cerrarSesion();
        Response::exito(['mensaje' => 'Sesión cerrada.']);
    }

    /** GET /auth/me  — devuelve el usuario autenticado. */
    public function me(array $params, array $body): void
    {
        Response::exito(Auth::usuarioActual());
    }
}
