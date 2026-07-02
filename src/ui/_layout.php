<?php
// ===========================================================================
//  Libre Mercado — Layout de la consola PHP + AJAX.
//  ui_head(): abre el documento, la barra lateral y la topbar.
//  ui_foot(): cierra el documento. app.js corre el guard de sesión (AJAX).
//  Las páginas son PHP servido por Apache; TODA la data llega por AJAX.
// ===========================================================================

function ui_nav(): array
{
    // grupo => [ [clave, etiqueta, archivo, icono, rol|null], ... ]
    return [
        'Operación' => [
            ['dashboard',   'Panel',       'dashboard.php',   '◧', null],
            ['ventas',      'Ventas',      'ventas.php',      '🧾', null],
            ['compras',     'Compras',     'compras.php',     '📥', null],
            ['stock',       'Stock',       'stock.php',       '▤', null],
        ],
        'Catálogo' => [
            ['productos',   'Productos',   'productos.php',   '📦', null],
            ['clientes',    'Clientes',    'clientes.php',    '👤', null],
            ['proveedores', 'Proveedores', 'proveedores.php', '🏭', null],
        ],
        'Sistema distribuido' => [
            ['nodos',       'Nodos de la red', 'nodos.php',    '⬡', 'admin'],
            ['simulador',   'Simulador CAP',   'simulador.php', '⚡', 'admin'],
            ['usuarios',    'Usuarios',        'usuarios.php',  '🔑', 'admin'],
        ],
    ];
}

function ui_head(string $active, string $title, string $subtitle = ''): void
{
    header('Content-Type: text/html; charset=utf-8');
    ?><!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= htmlspecialchars($title) ?> · Libre Mercado</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Public+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/styles.css">
<script src="assets/app.js" defer></script>
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <span class="logo">LM</span>
      <div><b>Libre Mercado</b><small>Consola SD</small></div>
    </div>
    <nav class="nav">
      <?php foreach (ui_nav() as $grupo => $items): ?>
        <div class="nav-label"><?= htmlspecialchars($grupo) ?></div>
        <?php foreach ($items as [$clave, $etq, $arch, $ico, $rol]): ?>
          <a href="<?= $arch ?>"
             class="<?= $clave === $active ? 'active' : '' ?>"
             <?= $rol ? 'data-role="' . htmlspecialchars($rol) . '"' : '' ?>>
            <span class="ico"><?= $ico ?></span><?= htmlspecialchars($etq) ?>
          </a>
        <?php endforeach; ?>
      <?php endforeach; ?>
    </nav>
  </aside>
  <div class="main">
    <div class="topbar">
      <div class="titles">
        <h1><?= htmlspecialchars($title) ?></h1>
        <?php if ($subtitle): ?><p><?= htmlspecialchars($subtitle) ?></p><?php endif; ?>
      </div>
      <div class="spacer"></div>
      <div class="userchip" id="userchip"></div>
    </div>
    <div class="content">
<?php
}

function ui_foot(): void
{
    ?>
    </div><!-- /content -->
  </div><!-- /main -->
</div><!-- /app -->
</body>
</html>
<?php
}
