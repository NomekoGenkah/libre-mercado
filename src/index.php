<?php
// ===========================================================================
//  Libre Mercado — placeholder de la Etapa 1
//  Endpoint temporal de salud para verificar que Apache + PHP responden.
//  Se reemplaza por el router real (src/router.php) en la Etapa 4.
// ===========================================================================

header('Content-Type: application/json; charset=utf-8');

echo json_encode([
    'app'     => 'Libre Mercado',
    'status'  => 'ok',
    'etapa'   => 1,
    'mensaje' => 'Infraestructura PHP operativa. Router pendiente (Etapa 4).',
    'nodos'   => [
        'central' => getenv('CENTRAL_HOST') ?: null,
        'norte'   => getenv('NORTE_HOST') ?: null,
        'sur'     => getenv('SUR_HOST') ?: null,
        'este'    => getenv('ESTE_HOST') ?: null,
    ],
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
