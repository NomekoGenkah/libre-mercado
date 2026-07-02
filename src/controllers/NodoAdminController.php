<?php
// ===========================================================================
//  Libre Mercado — NodoAdminController (Tercera Evaluación, Requisito 4)
//  Consola de operaciones de la red distribuida: ver el estado de los nodos,
//  "Simular falla" (marcar una sucursal OFFLINE) y "Recuperar" un nodo
//  (volverlo ONLINE + reconstruir su stock desde el libro de movimientos).
//
//  El estado vive en la tabla `estado_nodos` del nodo CENTRAL. Cuando una
//  sucursal está OFFLINE, Database::conectarSucursal() lanza NodoException
//  (503): las ventas/consultas hacia ese nodo fallan de forma CONTROLADA, tal
//  como exige el comportamiento CP ante una partición.
// ===========================================================================

class NodoAdminController
{
    /** Nodos de sucursal que se pueden apagar/recuperar (el central no). */
    private const SUCURSALES = ['norte', 'sur', 'este'];

    /**
     * GET /nodos — estado de los 4 nodos.
     * Combina el flag configurado (`estado_nodos`) con la reachability REAL
     * (ping), para distinguir "falla simulada" de "contenedor caído".
     */
    public function listar(array $params, array $body): void
    {
        Response::exito(['nodos' => $this->snapshot()]);
    }

    /**
     * GET /nodos/stream — Server-Sent Events: empuja el estado de los nodos
     * cada 2 s para el dashboard "en vivo". Sin frameworks: sólo cabeceras SSE
     * y un bucle que escribe y hace flush. El navegador usa EventSource, que
     * reconecta solo cuando el bucle termina.
     */
    public function stream(array $params, array $body): void
    {
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('X-Accel-Buffering: no');   // no bufferizar detrás de proxies
        session_write_close();             // soltar la sesión: no bloquear otras peticiones
        while (ob_get_level()) { ob_end_flush(); }

        // Máx ~5 min por conexión; EventSource reconecta al cerrarse.
        for ($i = 0; $i < 150 && !connection_aborted(); $i++) {
            Database::olvidarCaches();     // relee estado/reachability frescos
            echo 'data: ' . json_encode(['nodos' => $this->snapshot()]) . "\n\n";
            flush();
            sleep(2);
        }
    }

    /** Estado de los 4 nodos: flag configurado + reachability real (ping). */
    private function snapshot(): array
    {
        $flags = Database::estadoNodos();   // nodo => 'online'|'offline'
        $nodos = [];
        foreach (Config::nodos() as $clave) {
            $nodos[] = [
                'nodo'        => $clave,
                'rol'         => $clave === 'central' ? 'coordinador' : 'sucursal',
                'id_suc'      => $clave === 'central' ? null : Database::idSucursalPorNodo($clave),
                'estado'      => $flags[$clave] ?? 'online',  // flag (falla simulada)
                'alcanzable'  => Database::pingNodo($clave),  // contenedor arriba
                'simulable'   => in_array($clave, self::SUCURSALES, true),
            ];
        }
        return $nodos;
    }

    /**
     * POST /nodos/:nodo/estado — body {estado:"online"|"offline"}.
     * "Simular falla": marca una sucursal OFFLINE (o la reactiva).
     */
    public function cambiarEstado(array $params, array $body): void
    {
        $nodo   = $this->validarNodo($params['nodo'] ?? null);
        $estado = Validador::enLista($body['estado'] ?? null, 'estado', ['online', 'offline']);

        Database::marcarEstadoNodo($nodo, $estado);

        Response::exito([
            'nodo'   => $nodo,
            'estado' => $estado,
            'mensaje' => $estado === 'offline'
                ? "Nodo '$nodo' marcado OFFLINE: las operaciones hacia esta sucursal responderán 503 (falla simulada)."
                : "Nodo '$nodo' reactivado (ONLINE).",
        ]);
    }

    /**
     * POST /nodos/:nodo/recuperar — vuelve el nodo ONLINE y RECONSTRUYE su
     * stock desde el libro de movimientos (sp_reconstruir_stock). Devuelve el
     * informe de sincronización (antes/después por producto).
     */
    public function recuperar(array $params, array $body): void
    {
        $nodo   = $this->validarNodo($params['nodo'] ?? null);
        $id_suc = Database::idSucursalPorNodo($nodo);

        // 1) Reactivar el nodo (si seguía OFFLINE, ahora conectará).
        Database::marcarEstadoNodo($nodo, 'online');

        // 2) Reconstruir el stock desde el ledger. El SP devuelve un result set
        //    con TODAS las filas (antes/después), así que se hace el CALL a mano
        //    para leerlas completas (llamarProc sólo trae la primera).
        try {
            $suc  = Database::conectarSucursal($nodo);
            $stmt = $suc->prepare("CALL sp_reconstruir_stock(?)");
            $stmt->execute([$id_suc]);
            $reporte = $stmt->fetchAll();
            while ($stmt->nextRowset()) {
                // drenar rowsets del CALL
            }
            $stmt->closeCursor();
        } catch (NodoException $e) {
            Response::error("El nodo '$nodo' no está alcanzable (contenedor caído): no se pudo reconstruir.", 503, ['nodo' => $nodo]);
        }

        $reparados = array_values(array_filter($reporte, fn($r) => (int) $r['delta'] !== 0));

        Response::exito([
            'nodo'             => $nodo,
            'id_suc'           => $id_suc,
            'estado'           => 'online',
            'productos'        => count($reporte),
            'productos_reparados' => count($reparados),
            'reparaciones'     => $reparados,   // sólo los que cambiaron
            'reporte'          => $reporte,     // todos (antes/después/delta)
            'mensaje'          => count($reparados) > 0
                ? "Nodo '$nodo' recuperado: " . count($reparados) . " producto(s) resincronizados desde el libro de movimientos."
                : "Nodo '$nodo' recuperado: el stock ya estaba consistente con el libro de movimientos.",
        ]);
    }

    /** Valida que :nodo sea una sucursal simulable (norte|sur|este). */
    private function validarNodo(?string $nodo): string
    {
        $nodo = strtolower(trim((string) $nodo));
        if (!in_array($nodo, self::SUCURSALES, true)) {
            Response::error("Nodo '$nodo' inválido. Sucursales válidas: norte, sur, este.", 400);
        }
        return $nodo;
    }
}
