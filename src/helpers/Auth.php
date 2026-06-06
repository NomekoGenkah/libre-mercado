<?php
// ===========================================================================
//  Libre Mercado — Auth (Etapa 4/8 / Bloque A2 + E2)
//  Helper de autenticación basado en sesiones PHP ($_SESSION).
//  La verificación de contraseñas (password_verify) vive en AuthController;
//  aquí solo se gestiona el estado de sesión y los guards de acceso.
//
//  Roles del sistema: 'admin' (total), 'vendedor', 'bodeguero'.
// ===========================================================================

class Auth
{
    /** Registra al usuario autenticado en la sesión (lo llama AuthController). */
    public static function iniciarSesion(array $usuario): void
    {
        // Regenerar id de sesión al autenticar mitiga fijación de sesión.
        session_regenerate_id(true);
        $_SESSION['usuario'] = [
            'id_usr'   => (int) $usuario['id_usr'],
            'username' => $usuario['username'],
            'rol'      => $usuario['rol'],
            'id_cli'   => isset($usuario['id_cli']) ? (int) $usuario['id_cli'] : null,
        ];
    }

    /** Cierra la sesión actual por completo. */
    public static function cerrarSesion(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
    }

    /** Devuelve el usuario autenticado o null. */
    public static function usuarioActual(): ?array
    {
        return $_SESSION['usuario'] ?? null;
    }

    public static function estaAutenticado(): bool
    {
        return isset($_SESSION['usuario']);
    }

    /** Guard: exige sesión activa. Responde 401 y corta si no hay login. */
    public static function requerirLogin(): void
    {
        if (!self::estaAutenticado()) {
            Response::error('No autenticado. Inicia sesión.', 401);
        }
    }

    /**
     * Guard: exige que el usuario tenga uno de los roles indicados.
     * 'admin' siempre pasa. Responde 401 si no hay login, 403 si el rol no basta.
     */
    public static function requerirRol(string ...$roles): void
    {
        self::requerirLogin();
        $rol = $_SESSION['usuario']['rol'];
        if ($rol === 'admin' || in_array($rol, $roles, true)) {
            return;
        }
        Response::error('No tienes permisos para esta acción.', 403, ['rol_actual' => $rol, 'roles_requeridos' => $roles]);
    }
}
