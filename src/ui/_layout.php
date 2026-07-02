<?php
// ===========================================================================
//  Libre Mercado — Layout de la consola PHP + AJAX.
//  ui_head(): abre el documento, la barra lateral y la topbar.
//  ui_foot(): cierra el documento. app.js corre el guard de sesión (AJAX).
//  Las páginas son PHP servido por Apache; TODA la data llega por AJAX.
// ===========================================================================

// Marca: figura geométrica (hexágono con gradiente violeta y núcleo recortado).
// Reemplaza el antiguo tile "LM". Reutilizable en sidebar, header público y login.
function ui_logo(): string
{
    return '<svg class="logo-mark" viewBox="0 0 32 32" role="img" aria-label="Libre Mercado">'
        . '<defs><linearGradient id="lm-grad" x1="0" y1="0" x2="1" y2="1">'
        . '<stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#a78bfa"/>'
        . '</linearGradient></defs>'
        . '<path d="M16 1.6 L28.5 8.8 L28.5 23.2 L16 30.4 L3.5 23.2 L3.5 8.8 Z" fill="url(#lm-grad)"/>'
        . '<path d="M16 9.2 L22.7 13.1 L22.7 20.9 L16 24.8 L9.3 20.9 L9.3 13.1 Z" fill="#0b0b12" fill-opacity="0.55"/>'
        . '</svg>';
}

function ui_nav(): array
{
    // grupo => [ [clave, etiqueta, archivo, icono, rol|null], ... ]
    return [
        'Operación' => [
            ['dashboard',   'Panel',       'dashboard.php',   '◧', null],
            ['ventas',      'Ventas',      'ventas.php',      '▦', null],
            ['compras',     'Compras',     'compras.php',     '▽', null],
            ['stock',       'Stock',       'stock.php',       '▤', null],
        ],
        'Catálogo' => [
            ['productos',   'Productos',   'productos.php',   '▣', null],
            ['clientes',    'Clientes',    'clientes.php',    '◍', null],
            ['proveedores', 'Proveedores', 'proveedores.php', '⊞', null],
        ],
        'Sistema distribuido' => [
            ['nodos',       'Nodos de la red', 'nodos.php',    '⬡', 'admin'],
            ['simulador',   'Simulador CAP',   'simulador.php', '△', 'admin'],
            ['usuarios',    'Usuarios',        'usuarios.php',  '◆', 'admin'],
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
<script src="assets/app.js"></script>
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <?= ui_logo() ?>
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

// ===========================================================================
//  Marco de la TIENDA PÚBLICA (mundo del comprador, SIN sesión).
//  Sin barra lateral ni indicadores de infraestructura: nada de la naturaleza
//  distribuida asoma aquí; eso vive en la consola interna. Cabecera con la
//  marca y un acceso discreto al equipo ("Ingresar").
// ===========================================================================
function ui_head_publico(string $title, string $subtitle = ''): void
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
<script src="assets/app.js"></script>
</head>
<body class="pub">
  <header class="pub-head">
    <div class="pub-wrap">
      <a class="pub-brand" href="tienda.php">
        <?= ui_logo() ?>
        <div><b>Libre Mercado</b><small>Tienda en línea</small></div>
      </a>
      <a class="btn ghost" href="login.php">Ingresar</a>
    </div>
  </header>
  <main class="pub-main"><div class="pub-wrap">
<?php
}

function ui_foot_publico(): void
{
    ?>
  </div></main>
  <footer class="pub-foot">
    <div class="pub-wrap">
      <span>Libre Mercado · catálogo en línea.</span>
      <span>¿Eres del equipo? <a href="login.php">Ingresa a la consola</a>.</span>
    </div>
  </footer>
</body>
</html>
<?php
}
