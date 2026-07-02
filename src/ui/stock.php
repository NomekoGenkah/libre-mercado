<?php require __DIR__ . '/_layout.php'; ui_head('stock', 'Stock por sucursal', 'Inventario local de cada nodo. El semáforo (verde/amarillo/rojo) lo calcula la vista v_stock; el ajuste usa el procedimiento sp_actualizar_stock.'); ?>

<div style="display:flex;gap:8px;margin-bottom:16px" id="tabs">
  <button class="btn sm primary" data-suc="1">Norte</button>
  <button class="btn sm" data-suc="2">Sur</button>
  <button class="btn sm" data-suc="3">Este</button>
</div>

<div class="grid cols-2">
  <div class="panel">
    <div class="head"><h3>Inventario</h3><span class="kicker" id="lbl" style="margin-left:auto"></span></div>
    <div class="body p0" id="tabla"><div class="empty">Cargando…</div></div>
  </div>
  <div class="panel">
    <div class="head"><h3>Movimientos recientes</h3></div>
    <div class="body p0" id="movs"><div class="empty">Cargando…</div></div>
  </div>
</div>

<script>
LM.page(async function (user) {
  let idSuc = 1;
  const puedeAjustar = LM.tieneRol('bodeguero');

  document.querySelectorAll('#tabs button').forEach((b) => b.onclick = function () {
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.remove('primary'));
    b.classList.add('primary');
    idSuc = Number(b.getAttribute('data-suc'));
    cargar();
  });

  async function cargar() {
    document.getElementById('lbl').textContent = LM.nombreNodo(idSuc);
    const tabla = document.getElementById('tabla');
    LM.loading(tabla);
    let filas;
    try { filas = await LM.api.get('/stock/' + idSuc); }
    catch (e) { LM.vacio(tabla, e.message); document.getElementById('movs').innerHTML = ''; return; }
    tabla.innerHTML = '<table class="tbl"><thead><tr><th></th><th>Producto</th><th class="right">Cantidad</th><th class="right">Mínimo</th><th class="right">Precio</th>' +
      (puedeAjustar ? '<th></th>' : '') + '</tr></thead><tbody>' +
      filas.map((f) =>
        '<tr><td><span class="dot-estado ' + LM.esc(f.estado) + '"></span></td>' +
        '<td>' + LM.esc(f.producto || ('prod ' + f.id_prod)) + '</td>' +
        '<td class="right mono tabular"' + (f.estado === 'rojo' ? ' style="color:var(--danger)"' : '') + '>' + LM.num(f.cantidad) + '</td>' +
        '<td class="right mono faint">' + LM.num(f.cantidad_minima) + '</td>' +
        '<td class="right mono">' + LM.money(f.precio) + '</td>' +
        (puedeAjustar ? '<td class="right"><button class="btn ghost sm" data-p="' + f.id_prod + '" data-n="' + LM.esc(f.producto) + '" data-c="' + f.cantidad + '">Ajustar</button></td>' : '') +
        '</tr>').join('') + '</tbody></table>';
    tabla.querySelectorAll('button[data-p]').forEach((b) => b.onclick = () =>
      ajustar(Number(b.getAttribute('data-p')), b.getAttribute('data-n'), Number(b.getAttribute('data-c'))));
    cargarMovs();
  }

  async function cargarMovs() {
    const cont = document.getElementById('movs');
    try {
      const movs = await LM.api.get('/movimientos/' + idSuc + '?limit=40');
      if (!movs.length) { LM.vacio(cont, 'Sin movimientos.'); return; }
      const tono = { venta: 'danger', reabastecimiento: 'ok', ajuste: 'accent', devolucion: 'warn' };
      cont.innerHTML = '<table class="tbl"><thead><tr><th>Tipo</th><th>Producto</th><th class="right">Cant.</th><th class="right">Fecha</th></tr></thead><tbody>' +
        movs.map((m) => '<tr><td><span class="chip ' + (tono[m.tipo] || 'neutral') + '">' + LM.esc(m.tipo) + '</span></td>' +
          '<td>' + LM.esc(m.producto || ('prod ' + m.id_prod)) + '</td>' +
          '<td class="right mono">' + LM.num(m.cantidad) + '</td>' +
          '<td class="right mono faint">' + LM.fechaHora(m.fecha) + '</td></tr>').join('') + '</tbody></table>';
    } catch (e) { LM.vacio(cont, e.message); }
  }

  function ajustar(idProd, nombre, actual) {
    LM.abrirModal({
      titulo: 'Ajustar stock',
      subtitulo: nombre + ' · ' + LM.nombreNodo(idSuc),
      cuerpo: '<div class="field"><label>Nueva cantidad (absoluta)</label><input class="input" name="cantidad" type="number" min="0" value="' + actual + '"></div>' +
        '<div class="field"><label>Motivo</label><input class="input" name="motivo" value="Ajuste manual de inventario"></div>' +
        '<div class="hint">Registra un movimiento tipo <b>ajuste</b> con el delta. Ejecuta sp_actualizar_stock (transacción local atómica).</div>',
      acciones: [
        { txt: 'Cancelar', clase: 'ghost', onClick: () => LM.cerrarModal() },
        { txt: 'Guardar', clase: 'primary', derecha: true, onClick: async (back) => {
          const v = LM.valores(back);
          try {
            const r = await LM.api.put('/stock/' + idSuc + '/' + idProd, { cantidad: Number(v.cantidad), motivo: v.motivo });
            LM.cerrarModal();
            LM.toast('Stock actualizado: ' + r.cantidad_anterior + ' → ' + r.cantidad_nueva + ' (Δ ' + r.delta + ')', 'ok');
            cargar();
          } catch (e) { LM.toast(e.message, 'error'); }
        } },
      ],
    });
  }

  await cargar();
});
</script>

<?php ui_foot(); ?>
