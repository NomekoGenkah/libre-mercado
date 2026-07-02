<?php
// ===========================================================================
//  Libre Mercado — ReporteController
//  Reportes de solo lectura sobre el nodo CENTRAL. Apoyan la consola interna
//  (dashboard) y muestran conceptos de BD en acción.
// ===========================================================================

class ReporteController
{
    /**
     * GET /reportes/ranking — productos más vendidos.
     * Lee la vista v_ranking_productos, que calcula el ranking con una
     * FUNCIÓN DE VENTANA (RANK() OVER ...). Filtro opcional ?limit=N.
     */
    public function ranking(array $params, array $body): void
    {
        $limite = max(1, min((int) ($_GET['limit'] ?? 10), 50));
        $central = Database::conectarCentral();
        $filas = $central->query(
            "SELECT id_prod, producto, unidades_vendidas, ingreso_total, ranking
             FROM v_ranking_productos
             ORDER BY ranking
             LIMIT $limite"
        )->fetchAll();

        Response::exito($filas);
    }
}
