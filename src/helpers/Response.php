<?php
// ===========================================================================
//  Libre Mercado — Response (Etapa 4 / Bloque A2)
//  Helper único para todas las respuestas HTTP de la API. Garantiza
//  Content-Type JSON + UTF-8 y un formato de payload consistente.
//
//  Formato:
//    Éxito:  { "ok": true,  "data": ... }
//    Error:  { "ok": false, "error": "mensaje", "detalle": ... }
//
//  Todos los métodos TERMINAN el request (exit) para evitar salida extra.
// ===========================================================================

class Response
{
    /** Respuesta cruda con un payload ya armado. */
    public static function json($payload, int $codigo = 200): void
    {
        if (!headers_sent()) {
            http_response_code($codigo);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /** Respuesta de éxito. 200 por defecto; usar 201 al crear recursos. */
    public static function exito($data = null, int $codigo = 200): void
    {
        self::json(['ok' => true, 'data' => $data], $codigo);
    }

    /**
     * Respuesta de error. Registra también en error_log (convención del repo:
     * los errores van a la respuesta HTTP y al log del servidor).
     *
     * @param mixed $detalle contexto extra opcional (p.ej. nodo afectado).
     */
    public static function error(string $mensaje, int $codigo = 400, $detalle = null): void
    {
        error_log("[API $codigo] $mensaje" . ($detalle ? ' | ' . json_encode($detalle, JSON_UNESCAPED_UNICODE) : ''));
        $payload = ['ok' => false, 'error' => $mensaje];
        if ($detalle !== null) {
            $payload['detalle'] = $detalle;
        }
        self::json($payload, $codigo);
    }
}
