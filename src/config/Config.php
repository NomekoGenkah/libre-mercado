<?php
// ===========================================================================
//  Libre Mercado — Config (Etapa 3 / Bloque A1)
//  Centraliza la lectura de variables de entorno (getenv) para cada nodo.
//  No contiene credenciales hardcodeadas: todo viene de docker-compose/.env.
// ===========================================================================

class Config
{
    /**
     * Mapa nodo lógico -> prefijo de las variables de entorno.
     * 'central' es el nodo de datos globales; 'norte'|'sur'|'este' son
     * las sucursales (cada una en su propio contenedor MariaDB).
     */
    private const PREFIJOS = [
        'central' => 'CENTRAL',
        'norte'   => 'NORTE',
        'sur'     => 'SUR',
        'este'    => 'ESTE',
    ];

    /**
     * Devuelve los datos de conexión de un nodo lógico.
     *
     * @param string $clave 'central'|'norte'|'sur'|'este'
     * @return array{host:string,port:int,dbname:string,user:string,pass:string}
     * @throws InvalidArgumentException si la clave no existe.
     */
    public static function nodo(string $clave): array
    {
        if (!isset(self::PREFIJOS[$clave])) {
            throw new InvalidArgumentException("Nodo desconocido: '$clave'");
        }
        $p = self::PREFIJOS[$clave];

        return [
            'host'   => self::env("{$p}_HOST"),
            'port'   => (int) (self::env('DB_PORT', '3306')),
            'dbname' => self::env("{$p}_DB"),
            'user'   => self::env("{$p}_USER"),
            'pass'   => self::env("{$p}_PASSWORD"),
        ];
    }

    /** Origen permitido por CORS (frontend Vite). */
    public static function corsOrigin(): string
    {
        return self::env('CORS_ORIGIN', 'http://localhost:5173');
    }

    /** Lista de claves de nodo válidas (útil para healthchecks/diagnóstico). */
    public static function nodos(): array
    {
        return array_keys(self::PREFIJOS);
    }

    /**
     * Lee una variable de entorno. Lanza excepción si es obligatoria y falta,
     * para fallar temprano y claro en vez de conectar con datos vacíos.
     */
    private static function env(string $nombre, ?string $defecto = null): string
    {
        $valor = getenv($nombre);
        if ($valor === false || $valor === '') {
            if ($defecto !== null) {
                return $defecto;
            }
            throw new RuntimeException("Falta la variable de entorno requerida: $nombre");
        }
        return $valor;
    }
}
