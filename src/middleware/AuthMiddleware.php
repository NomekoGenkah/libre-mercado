<?php
// ===========================================================================
//  Libre Mercado — AuthMiddleware (Etapa 4 / Bloque A2)
//  Aplica las reglas de acceso declaradas por cada ruta ANTES de invocar al
//  controller. El router pasa el array de opciones de la ruta:
//
//    'auth'  => true            -> exige sesión (Auth::requerirLogin)
//    'roles' => ['vendedor']    -> exige rol (Auth::requerirRol); implica auth
//
//  Si no hay restricciones, no hace nada (rutas públicas como /auth/login).
// ===========================================================================

class AuthMiddleware
{
    /**
     * @param array $opciones opciones de la ruta ('auth', 'roles').
     */
    public static function aplicar(array $opciones): void
    {
        $roles = $opciones['roles'] ?? null;
        if (!empty($roles)) {
            Auth::requerirRol(...$roles);
            return;
        }
        if (!empty($opciones['auth'])) {
            Auth::requerirLogin();
        }
    }
}
