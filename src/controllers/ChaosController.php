<?php
// ===========================================================================
//  Libre Mercado — ChaosController (falla REAL de nodos, no simulada)
//  Le pide al demonio Docker (socket montado en app_php) que apague o encienda
//  el contenedor de una sucursal -> caída REAL del nodo (no simulada). Con el
//  nodo apagado, la venta distribuida no puede confirmar stock y responde 503
//  con ROLLBACK (comportamiento CP).
//  Sólo sucursales (norte|sur|este): no tocamos el central (coordinador).
// ===========================================================================

class ChaosController
{
    /** Nodo lógico -> nombre del contenedor Docker. */
    private const CONTENEDOR = [
        'norte' => 'nodo_sucursal_norte',
        'sur'   => 'nodo_sucursal_sur',
        'este'  => 'nodo_sucursal_este',
    ];

    private const ACCIONES = ['stop', 'start'];

    /** POST /nodos/:nodo/chaos  body {accion:"stop"|"start"} */
    public function ejecutar(array $params, array $body): void
    {
        $nodo = strtolower(trim((string) ($params['nodo'] ?? '')));
        if (!isset(self::CONTENEDOR[$nodo])) {
            Response::error("Nodo '$nodo' inválido para chaos (norte|sur|este).", 400);
        }
        $accion     = Validador::enLista($body['accion'] ?? null, 'accion', self::ACCIONES);
        $contenedor = self::CONTENEDOR[$nodo];

        // escapeshellarg + valores en lista blanca: sin inyección de comandos.
        exec('docker ' . escapeshellarg($accion) . ' ' . escapeshellarg($contenedor) . ' 2>&1', $salida, $codigo);
        if ($codigo !== 0) {
            Response::error(
                "No se pudo ejecutar 'docker $accion $contenedor'. ¿Socket de Docker montado y accesible?",
                500,
                ['salida' => $salida]
            );
        }

        $reales = ['stop' => 'apagado', 'start' => 'encendido'];
        Response::exito([
            'nodo'       => $nodo,
            'contenedor' => $contenedor,
            'accion'     => $accion,
            'mensaje'    => "Contenedor '$contenedor' {$reales[$accion]} (falla real vía Docker).",
        ]);
    }
}
