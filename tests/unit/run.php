<?php
// ===========================================================================
//  Libre Mercado — Pruebas MODULARES (unit) de la lógica PHP pura.
//  Se ejecutan dentro del contenedor app_php (donde ./src está montado en
//  /var/www/html y ./tests en /var/www/tests). No tocan la base de datos:
//  prueban funciones puras (mapeo de nodos y validación de input).
//
//  Ejecutar:  docker compose exec -T app_php php /var/www/tests/unit/run.php
// ===========================================================================

require __DIR__ . '/../lib/harness.php';

// Código fuente bajo prueba (montado en el contenedor).
require '/var/www/html/config/NodoException.php';
require '/var/www/html/config/Database.php';
require '/var/www/html/helpers/Response.php';
require '/var/www/html/helpers/Validador.php';

// ---------------------------------------------------------------------------
//  Database::getNodoPorSucursal — mapeo id_suc -> nodo lógico
// ---------------------------------------------------------------------------
echo "\n== Database::getNodoPorSucursal ==\n";
it('id_suc 1 -> norte', fn() => assertSame('norte', Database::getNodoPorSucursal(1)));
it('id_suc 2 -> sur',   fn() => assertSame('sur',   Database::getNodoPorSucursal(2)));
it('id_suc 3 -> este',  fn() => assertSame('este',  Database::getNodoPorSucursal(3)));
it('id_suc inexistente lanza InvalidArgumentException',
    fn() => assertLanza(InvalidArgumentException::class, fn() => Database::getNodoPorSucursal(99)));

// Inverso: nodo -> id_suc (usado por la recuperación de nodos, Tercera Ev.).
echo "== Database::idSucursalPorNodo ==\n";
it('norte -> id_suc 1', fn() => assertSame(1, Database::idSucursalPorNodo('norte')));
it('sur -> id_suc 2',   fn() => assertSame(2, Database::idSucursalPorNodo('sur')));
it('este -> id_suc 3',  fn() => assertSame(3, Database::idSucursalPorNodo('este')));
it('round-trip id_suc -> nodo -> id_suc',
    fn() => assertSame(2, Database::idSucursalPorNodo(Database::getNodoPorSucursal(2))));
it('nodo inexistente lanza InvalidArgumentException',
    fn() => assertLanza(InvalidArgumentException::class, fn() => Database::idSucursalPorNodo('oeste')));

// ---------------------------------------------------------------------------
//  Validador — camino feliz (devuelve valores normalizados)
// ---------------------------------------------------------------------------
echo "== Validador (entradas válidas) ==\n";
it('entero("5") -> int 5',            fn() => assertSame(5, Validador::entero('5', 'x', 1)));
it('enteroOpc(null) -> null',         fn() => assertSame(null, Validador::enteroOpc(null, 'x')));
it('enteroOpc("7") -> 7',             fn() => assertSame(7, Validador::enteroOpc('7', 'x', 1)));
it('decimal("9.5") -> float 9.5',     fn() => assertSame(9.5, Validador::decimal('9.5', 'x', 0)));
it('texto recorta espacios',          fn() => assertSame('hola', Validador::texto('  hola  ', 'x', 10)));
it('texto opcional vacío -> null',    fn() => assertSame(null, Validador::texto('', 'x', 10, false)));
it('email válido se conserva',        fn() => assertSame('a@b.com', Validador::email('a@b.com', 'x')));
it('enLista acepta valor permitido',  fn() => assertSame('venta', Validador::enLista('venta', 'tipo', ['venta', 'ajuste'])));

// ---------------------------------------------------------------------------
//  Validador — caminos de error (responden 400 y cortan con exit).
//  Como Response::error hace exit, se prueban en un subproceso `php -r` y se
//  inspecciona la salida JSON ({"ok":false,...}).
// ---------------------------------------------------------------------------
echo "== Validador (entradas inválidas -> 400) ==\n";
it('entero("abc") produce ok:false y menciona el campo', function () {
    $out = correrValidacion('Validador::entero("abc", "edad", 1);');
    assertContiene($out, '"ok":false');
    assertContiene($out, 'edad');
});
it('entero("0", min 1) produce ok:false', function () {
    $out = correrValidacion('Validador::entero("0", "cantidad", 1);');
    assertContiene($out, '"ok":false');
});
it('email inválido produce ok:false', function () {
    $out = correrValidacion('Validador::email("no-es-email", "correo");');
    assertContiene($out, '"ok":false');
    assertContiene($out, 'correo');
});
it('texto requerido vacío produce ok:false', function () {
    $out = correrValidacion('Validador::texto("", "nombre", 10, true);');
    assertContiene($out, '"ok":false');
    assertContiene($out, 'nombre');
});
it('enLista con valor fuera de lista produce ok:false', function () {
    $out = correrValidacion('Validador::enLista("explosion", "tipo", ["venta","ajuste"]);');
    assertContiene($out, '"ok":false');
});

exit(resumenUnit());

/**
 * Ejecuta una llamada a Validador en un subproceso PHP y devuelve su salida.
 * Necesario porque Response::error() termina el proceso con exit().
 */
function correrValidacion(string $llamada): string
{
    $php = 'require "/var/www/html/helpers/Response.php";'
         . 'require "/var/www/html/helpers/Validador.php";'
         . $llamada;
    return (string) shell_exec('php -r ' . escapeshellarg($php) . ' 2>&1');
}
