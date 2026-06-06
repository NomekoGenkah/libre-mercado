<?php
// ===========================================================================
//  Libre Mercado — Validador (Etapa 5 / Bloque B)
//  Validación de input ANTES de tocar la base de datos (convención del repo).
//  Cada método valida un valor crudo; si no cumple, responde 400 y corta el
//  request (Response::error hace exit). Devuelve el valor ya normalizado.
//
//  Uso típico en un controller:
//    $id  = Validador::entero($params['id'] ?? null, 'id', 1);
//    $txt = Validador::texto($body['producto'] ?? null, 'producto', 150);
// ===========================================================================

class Validador
{
    /** Entero requerido. $min opcional (inclusive). */
    public static function entero($valor, string $campo, ?int $min = null): int
    {
        if ($valor === null || $valor === '' || !is_numeric($valor)) {
            Response::error("El campo '$campo' debe ser un número entero.", 400);
        }
        $f = (float) $valor;
        if (floor($f) != $f) {
            Response::error("El campo '$campo' debe ser un entero (sin decimales).", 400);
        }
        $n = (int) $f;
        if ($min !== null && $n < $min) {
            Response::error("El campo '$campo' debe ser mayor o igual a $min.", 400);
        }
        return $n;
    }

    /** Entero opcional: null si no viene; valida si está presente. */
    public static function enteroOpc($valor, string $campo, ?int $min = null): ?int
    {
        if ($valor === null || $valor === '') {
            return null;
        }
        return self::entero($valor, $campo, $min);
    }

    /** Decimal requerido. $min opcional (inclusive). */
    public static function decimal($valor, string $campo, ?float $min = null): float
    {
        if ($valor === null || $valor === '' || !is_numeric($valor)) {
            Response::error("El campo '$campo' debe ser un número.", 400);
        }
        $n = (float) $valor;
        if ($min !== null && $n < $min) {
            Response::error("El campo '$campo' debe ser mayor o igual a $min.", 400);
        }
        return $n;
    }

    /**
     * Texto con tope de longitud. Si $requerido es false y el valor está
     * ausente/vacío devuelve null; si es true, exige contenido no vacío.
     */
    public static function texto($valor, string $campo, int $max, bool $requerido = true): ?string
    {
        $valor = $valor === null ? '' : trim((string) $valor);
        if ($valor === '') {
            if ($requerido) {
                Response::error("El campo '$campo' es obligatorio.", 400);
            }
            return null;
        }
        if (mb_strlen($valor) > $max) {
            Response::error("El campo '$campo' no puede superar los $max caracteres.", 400);
        }
        return $valor;
    }

    /** Email (opcionalmente requerido). Valida formato con filter_var. */
    public static function email($valor, string $campo, bool $requerido = true): ?string
    {
        $valor = $valor === null ? '' : trim((string) $valor);
        if ($valor === '') {
            if ($requerido) {
                Response::error("El campo '$campo' es obligatorio.", 400);
            }
            return null;
        }
        if (!filter_var($valor, FILTER_VALIDATE_EMAIL)) {
            Response::error("El campo '$campo' no es un email válido.", 400);
        }
        return $valor;
    }

    /** Valor que debe pertenecer a un conjunto permitido. */
    public static function enLista($valor, string $campo, array $opciones): string
    {
        $valor = $valor === null ? '' : trim((string) $valor);
        if (!in_array($valor, $opciones, true)) {
            Response::error("El campo '$campo' debe ser uno de: " . implode(', ', $opciones) . '.', 400);
        }
        return $valor;
    }

    /** True si la PDOException es una violación de restricción UNIQUE (→ 409). */
    public static function esDuplicado(PDOException $e): bool
    {
        return $e->getCode() === '23000';
    }
}
