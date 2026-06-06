<?php
// ===========================================================================
//  Libre Mercado — Harness de pruebas modulares (sin dependencias externas)
//  Mini-librería de aserciones para los tests unitarios de PHP puro.
//  No usa PHPUnit a propósito: el proyecto no tiene Composer y se busca que
//  las pruebas corran con el `php` que ya trae el contenedor app_php.
// ===========================================================================

$GLOBALS['__test'] = ['pass' => 0, 'fail' => 0];

/** Ejecuta un caso de prueba capturando su resultado. */
function it(string $descripcion, callable $fn): void
{
    try {
        $fn();
        echo "  \033[0;32mok\033[0m   $descripcion\n";
        $GLOBALS['__test']['pass']++;
    } catch (Throwable $e) {
        echo "  \033[0;31mFAIL\033[0m $descripcion\n       → " . $e->getMessage() . "\n";
        $GLOBALS['__test']['fail']++;
    }
}

function assertSame($esperado, $actual, string $msg = ''): void
{
    if ($esperado !== $actual) {
        throw new Exception(($msg ?: 'assertSame') .
            ' | esperado=' . var_export($esperado, true) .
            ' actual=' . var_export($actual, true));
    }
}

function assertTrue($cond, string $msg = ''): void
{
    if ($cond !== true) {
        throw new Exception($msg ?: 'assertTrue falló');
    }
}

function assertContiene(string $texto, string $aguja, string $msg = ''): void
{
    if (strpos($texto, $aguja) === false) {
        throw new Exception(($msg ?: 'assertContiene') . " | no se encontró '$aguja' en: $texto");
    }
}

/** Verifica que el callable lance una excepción de la clase indicada. */
function assertLanza(string $clase, callable $fn, string $msg = ''): void
{
    try {
        $fn();
    } catch (Throwable $e) {
        if ($e instanceof $clase) {
            return;
        }
        throw new Exception(($msg ?: 'assertLanza') . ' | lanzó ' . get_class($e) . " en vez de $clase");
    }
    throw new Exception(($msg ?: 'assertLanza') . " | no se lanzó ninguna excepción ($clase)");
}

/** Imprime el resumen y devuelve el código de salida (0 = todo verde). */
function resumenUnit(): int
{
    $p = $GLOBALS['__test']['pass'];
    $f = $GLOBALS['__test']['fail'];
    echo "\n  ── Unit: $p ok, $f fallos ──\n";
    return $f > 0 ? 1 : 0;
}
