<?php
// ===========================================================================
//  Libre Mercado — index.php (Etapa 4 / Bloque A2)
//  Front controller único: TODA petición a la API entra por aquí (vía
//  .htaccess). Responsabilidades:
//    1. Autoloader de clases (config / helpers / middleware / controllers).
//    2. CORS (solo si se consume desde otro origen; la consola es mismo origen).
//    3. Sesión PHP.
//    4. Parseo del body JSON.
//    5. Manejo global de excepciones -> respuesta JSON consistente.
//    6. Delegar el ruteo al Router.
// ===========================================================================

declare(strict_types=1);

// --- 1. Autoloader simple por convención de carpetas -----------------------
spl_autoload_register(function (string $clase): void {
    $dirs = [__DIR__ . '/config', __DIR__ . '/helpers', __DIR__ . '/middleware', __DIR__ . '/controllers'];
    foreach ($dirs as $dir) {
        $archivo = "$dir/$clase.php";
        if (is_file($archivo)) {
            require_once $archivo;
            return;
        }
    }
});

require_once __DIR__ . '/router.php';

// --- 2. CORS (debe ir antes de cualquier salida) ---------------------------
$origen = Config::corsOrigin();
header("Access-Control-Allow-Origin: $origen");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Vary: Origin');

// Preflight: responder vacío y cortar.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- 3. Sesión PHP ---------------------------------------------------------
//  SameSite=Lax basta: la consola PHP+AJAX y la API son mismo origen (:8080).
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

// --- 5. Manejo global de excepciones ---------------------------------------
set_exception_handler(function (Throwable $e): void {
    if ($e instanceof NodoException) {
        // Nodo caído / inalcanzable -> 503 (comportamiento CP).
        Response::error($e->getMessage(), 503, ['nodo' => $e->getNodo()]);
    }
    if ($e instanceof InvalidArgumentException) {
        Response::error($e->getMessage(), 400);
    }
    error_log('[Excepción no controlada] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    Response::error('Error interno del servidor.', 500);
});

// --- 4. Parseo del body JSON -----------------------------------------------
$body = [];
$crudo = file_get_contents('php://input');
if ($crudo !== '' && $crudo !== false) {
    $decodificado = json_decode($crudo, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        Response::error('JSON inválido en el cuerpo de la petición.', 400);
    }
    $body = is_array($decodificado) ? $decodificado : [];
}

// --- 6. Despacho -----------------------------------------------------------
$router = crearRouter();
$router->despachar($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI'], $body);
