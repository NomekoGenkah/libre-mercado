<?php require __DIR__ . '/_layout.php'; ui_head('productos', 'Productos', 'Catálogo global en el nodo central. La baja es lógica (activo = 0).'); ?>

<div style="display:flex;justify-content:flex-end;margin-bottom:16px">
  <button class="btn primary" id="btnNuevo" data-role="admin">+ Nuevo producto</button>
</div>
<div class="panel"><div class="body p0" id="tabla"><div class="empty">Cargando…</div></div></div>

<script>
LM.page(async function () {
  const cats = await LM.api.get('/categorias').catch(() => []);
  const puede = LM.tieneRol('admin');
  const btn = document.getElementById('btnNuevo');
  if (btn) btn.onclick = () => form(null);

  async function cargar() {
    const filas = await LM.api.get('/productos?todos=1');
    const cont = document.getElementById('tabla');
    if (!filas.length) { LM.vacio(cont, 'Sin productos.'); return; }
    cont.innerHTML = '<table class="tbl"><thead><tr><th>#</th><th>Producto</th><th>Categoría</th><th class="right">Precio</th><th>Estado</th>' + (puede ? '<th></th>' : '') + '</tr></thead><tbody>' +
      filas.map((p) => '<tr' + (Number(p.activo) === 0 ? ' style="opacity:.5"' : '') + '><td class="mono faint">' + p.id_prod + '</td>' +
        '<td><b>' + LM.esc(p.producto) + '</b><div class="faint" style="font-size:11px">' + LM.esc(p.descripcion || '') + '</div></td>' +
        '<td class="muted">' + LM.esc(p.categoria || '—') + '</td>' +
        '<td class="right mono">' + LM.money(p.precio) + '</td>' +
        '<td><span class="chip ' + (Number(p.activo) ? 'ok' : 'danger') + '"><span class="dot"></span>' + (Number(p.activo) ? 'activo' : 'inactivo') + '</span></td>' +
        (puede ? '<td class="right"><button class="btn ghost sm" data-e="' + p.id_prod + '">Editar</button>' +
          (Number(p.activo) ? ' <button class="btn ghost sm" data-d="' + p.id_prod + '" style="color:var(--danger)">Baja</button>' : '') + '</td>' : '') +
        '</tr>').join('') + '</tbody></table>';
    cont.querySelectorAll('button[data-e]').forEach((b) => b.onclick = () => form(filas.find((x) => x.id_prod == b.getAttribute('data-e'))));
    cont.querySelectorAll('button[data-d]').forEach((b) => b.onclick = () => baja(b.getAttribute('data-d')));
  }

  function form(p) {
    const opts = cats.map((c) => '<option value="' + c.id_cat + '"' + (p && p.id_cat == c.id_cat ? ' selected' : '') + '>' + LM.esc(c.categoria) + '</option>').join('');
    LM.abrirModal({
      titulo: p ? 'Editar producto' : 'Nuevo producto',
      cuerpo: '<div class="field"><label>Nombre</label><input class="input" name="producto" value="' + LM.esc(p ? p.producto : '') + '"></div>' +
        '<div class="field"><label>Precio</label><input class="input" name="precio" type="number" min="0" value="' + (p ? p.precio : '') + '"></div>' +
        '<div class="field"><label>Categoría</label><select class="input" name="id_cat"><option value="">—</option>' + opts + '</select></div>' +
        '<div class="field"><label>Descripción</label><textarea class="input" name="descripcion">' + LM.esc(p ? (p.descripcion || '') : '') + '</textarea></div>',
      acciones: [
        { txt: 'Cancelar', clase: 'ghost', onClick: () => LM.cerrarModal() },
        { txt: 'Guardar', clase: 'primary', derecha: true, onClick: async (back) => {
          const v = LM.valores(back);
          const payload = { producto: v.producto, precio: Number(v.precio), descripcion: v.descripcion, id_cat: v.id_cat ? Number(v.id_cat) : null };
          try {
            if (p) await LM.api.put('/productos/' + p.id_prod, payload);
            else await LM.api.post('/productos', payload);
            LM.cerrarModal(); LM.toast('Producto guardado.', 'ok'); cargar();
          } catch (e) { LM.toast(e.message, 'error'); }
        } },
      ],
    });
  }

  async function baja(id) {
    if (!confirm('¿Dar de baja el producto ' + id + '? (borrado lógico)')) return;
    try { await LM.api.del('/productos/' + id); LM.toast('Producto dado de baja.', 'ok'); cargar(); }
    catch (e) { LM.toast(e.message, 'error'); }
  }

  await cargar();
});
</script>

<?php ui_foot(); ?>
