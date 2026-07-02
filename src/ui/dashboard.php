<?php require __DIR__ . '/_layout.php'; ui_head('dashboard', 'Panel de operaciones', 'Estado de la red distribuida, métricas del negocio y ranking de ventas.'); ?>

<div class="grid cols-4" id="stats">
  <div class="stat"><span class="kicker">Productos</span><div class="v" id="k-prod">—</div><div class="s">catálogo (central)</div></div>
  <div class="stat"><span class="kicker">Clientes</span><div class="v" id="k-cli">—</div><div class="s">activos</div></div>
  <div class="stat"><span class="kicker">Ventas</span><div class="v" id="k-ven">—</div><div class="s">registradas (2PC)</div></div>
  <div class="stat"><span class="kicker">Ingresos</span><div class="v" id="k-ing">—</div><div class="s">monto acumulado</div></div>
</div>

<div class="grid cols-2" style="margin-top:16px">
  <div class="panel">
    <div class="head"><h3>Topología de la red</h3><span class="chip ok" style="margin-left:auto"><span class="dot"></span>en vivo</span></div>
    <div class="body" id="topo"><div class="empty">Cargando nodos…</div></div>
  </div>
  <div class="panel">
    <div class="head"><h3>Ranking de productos</h3><span class="kicker" style="margin-left:auto">RANK() OVER</span></div>
    <div class="body p0" id="ranking"><div class="empty">Cargando…</div></div>
  </div>
</div>

<script>
LM.page(async function () {
  const [prods, clis, ventas] = await Promise.all([
    LM.api.get('/productos').catch(() => []),
    LM.api.get('/clientes').catch(() => []),
    LM.api.get('/ventas').catch(() => []),
  ]);
  document.getElementById('k-prod').textContent = LM.num(prods.length);
  document.getElementById('k-cli').textContent = LM.num(clis.length);
  document.getElementById('k-ven').textContent = LM.num(ventas.length);
  const ingresos = ventas.reduce((a, v) => a + Number(v.total || 0), 0);
  document.getElementById('k-ing').textContent = LM.money(ingresos);

  // Topología EN VIVO: se actualiza sola por SSE (GET /nodos/stream). Al caer
  // o recuperarse un nodo, el diagrama cambia sin refrescar la página.
  const topo = document.getElementById('topo');
  LM.streamNodos((nodos) => LM.renderTopo(topo, nodos));

  // Ranking
  const rk = document.getElementById('ranking');
  try {
    const filas = await LM.api.get('/reportes/ranking?limit=8');
    if (!filas.length) { LM.vacio(rk, 'Sin ventas todavía.'); return; }
    rk.innerHTML = '<table class="tbl"><thead><tr><th>#</th><th>Producto</th><th class="right">Unidades</th><th class="right">Ingreso</th></tr></thead><tbody>' +
      filas.map((f) => '<tr><td class="mono faint">' + LM.esc(f.ranking) + '</td><td>' + LM.esc(f.producto) +
        '</td><td class="right mono tabular">' + LM.num(f.unidades_vendidas) + '</td><td class="right mono">' + LM.money(f.ingreso_total) + '</td></tr>').join('') +
      '</tbody></table>';
  } catch (e) { LM.vacio(rk, 'No se pudo cargar el ranking.'); }
});
</script>

<?php ui_foot(); ?>
