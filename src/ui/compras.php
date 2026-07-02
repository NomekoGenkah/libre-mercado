<?php require __DIR__ . '/_layout.php'; ui_head('compras', 'Compras / Reabastecimiento', 'Registra compras a proveedores y aumenta el stock local de la sucursal (transacción local atómica que invoca sp_reponer_stock).'); ?>

<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
  <div style="flex:1"></div>
  <button class="btn primary" id="btnNueva" data-role="bodeguero">+ Nueva compra</button>
</div>

<div class="panel">
  <div class="head"><h3>Historial de compras</h3><span class="kicker" id="caidos" style="margin-left:auto"></span></div>
  <div class="body p0" id="tabla"><div class="empty">Cargando…</div></div>
</div>

<script>
LM.page(async function (user) {
  const btn = document.getElementById('btnNueva');
  if (btn) btn.onclick = nueva;

  async function cargar() {
    const r = await LM.api.get('/compras');
    const compras = r.compras || [];
    document.getElementById('caidos').textContent = (r.nodos_caidos && r.nodos_caidos.length)
      ? 'nodos caídos: ' + r.nodos_caidos.join(', ') : '';
    const cont = document.getElementById('tabla');
    if (!compras.length) { LM.vacio(cont, 'Sin compras registradas.'); return; }
    cont.innerHTML = '<table class="tbl"><thead><tr><th>Folio</th><th>Proveedor</th><th>Sucursal</th><th>Estado</th><th class="right">Total</th><th class="right">Fecha</th></tr></thead><tbody>' +
      compras.map((c) => '<tr><td class="mono" style="color:var(--accent-2)">#' + LM.folio(c.id_compra) + '</td>' +
        '<td>' + LM.esc(c.proveedor || ('prov ' + c.id_prov)) + '</td>' +
        '<td class="mono faint">' + LM.esc(LM.nombreNodo(c.id_suc)) + '</td>' +
        '<td><span class="chip ok"><span class="dot"></span>' + LM.esc(c.estado) + '</span></td>' +
        '<td class="right mono">' + LM.money(c.total) + '</td>' +
        '<td class="right mono faint">' + LM.fechaHora(c.fecha) + '</td></tr>').join('') + '</tbody></table>';
  }

  async function nueva() {
    const [provs, prods] = await Promise.all([
      LM.api.get('/proveedores').catch(() => []),
      LM.api.get('/productos').catch(() => []),
    ]);
    const lineas = [];

    const cuerpo =
      '<div class="field"><label>Proveedor</label><select class="input" name="id_prov"><option value="">— Selecciona —</option>' +
      provs.map((p) => '<option value="' + p.id_prov + '">' + LM.esc(p.proveedor) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Sucursal (nodo)</label><select class="input" name="id_suc"><option value="1">Norte</option><option value="2">Sur</option><option value="3">Este</option></select></div>' +
      '<div class="field"><label>Agregar producto</label><select class="input" id="selProd"><option value="">— Elegir —</option>' +
      prods.map((p) => '<option value="' + p.id_prod + '" data-precio="' + p.precio + '" data-nombre="' + LM.esc(p.producto) + '">' + LM.esc(p.producto) + '</option>').join('') + '</select></div>' +
      '<div id="lineas"></div>';

    const back = LM.abrirModal({
      titulo: 'Nueva compra', subtitulo: 'Aumenta el stock local + registra movimiento de reabastecimiento',
      cuerpo: cuerpo,
      acciones: [
        { txt: 'Cancelar', clase: 'ghost', onClick: () => LM.cerrarModal() },
        { txt: 'Registrar compra', clase: 'primary', derecha: true, onClick: confirmar },
      ],
    });

    const selProd = back.querySelector('#selProd');
    const cont = back.querySelector('#lineas');
    selProd.onchange = function () {
      const id = Number(selProd.value); if (!id) return;
      if (lineas.some((l) => l.id_prod === id)) { LM.toast('Ya agregado.', 'info'); selProd.value = ''; return; }
      const opt = selProd.selectedOptions[0];
      lineas.push({ id_prod: id, producto: opt.getAttribute('data-nombre'), precio: Number(opt.getAttribute('data-precio')), cantidad: 10 });
      selProd.value = ''; render();
    };

    function render() {
      if (!lineas.length) { cont.innerHTML = '<div class="empty" style="padding:18px">Agrega productos a reabastecer.</div>'; return; }
      const total = lineas.reduce((a, l) => a + l.precio * l.cantidad, 0);
      cont.innerHTML = '<table class="tbl"><thead><tr><th>Producto</th><th class="center">Cantidad</th><th class="right">P.compra</th><th class="right">Subtotal</th><th></th></tr></thead><tbody>' +
        lineas.map((l, i) => '<tr><td>' + LM.esc(l.producto) + '</td>' +
          '<td class="center"><input type="number" min="1" value="' + l.cantidad + '" data-c="' + i + '" class="input" style="width:70px;text-align:center;padding:5px"></td>' +
          '<td class="right"><input type="number" min="0" value="' + l.precio + '" data-p="' + i + '" class="input" style="width:100px;text-align:right;padding:5px"></td>' +
          '<td class="right mono">' + LM.money(l.precio * l.cantidad) + '</td>' +
          '<td class="right"><button class="btn ghost sm" data-q="' + i + '">✕</button></td></tr>').join('') +
        '</tbody></table><div class="right" style="margin-top:8px"><span class="kicker">Total</span> <b class="mono" style="font-size:16px">' + LM.money(total) + '</b></div>';
      cont.querySelectorAll('input[data-c]').forEach((inp) => inp.oninput = function () { lineas[Number(inp.getAttribute('data-c'))].cantidad = Math.max(1, Number(inp.value) || 1); render(); });
      cont.querySelectorAll('input[data-p]').forEach((inp) => inp.oninput = function () { lineas[Number(inp.getAttribute('data-p'))].precio = Math.max(0, Number(inp.value) || 0); render(); });
      cont.querySelectorAll('button[data-q]').forEach((b) => b.onclick = function () { lineas.splice(Number(b.getAttribute('data-q')), 1); render(); });
    }

    async function confirmar(back) {
      const v = LM.valores(back);
      if (!v.id_prov) return LM.toast('Selecciona un proveedor.', 'error');
      if (!lineas.length) return LM.toast('Agrega al menos un producto.', 'error');
      const b = back.querySelector('.m-foot .primary'); b.disabled = true; b.textContent = 'Registrando…';
      try {
        const r = await LM.api.post('/compras', {
          id_prov: Number(v.id_prov), id_suc: Number(v.id_suc),
          items: lineas.map((l) => ({ id_prod: l.id_prod, cantidad: l.cantidad, precio_unitario: l.precio })),
        });
        LM.cerrarModal();
        LM.toast('Compra #' + LM.folio(r.id_compra) + ' registrada · ' + LM.money(r.total) + ' · stock aumentado en ' + r.nodo + '.', 'ok');
        cargar();
      } catch (e) { LM.toast(e.message, 'error'); b.disabled = false; b.textContent = 'Registrar compra'; }
    }
    render();
  }

  await cargar();
});
</script>

<?php ui_foot(); ?>
