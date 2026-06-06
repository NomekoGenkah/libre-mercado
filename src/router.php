<?php
// ===========================================================================
//  Libre Mercado — Router (Etapa 4 / Bloque A2)
//  Front controller routing: mapea  "MÉTODO /ruta"  ->  Controller::método.
//
//  - Soporta parámetros de ruta con ':nombre' (p.ej. /productos/:id).
//  - Cada ruta puede declarar middleware: 'auth' => true, 'roles' => [...].
//  - El handler puede ser "Clase@metodo" (controller) o un Closure (rutas
//    internas como el healthcheck).
//  - Los controllers reciben  ($params, $body)  donde:
//      $params = parámetros de la URL (['id' => '7'])
//      $body   = cuerpo JSON ya decodificado (array asociativo)
//
//  Mientras los controllers del Bloque B/C/D no existan, una ruta que apunta
//  a una clase inexistente responde 501 (Not Implemented) de forma limpia.
// ===========================================================================

class Router
{
    /** @var array<int,array{metodo:string,patron:string,handler:mixed,opciones:array}> */
    private array $rutas = [];

    /** Registra una ruta. */
    public function agregar(string $metodo, string $patron, $handler, array $opciones = []): void
    {
        $this->rutas[] = [
            'metodo'   => strtoupper($metodo),
            'patron'   => $patron,
            'handler'  => $handler,
            'opciones' => $opciones,
        ];
    }

    /**
     * Resuelve la petición actual: encuentra la ruta, aplica middleware y
     * ejecuta el handler. Responde 404 (ruta) o 405 (método) si no calza.
     */
    public function despachar(string $metodo, string $uri, array $body): void
    {
        $ruta = $this->normalizar($uri);
        $metodo = strtoupper($metodo);
        $rutaCoincideOtroMetodo = false;

        foreach ($this->rutas as $r) {
            $params = $this->emparejar($r['patron'], $ruta);
            if ($params === null) {
                continue;
            }
            if ($r['metodo'] !== $metodo) {
                $rutaCoincideOtroMetodo = true;
                continue;
            }

            // Middleware de acceso (sesión / roles) antes del controller.
            AuthMiddleware::aplicar($r['opciones']);

            $this->ejecutar($r['handler'], $params, $body);
            return; // ejecutar() siempre termina con Response::*(), pero por claridad
        }

        if ($rutaCoincideOtroMetodo) {
            Response::error("Método $metodo no permitido para esta ruta.", 405);
        }
        Response::error("Ruta no encontrada: $metodo $ruta", 404);
    }

    /** Normaliza la URI: quita query string y barra final (salvo la raíz). */
    private function normalizar(string $uri): string
    {
        $ruta = parse_url($uri, PHP_URL_PATH) ?: '/';
        if ($ruta !== '/') {
            $ruta = rtrim($ruta, '/');
        }
        return $ruta;
    }

    /**
     * Compara un patrón ('/productos/:id') contra la ruta real.
     * @return array|null parámetros capturados, o null si no calza.
     */
    private function emparejar(string $patron, string $ruta): ?array
    {
        $regex = preg_replace('#:([a-zA-Z_]+)#', '(?P<$1>[^/]+)', $patron);
        $regex = '#^' . $regex . '$#';
        if (!preg_match($regex, $ruta, $m)) {
            return null;
        }
        $params = [];
        foreach ($m as $clave => $valor) {
            if (!is_int($clave)) {
                $params[$clave] = $valor;
            }
        }
        return $params;
    }

    /** Invoca el handler (Closure o "Clase@metodo"). */
    private function ejecutar($handler, array $params, array $body): void
    {
        if ($handler instanceof Closure) {
            $handler($params, $body);
            return;
        }

        [$clase, $metodo] = explode('@', $handler);
        if (!class_exists($clase) || !method_exists($clase, $metodo)) {
            Response::error(
                "Endpoint aún no implementado ($clase::$metodo). Pendiente de un bloque posterior.",
                501
            );
        }
        (new $clase())->$metodo($params, $body);
    }
}

// ---------------------------------------------------------------------------
//  Tabla de rutas — refleja la sección "Rutas API" de CLAUDE.md.
//  auth/roles: 'auth'=>true exige login; 'roles'=>[...] exige rol (admin pasa
//  siempre). Las rutas /auth/login y el healthcheck son públicas.
// ---------------------------------------------------------------------------
function crearRouter(): Router
{
    $r = new Router();

    // --- Healthcheck / diagnóstico (público, sin controller) ----------------
    $r->agregar('GET', '/', fn() => Response::exito([
        'app'    => 'Libre Mercado API',
        'estado' => 'ok',
        'etapa'  => 'Bloque A — fundamentos backend',
    ]));
    $r->agregar('GET', '/salud', fn() => verificarNodos());

    // --- Autenticación ------------------------------------------------------
    $r->agregar('POST', '/auth/login',  'AuthController@login');
    $r->agregar('POST', '/auth/logout', 'AuthController@logout', ['auth' => true]);
    $r->agregar('GET',  '/auth/me',     'AuthController@me',     ['auth' => true]);

    // --- Productos ----------------------------------------------------------
    $r->agregar('GET',    '/productos',     'ProductoController@listar',   ['auth' => true]);
    $r->agregar('POST',   '/productos',     'ProductoController@crear',    ['roles' => ['admin']]);
    $r->agregar('GET',    '/productos/:id', 'ProductoController@obtener',  ['auth' => true]);
    $r->agregar('PUT',    '/productos/:id', 'ProductoController@actualizar', ['roles' => ['admin']]);
    $r->agregar('DELETE', '/productos/:id', 'ProductoController@eliminar', ['roles' => ['admin']]);

    // --- Clientes -----------------------------------------------------------
    $r->agregar('GET',    '/clientes',     'ClienteController@listar',    ['auth' => true]);
    $r->agregar('POST',   '/clientes',     'ClienteController@crear',     ['roles' => ['admin', 'vendedor']]);
    $r->agregar('GET',    '/clientes/:id', 'ClienteController@obtener',   ['auth' => true]);
    $r->agregar('PUT',    '/clientes/:id', 'ClienteController@actualizar', ['roles' => ['admin', 'vendedor']]);
    $r->agregar('DELETE', '/clientes/:id', 'ClienteController@eliminar',  ['roles' => ['admin']]);

    // --- Usuarios -----------------------------------------------------------
    $r->agregar('GET',    '/usuarios',     'UsuarioController@listar',    ['roles' => ['admin']]);
    $r->agregar('POST',   '/usuarios',     'UsuarioController@crear',     ['roles' => ['admin']]);
    $r->agregar('GET',    '/usuarios/:id', 'UsuarioController@obtener',   ['roles' => ['admin']]);
    $r->agregar('PUT',    '/usuarios/:id', 'UsuarioController@actualizar', ['roles' => ['admin']]);
    $r->agregar('DELETE', '/usuarios/:id', 'UsuarioController@eliminar',  ['roles' => ['admin']]);

    // --- Sucursales y stock -------------------------------------------------
    $r->agregar('GET', '/sucursales',           'SucursalController@listar',     ['auth' => true]);
    $r->agregar('GET', '/sucursales/:id/stock', 'SucursalController@stock',      ['auth' => true]);
    $r->agregar('GET', '/stock/:id_suc',        'StockController@porSucursal',   ['auth' => true]);
    $r->agregar('PUT', '/stock/:id_suc/:id_prod', 'StockController@ajustar',     ['roles' => ['admin', 'bodeguero']]);

    // --- Carrito ------------------------------------------------------------
    $r->agregar('POST',   '/carrito',                   'CarritoController@crear',        ['auth' => true]);
    $r->agregar('GET',    '/carrito/:id_cli',           'CarritoController@porCliente',   ['auth' => true]);
    $r->agregar('POST',   '/carrito/:id/items',         'CarritoController@agregarItem',  ['auth' => true]);
    $r->agregar('DELETE', '/carrito/:id/items/:id_prod', 'CarritoController@quitarItem',  ['auth' => true]);

    // --- Ventas (Two-Phase Commit) -----------------------------------------
    $r->agregar('GET',  '/ventas',     'VentaController@listar',      ['auth' => true]);
    $r->agregar('POST', '/ventas',     'VentaController@procesarVenta', ['roles' => ['admin', 'vendedor']]);
    $r->agregar('GET',  '/ventas/:id', 'VentaController@obtener',     ['auth' => true]);

    // --- Proveedores y compras ---------------------------------------------
    $r->agregar('GET',  '/proveedores', 'ProveedorController@listar', ['auth' => true]);
    $r->agregar('POST', '/proveedores', 'ProveedorController@crear',  ['roles' => ['admin', 'bodeguero']]);
    $r->agregar('GET',  '/compras',     'CompraController@listar',    ['auth' => true]);
    $r->agregar('POST', '/compras',     'CompraController@procesarReabastecimiento', ['roles' => ['admin', 'bodeguero']]);

    // --- Movimientos de stock ----------------------------------------------
    $r->agregar('GET', '/movimientos/:id_suc', 'StockController@movimientos', ['auth' => true]);

    // --- Debug / simulación CAP --------------------------------------------
    $r->agregar('POST', '/debug/simular-fallo', 'DebugController@simularFallo', ['roles' => ['admin']]);

    return $r;
}

/**
 * Healthcheck que intenta conectar a los 4 nodos y reporta su estado.
 * Útil para verificar el Bloque A end-to-end sin necesidad de controllers.
 */
function verificarNodos(): void
{
    $resultado = [];
    $todoOk = true;
    foreach (Config::nodos() as $clave) {
        try {
            $pdo = ($clave === 'central')
                ? Database::conectarCentral()
                : Database::conectarSucursal($clave);
            $pdo->query('SELECT 1');
            $resultado[$clave] = 'ok';
        } catch (Throwable $e) {
            $todoOk = false;
            $resultado[$clave] = 'caído';
        }
    }
    Response::json(['ok' => $todoOk, 'data' => ['nodos' => $resultado]], $todoOk ? 200 : 503);
}
