<?php require __DIR__ . '/_layout.php'; ui_head('nodos', 'Nodos de la red', 'Simula la caída de una sucursal (estado OFFLINE) y recupérala reconstruyendo su stock desde el libro de movimientos.'); ?>

<div class="panel">
  <div class="head"><h3>Topología</h3><span class="kicker" style="margin-left:auto">central coordina · sucursales locales</span></div>
  <div class="body" id="topo"><div class="empty">Cargando…</div></div>
</div>

<div class="grid cols-3" id="cards" style="margin-top:16px"></div>

<div class="panel" id="reportePanel" style="margin-top:16px; display:none">
  <div class="head"><h3>Informe de recuperación</h3><span class="kicker" style="margin-left:auto">sp_reconstruir_stock</span></div>
  <div class="body p0" id="reporte"></div>
</div>

<script>
LM.page(async function (user) {
  const esAdmin = user.rol === 'admin';

  async function cargar() {
    const r = await LM.api.get('/nodos');
    LM.renderTopo(document.getElementById('topo'), r.nodos);
    pintarCards(r.nodos.filter((n) => n.simulable));
  }

  function pintarCards(sucs) {
    const cont = document.getElementById('cards');
    cont.innerHTML = sucs.map(function (n) {
      const off = n.estado === 'offline';
      const chip = off
        ? '<span class="chip danger"><span class="dot"></span>OFFLINE (falla simulada)</span>'
        : '<span class="chip ok"><span class="dot"></span>ONLINE</span>';
      const ping = n.alcanzable
        ? '<span class="chip neutral" style="margin-left:6px">contenedor: arriba</span>'
        : '<span class="chip warn" style="margin-left:6px">contenedor: caído</span>';
      const botones = esAdmin ? (
        (off
          ? '<button class="btn sm" data-act="online" data-nodo="' + n.nodo + '">Reactivar</button>'
          : '<button class="btn sm danger" data-act="offline" data-nodo="' + n.nodo + '">Simular falla</button>') +
        ' <button class="btn sm primary" data-act="recuperar" data-nodo="' + n.nodo + '">Recuperar</button>'
      ) : '<span class="faint mono" style="font-size:11px">solo admin</span>';
      return '<div class="panel"><div class="body">' +
        '<div style="display:flex;align-items:center;gap:10px"><b style="font-size:15px;text-transform:capitalize">' + LM.esc(n.nodo) + '</b>' +
        '<span class="kicker">id_suc ' + n.id_suc + '</span></div>' +
        '<div style="margin:10px 0">' + chip + ping + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' + botones + '</div>' +
        '</div></div>';
    }).join('');

    cont.querySelectorAll('button[data-act]').forEach(function (b) {
      b.onclick = () => accion(b.getAttribute('data-act'), b.getAttribute('data-nodo'), b);
    });
  }

  async function accion(act, nodo, btn) {
    btn.disabled = true;
    try {
      if (act === 'recuperar') {
        const r = await LM.api.post('/nodos/' + nodo + '/recuperar');
        LM.toast(r.mensaje, 'ok');
        mostrarReporte(nodo, r);
      } else {
        const estado = act === 'offline' ? 'offline' : 'online';
        const r = await LM.api.post('/nodos/' + nodo + '/estado', { estado: estado });
        LM.toast(r.mensaje, estado === 'offline' ? 'info' : 'ok');
      }
      await cargar();
    } catch (e) {
      LM.toast(e.message, 'error');
      btn.disabled = false;
    }
  }

  function mostrarReporte(nodo, r) {
    const panel = document.getElementById('reportePanel');
    const cont = document.getElementById('reporte');
    panel.style.display = '';
    const filas = (r.reporte || []).map(function (f) {
      const cambio = Number(f.delta) !== 0;
      return '<tr><td class="mono faint">#' + String(f.id_prod).padStart(3, '0') + '</td>' +
        '<td class="right mono tabular">' + LM.num(f.cantidad_antes) + '</td>' +
        '<td class="right mono tabular">' + LM.num(f.cantidad_reconstruida) + '</td>' +
        '<td class="right mono ' + (cambio ? '' : 'faint') + '" style="' + (cambio ? 'color:var(--accent-2)' : '') + '">' +
        (Number(f.delta) > 0 ? '+' : '') + LM.num(f.delta) + '</td></tr>';
    }).join('');
    cont.innerHTML =
      '<div style="padding:12px 16px" class="muted">Nodo <b style="text-transform:capitalize">' + LM.esc(nodo) + '</b> reactivado · ' +
      LM.esc(r.productos_reparados) + ' de ' + LM.esc(r.productos) + ' producto(s) resincronizados desde el ledger.</div>' +
      '<table class="tbl"><thead><tr><th>Producto</th><th class="right">Antes</th><th class="right">Reconstruido</th><th class="right">Δ</th></tr></thead><tbody>' +
      filas + '</tbody></table>';
  }

  await cargar();
});
</script>

<?php ui_foot(); ?>
