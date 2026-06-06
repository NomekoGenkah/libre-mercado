<?php
// ===========================================================================
//  Libre Mercado — Database (Etapa 3 / Bloque A1)
//  Capa de conexión PDO a la red distribuida de MariaDB.
//
//  - conectarCentral(): PDO              -> nodo de datos globales.
//  - conectarSucursal(string $nodo): PDO -> 'norte'|'sur'|'este'.
//  - getNodoPorSucursal(int $id_suc): string -> mapea id_suc al nodo lógico.
//
//  Singleton POR NODO: una sola conexión PDO viva por nodo durante el request
//  (necesario para que las transacciones de la Etapa 6 abran BEGIN/COMMIT
//  sobre la MISMA conexión). Ante fallo de conexión lanza NodoException
//  indicando QUÉ nodo falló.
// ===========================================================================

class Database
{
    /** @var array<string,PDO> conexiones vivas, indexadas por clave de nodo. */
    private static array $conexiones = [];

    /**
     * id_suc -> nodo lógico. id_suc es globalmente único entre nodos:
     * Norte=1, Sur=2, Este=3 (asignado explícito en los seeds de la Etapa 2).
     */
    private const SUCURSAL_A_NODO = [
        1 => 'norte',
        2 => 'sur',
        3 => 'este',
    ];

    /** Conexión al nodo central (catálogo, clientes, usuarios, ventas). */
    public static function conectarCentral(): PDO
    {
        return self::conectar('central');
    }

    /**
     * Conexión a un nodo de sucursal.
     * @param string $nodo 'norte'|'sur'|'este'
     */
    public static function conectarSucursal(string $nodo): PDO
    {
        if (!in_array($nodo, ['norte', 'sur', 'este'], true)) {
            throw new InvalidArgumentException("Sucursal desconocida: '$nodo'");
        }
        return self::conectar($nodo);
    }

    /**
     * Traduce el id de sucursal al nombre del nodo lógico donde viven sus
     * datos locales (stock, movimientos, compras, carrito).
     *
     * @param int $id_suc 1|2|3
     * @return string 'norte'|'sur'|'este'
     * @throws InvalidArgumentException si el id_suc no corresponde a un nodo.
     */
    public static function getNodoPorSucursal(int $id_suc): string
    {
        if (!isset(self::SUCURSAL_A_NODO[$id_suc])) {
            throw new InvalidArgumentException("No existe nodo para la sucursal id_suc=$id_suc");
        }
        return self::SUCURSAL_A_NODO[$id_suc];
    }

    /**
     * Abre (o reutiliza) la conexión PDO de un nodo.
     *
     * @param string $clave 'central'|'norte'|'sur'|'este'
     * @throws NodoException si el nodo no responde / credenciales inválidas.
     */
    private static function conectar(string $clave): PDO
    {
        if (isset(self::$conexiones[$clave])) {
            return self::$conexiones[$clave];
        }

        $cfg = Config::nodo($clave);
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $cfg['host'],
            $cfg['port'],
            $cfg['dbname']
        );

        $opciones = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            // Timeout corto: si un nodo está caído, fallar rápido (CP -> 503)
            // en vez de colgar el request del usuario.
            PDO::ATTR_TIMEOUT            => 5,
        ];

        try {
            $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], $opciones);
        } catch (PDOException $e) {
            error_log("[Database] Fallo de conexión al nodo '$clave': " . $e->getMessage());
            throw new NodoException(
                $clave,
                "No se pudo conectar al nodo '$clave' ($cfg[host]:$cfg[port]). " .
                "El nodo podría estar caído o inalcanzable.",
                $e
            );
        }

        self::$conexiones[$clave] = $pdo;
        return $pdo;
    }
}
