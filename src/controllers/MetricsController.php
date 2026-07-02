<?php
// ===========================================================================
//  Libre Mercado — MetricsController (exposición Prometheus)
//  GET /metrics (público, text/plain). En CADA scrape calcula las métricas
//  desde el estado de los nodos y desde el nodo central. No guarda contadores
//  en memoria (PHP es sin estado entre peticiones): son gauges "en vivo".
// ===========================================================================

class MetricsController
{
    /** GET /metrics — formato de exposición Prometheus. */
    public function exponer(array $params, array $body): void
    {
        $out = [];
        $metric = function (string $nombre, $valor, string $etiquetas = '') use (&$out): void {
            $out[] = $nombre . ($etiquetas ? '{' . $etiquetas . '}' : '') . ' ' . $valor;
        };

        // --- Salud de la red (lo que la simulación/chaos hace visible) -------
        $out[] = '# TYPE libremercado_nodo_alcanzable gauge';
        $out[] = '# TYPE libremercado_nodo_offline gauge';
        $flags = Database::estadoNodos();
        foreach (Config::nodos() as $nodo) {
            $etq = 'nodo="' . $nodo . '"';
            $metric('libremercado_nodo_alcanzable', Database::pingNodo($nodo) ? 1 : 0, $etq);
            $metric('libremercado_nodo_offline', (($flags[$nodo] ?? 'online') === 'offline') ? 1 : 0, $etq);
        }

        // --- Métricas de negocio (desde el central; si cae, se omiten) -------
        try {
            $c = Database::conectarCentral();
            $out[] = '# TYPE libremercado_ventas_total gauge';
            $metric('libremercado_ventas_total', (int) $c->query("SELECT COUNT(*) FROM ventas")->fetchColumn());
            $out[] = '# TYPE libremercado_ingresos_total gauge';
            $metric('libremercado_ingresos_total', (float) $c->query("SELECT COALESCE(SUM(total),0) FROM ventas")->fetchColumn());
            $out[] = '# TYPE libremercado_productos_activos gauge';
            $metric('libremercado_productos_activos', (int) $c->query("SELECT COUNT(*) FROM productos WHERE activo=1")->fetchColumn());
        } catch (Throwable $e) {
            // Central inalcanzable: exponemos sólo la salud de la red.
        }

        header('Content-Type: text/plain; version=0.0.4; charset=utf-8');
        echo implode("\n", $out) . "\n";
        exit;
    }
}
