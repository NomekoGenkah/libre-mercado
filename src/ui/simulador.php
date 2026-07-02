<?php require __DIR__ . '/_layout.php'; ui_head('simulador', 'Simulador de fallo distribuido (CAP)', 'Reproduce una venta que falla justo DESPUÉS de descontar el stock y ANTES del COMMIT. Demuestra el comportamiento CP: rollback total en ambos nodos, sin sobreventa. Nada se persiste.'); ?>

<div class="grid cols-2">
  <div class="panel">
    <div class="head"><h3>Parámetros</h3></div>
    <div class="body">
      <div class="field"><label>Sucursal objetivo (nodo a "caer")</label>
        <select class="input" id="idSuc"><option value="1">Norte</option><option value="2">Sur</option><option value="3">Este</option></select></div>
      <div class="field"><label>Cliente</label><select class="input" id="idCli"></select></div>
      <div class="field"><label>Producto</label><select class="input" id="idProd"><option value="">Cargando…</option></select></div>
      <div class="field"><label>Cantidad</label><input class="input" id="cant" type="number" min="1" value="1"></div>
      <button class="btn primary" id="btnRun" style="width:100%;justify-content:center">⚡ Ejecutar simulación</button>
      <div class="hint">Operación segura: el backend lanza una excepción controlada y revierte todo. El stock real no cambia.</div>
    </div>
  </div>

  <div class="panel">
    <div class="head"><h3>Veredicto</h3></div>
    <div class="body" id="veredicto"><div class="empty">Configura y ejecuta para ver el resultado.</div></div>
  </div>
</div>

<div class="grid cols-2" style="margin-top:16px">
  <div class="panel"><div class="head"><h3>Timeline de ejecución</h3></div><div class="body" id="timeline"><div class="empty">—</div></div></div>
  <div class="panel"><div class="head"><h3>Stock · antes / durante / después</h3></div><div class="body p0" id="stock"><div class="empty">—</div></div></div>
</div>

<script>
LM.page(async function () {
  const $ = (id) => document.getElementById(id);
  const clientes = await LM.api.get('/clientes').catch(() => []);
  $('idCli').innerHTML = clientes.map((c) => '<option value="' + c.id_cli + '">' + LM.esc(c.nombre) + '</option>').join('');

  async function cargarStock() {
    const s = await LM.api.get('/stock/' + $('idSuc').value).catch(() => []);
    const disp = s.filter((x) => Number(x.cantidad) > 0);
    $('idProd').innerHTML = disp.length
      ? disp.map((x) => '<option value="' + x.id_prod + '">' + LM.esc(x.producto) + ' · stock ' + x.cantidad + '</option>').join('')
      : '<option value="">Sin stock</option>';
  }
  $('idSuc').onchange = cargarStock;

  $('btnRun').onclick = async function () {
    const btn = $('btnRun'); btn.disabled = true; btn.textContent = 'Ejecutando…';
    try {
      const body = {
        id_cli: Number($('idCli').value) || 1,
        id_suc: Number($('idSuc').value),
        items: $('idProd').value ? [{ id_prod: Number($('idProd').value), cantidad: Math.max(1, Number($('cant').value) || 1) }] : undefined,
      };
      const r = await LM.api.post('/debug/simular-fallo', body);
      pintar(r);
      LM.toast(r.consistencia_preservada ? 'Consistencia preservada: rollback total, sin sobreventa.' : '¡Inconsistencia detectada!', r.consistencia_preservada ? 'ok' : 'error');
    } catch (e) { LM.toast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '⚡ Ejecutar simulación'; }
  };

  function pintar(r) {
    const ok = r.consistencia_preservada;
    $('veredicto').innerHTML =
      '<div style="border-left:3px solid var(--' + (ok ? 'ok' : 'danger') + ');padding-left:14px">' +
      '<span class="kicker">Resultado</span><div style="font-size:22px;font-weight:800;color:var(--' + (ok ? 'ok' : 'danger') + ')">' +
      (ok ? 'CONSISTENCIA PRESERVADA' : 'INCONSISTENCIA') + '</div>' +
      '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<span class="chip ' + (r.venta_persistida ? 'danger' : 'ok') + '"><span class="dot"></span>Venta ' + (r.venta_persistida ? 'persistida' : 'no registrada') + '</span>' +
      '<span class="chip ' + (r.rollback && r.rollback.central === 'ejecutado' ? 'ok' : 'neutral') + '">Rollback central</span>' +
      '<span class="chip ' + (r.rollback && r.rollback.sucursal === 'ejecutado' ? 'ok' : 'neutral') + '">Rollback sucursal</span></div>' +
      '<p class="muted" style="margin-top:12px;font-size:13px">' + LM.esc(r.explicacion_CP || '') + '</p>' +
      '<p class="mono faint" style="font-size:11px;margin-top:8px">punto_de_fallo: ' + LM.esc(r.punto_de_fallo || '') + '</p></div>';

    $('timeline').innerHTML = '<ul class="tl">' + (r.timeline || []).map(function (p) {
      const fail = /⚠|excep|fallo/i.test(p.accion + p.resultado);
      const rb = /rollback/i.test(p.accion);
      return '<li class="' + (fail ? 'fail' : rb ? 'rb' : '') + '"><b' + (fail ? ' style="color:var(--danger)"' : '') + '>' + LM.esc(p.accion) + '</b><p>' + LM.esc(p.resultado) + '</p></li>';
    }).join('') + '</ul>';

    const s = r.stock || {};
    const idx = {};
    (s.antes || []).forEach((x) => (idx[x.id_prod] = { id_prod: x.id_prod, antes: x.cantidad }));
    (s.durante_transaccion || []).forEach((x) => (idx[x.id_prod] = Object.assign(idx[x.id_prod] || { id_prod: x.id_prod }, { durante: x.cantidad })));
    (s.despues_rollback || []).forEach((x) => (idx[x.id_prod] = Object.assign(idx[x.id_prod] || { id_prod: x.id_prod }, { despues: x.cantidad })));
    const filas = Object.values(idx).map(function (f) {
      const rest = f.antes === f.despues;
      return '<tr><td class="mono faint">#' + String(f.id_prod).padStart(3, '0') + '</td>' +
        '<td class="right mono">' + LM.num(f.antes) + '</td>' +
        '<td class="right mono" style="color:var(--warn)">' + LM.num(f.durante) + '</td>' +
        '<td class="right mono" style="color:var(--' + (rest ? 'ok' : 'danger') + ')">' + LM.num(f.despues) + (rest ? ' ↺' : '') + '</td></tr>';
    }).join('');
    $('stock').innerHTML = '<table class="tbl"><thead><tr><th>Prod</th><th class="right">Antes</th><th class="right">Durante</th><th class="right">Después</th></tr></thead><tbody>' + filas + '</tbody></table>';
  }

  await cargarStock();
});
</script>

<?php ui_foot(); ?>
