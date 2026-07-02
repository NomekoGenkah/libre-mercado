<?php require __DIR__ . '/_layout.php'; ui_head('ventas', 'Ventas', 'Cada venta es una transacción distribuida (2PC): cabecera en el central y descuento de stock en la sucursal, vía procedimientos almacenados.'); ?>

<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
  <div class="grid cols-3" style="flex:1">
    <div class="stat"><span class="kicker">Ventas</span><div class="v" id="k-n">—</div></div>
    <div class="stat"><span class="kicker">Monto acumulado</span><div class="v" id="k-t">—</div></div>
    <div class="stat"><span class="kicker">Patrón</span><div class="v" style="font-size:20px">2PC + SP</div><div class="s">sp_registrar_venta · sp_realizar_compra</div></div>
  </div>
  <button class="btn primary" id="btnNueva" data-role="vendedor">+ Nueva venta</button>
</div>

<div class="panel">
  <div class="head"><h3>Historial de ventas</h3></div>
  <div class="body p0" id="tabla"><div class="empty">Cargando…</div></div>
</div>

<script>
LM.page(async function (user) {
  const btn = document.getElementById('btnNueva');
  if (btn) btn.onclick = nuevaVenta;

  async function cargar() {
    const ventas = await LM.api.get('/ventas');
    document.getElementById('k-n').textContent = LM.num(ventas.length);
    document.getElementById('k-t').textContent = LM.money(ventas.reduce((a, v) => a + Number(v.total || 0), 0));
    const cont = document.getElementById('tabla');
    if (!ventas.length) { LM.vacio(cont, 'Aún no hay ventas. Registra la primera para ver el flujo distribuido.'); return; }
    cont.innerHTML = '<table class="tbl"><thead><tr><th>Folio</th><th>Cliente</th><th>Sucursal</th><th>Estado</th><th class="right">Total</th><th class="right">Fecha</th><th></th></tr></thead><tbody>' +
      ventas.map((v) =>
        '<tr><td class="mono" style="color:var(--accent-2)">#' + LM.folio(v.id_venta) + '</td>' +
        '<td>' + LM.esc(v.cliente || ('cli ' + v.id_cli)) + '</td>' +
        '<td class="mono faint">' + LM.esc(LM.nombreNodo(v.id_suc)) + '</td>' +
        '<td><span class="chip ok"><span class="dot"></span>' + LM.esc(v.estado) + '</span></td>' +
        '<td class="right mono">' + LM.money(v.total) + '</td>' +
        '<td class="right mono faint">' + LM.fechaHora(v.fecha) + '</td>' +
        '<td class="right"><button class="btn ghost sm" data-id="' + v.id_venta + '">Detalle</button></td></tr>'
      ).join('') + '</tbody></table>';
    cont.querySelectorAll('button[data-id]').forEach((b) => b.onclick = () => detalle(b.getAttribute('data-id')));
  }

  async function detalle(id) {
    try {
      const v = await LM.api.get('/ventas/' + id);
      const items = (v.items || []).map((it) =>
        '<tr><td>' + LM.esc(it.producto || ('prod ' + it.id_prod)) + '</td><td class="center mono">' + it.cantidad +
        '</td><td class="right mono">' + LM.money(it.precio_unitario) + '</td><td class="right mono">' + LM.money(it.subtotal) + '</td></tr>').join('');
      LM.abrirModal({
        titulo: 'Venta #' + LM.folio(id),
        subtitulo: 'Cabecera (central) + detalle de líneas',
        cuerpo: '<div class="muted" style="margin-bottom:10px">' + LM.esc(v.cliente || '') + ' · ' + LM.esc(LM.nombreNodo(v.id_suc)) + ' · ' + LM.fechaHora(v.fecha) + '</div>' +
          '<table class="tbl"><thead><tr><th>Producto</th><th class="center">Cant.</th><th class="right">P.unit</th><th class="right">Subtotal</th></tr></thead><tbody>' +
          items + '</tbody></table><div class="right" style="margin-top:10px"><span class="kicker">Total</span> <b class="mono" style="font-size:16px">' + LM.money(v.total) + '</b></div>',
        acciones: [{ txt: 'Cerrar', clase: 'ghost', derecha: true, onClick: () => LM.cerrarModal() }],
      });
    } catch (e) { LM.toast(e.message, 'error'); }
  }

  async function nuevaVenta() {
    const clientes = await LM.api.get('/clientes').catch(() => []);
    const lineas = []; // {id_prod, producto, precio, cantidad, max}
    let stockActual = [];

    const cuerpo =
      '<div class="field"><label>Cliente</label><select class="input" name="id_cli">' +
      '<option value="">— Selecciona —</option>' +
      clientes.map((c) => '<option value="' + c.id_cli + '">' + LM.esc(c.nombre) + '</option>').join('') +
      '</select></div>' +
      '<div class="field"><label>Sucursal (nodo)</label><select class="input" name="id_suc">' +
      '<option value="1">Norte</option><option value="2">Sur</option><option value="3">Este</option></select></div>' +
      '<div class="field"><label>Agregar producto (con stock)</label><select class="input" id="selProd"><option value="">Cargando stock…</option></select></div>' +
      '<div id="lineas"></div>';

    const back = LM.abrirModal({
      titulo: 'Nueva venta',
      subtitulo: 'Two-Phase Commit · rollback total si la sucursal no confirma',
      cuerpo: cuerpo,
      acciones: [
        { txt: 'Cancelar', clase: 'ghost', onClick: () => LM.cerrarModal() },
        { txt: 'Confirmar venta', clase: 'primary', derecha: true, onClick: confirmar },
      ],
    });

    const selSuc = back.querySelector('[name=id_suc]');
    const selProd = back.querySelector('#selProd');
    const cont = back.querySelector('#lineas');

    async function cargarStock() {
      lineas.length = 0; render();
      selProd.innerHTML = '<option value="">Cargando stock…</option>';
      stockActual = await LM.api.get('/stock/' + selSuc.value).catch(() => []);
      const disp = stockActual.filter((s) => Number(s.cantidad) > 0);
      selProd.innerHTML = '<option value="">' + (disp.length ? '— Elegir producto —' : 'Sin stock disponible') + '</option>' +
        disp.map((s) => '<option value="' + s.id_prod + '">' + LM.esc(s.producto) + ' · ' + LM.money(s.precio) + ' · stock ' + s.cantidad + '</option>').join('');
    }
    selSuc.onchange = cargarStock;
    selProd.onchange = function () {
      const id = Number(selProd.value); if (!id) return;
      if (lineas.some((l) => l.id_prod === id)) { LM.toast('Ese producto ya está en la venta.', 'info'); selProd.value = ''; return; }
      const s = stockActual.find((x) => Number(x.id_prod) === id);
      lineas.push({ id_prod: id, producto: s.producto, precio: Number(s.precio), cantidad: 1, max: Number(s.cantidad) });
      selProd.value = ''; render();
    };

    function render() {
      if (!lineas.length) { cont.innerHTML = '<div class="empty" style="padding:18px">Carrito vacío · agrega productos arriba</div>'; return; }
      const total = lineas.reduce((a, l) => a + l.precio * l.cantidad, 0);
      cont.innerHTML = '<table class="tbl"><thead><tr><th>Producto</th><th class="right">Precio</th><th class="center">Cant.</th><th class="right">Subtotal</th><th></th></tr></thead><tbody>' +
        lineas.map((l, i) =>
          '<tr><td>' + LM.esc(l.producto) + '</td><td class="right mono">' + LM.money(l.precio) + '</td>' +
          '<td class="center"><input type="number" min="1" max="' + l.max + '" value="' + l.cantidad + '" data-i="' + i + '" class="input" style="width:64px;text-align:center;padding:5px"></td>' +
          '<td class="right mono">' + LM.money(l.precio * l.cantidad) + '</td>' +
          '<td class="right"><button class="btn ghost sm" data-q="' + i + '">✕</button></td></tr>').join('') +
        '</tbody></table><div class="right" style="margin-top:8px"><span class="kicker">Total</span> <b class="mono" style="font-size:16px">' + LM.money(total) + '</b></div>';
      cont.querySelectorAll('input[data-i]').forEach((inp) => inp.oninput = function () {
        const i = Number(inp.getAttribute('data-i'));
        let v = Math.max(1, Math.min(Number(inp.value) || 1, lineas[i].max));
        lineas[i].cantidad = v; render();
      });
      cont.querySelectorAll('button[data-q]').forEach((b) => b.onclick = function () { lineas.splice(Number(b.getAttribute('data-q')), 1); render(); });
    }

    async function confirmar(back) {
      const v = LM.valores(back);
      if (!v.id_cli) return LM.toast('Selecciona un cliente.', 'error');
      if (!lineas.length) return LM.toast('Agrega al menos un producto.', 'error');
      const b = back.querySelector('.m-foot .primary'); b.disabled = true; b.textContent = 'Procesando…';
      try {
        const r = await LM.api.post('/ventas', {
          id_cli: Number(v.id_cli), id_suc: Number(v.id_suc),
          items: lineas.map((l) => ({ id_prod: l.id_prod, cantidad: l.cantidad })),
        });
        LM.cerrarModal();
        LM.toast('Venta #' + LM.folio(r.id_venta) + ' confirmada · ' + LM.money(r.total) + ' · COMMIT en ' + r.nodo + ' + central.', 'ok');
        cargar();
      } catch (err) {
        // 409 = stock insuficiente; 503 = nodo OFFLINE/caído (rollback total)
        LM.toast(err.message, 'error');
        b.disabled = false; b.textContent = 'Confirmar venta';
      }
    }

    cargarStock();
  }

  await cargar();
});
</script>

<?php ui_foot(); ?>
