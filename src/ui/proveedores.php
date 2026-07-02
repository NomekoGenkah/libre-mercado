<?php require __DIR__ . '/_layout.php'; ui_head('proveedores', 'Proveedores', 'Proveedores para el reabastecimiento. Registro en el nodo central. Baja lógica.'); ?>

<div style="display:flex;justify-content:flex-end;margin-bottom:16px">
  <button class="btn primary" id="btnNuevo" data-role="bodeguero">+ Nuevo proveedor</button>
</div>
<div class="panel"><div class="body p0" id="tabla"><div class="empty">Cargando…</div></div></div>

<script>
LM.page(async function () {
  const puedeEditar = LM.tieneRol('bodeguero');
  const puedeBaja = LM.tieneRol('admin');
  const btn = document.getElementById('btnNuevo');
  if (btn) btn.onclick = () => form(null);

  async function cargar() {
    const filas = await LM.api.get('/proveedores');
    const cont = document.getElementById('tabla');
    if (!filas.length) { LM.vacio(cont, 'Sin proveedores.'); return; }
    cont.innerHTML = '<table class="tbl"><thead><tr><th>#</th><th>Proveedor</th><th>Contacto</th><th>Email</th>' + (puedeEditar ? '<th></th>' : '') + '</tr></thead><tbody>' +
      filas.map((p) => '<tr><td class="mono faint">' + p.id_prov + '</td><td><b>' + LM.esc(p.proveedor) + '</b></td>' +
        '<td class="muted">' + LM.esc(p.contacto || '—') + '</td><td class="mono faint">' + LM.esc(p.email || '—') + '</td>' +
        (puedeEditar ? '<td class="right"><button class="btn ghost sm" data-e="' + p.id_prov + '">Editar</button>' +
          (puedeBaja ? ' <button class="btn ghost sm" data-d="' + p.id_prov + '" style="color:var(--danger)">Baja</button>' : '') + '</td>' : '') +
        '</tr>').join('') + '</tbody></table>';
    cont.querySelectorAll('button[data-e]').forEach((b) => b.onclick = () => form(filas.find((x) => x.id_prov == b.getAttribute('data-e'))));
    cont.querySelectorAll('button[data-d]').forEach((b) => b.onclick = () => baja(b.getAttribute('data-d')));
  }

  function form(p) {
    LM.abrirModal({
      titulo: p ? 'Editar proveedor' : 'Nuevo proveedor',
      cuerpo: '<div class="field"><label>Proveedor</label><input class="input" name="proveedor" value="' + LM.esc(p ? p.proveedor : '') + '"></div>' +
        '<div class="field"><label>Contacto</label><input class="input" name="contacto" value="' + LM.esc(p ? (p.contacto || '') : '') + '"></div>' +
        '<div class="field"><label>Email</label><input class="input" name="email" type="email" value="' + LM.esc(p ? (p.email || '') : '') + '"></div>',
      acciones: [
        { txt: 'Cancelar', clase: 'ghost', onClick: () => LM.cerrarModal() },
        { txt: 'Guardar', clase: 'primary', derecha: true, onClick: async (back) => {
          const v = LM.valores(back);
          try {
            if (p) await LM.api.put('/proveedores/' + p.id_prov, v);
            else await LM.api.post('/proveedores', v);
            LM.cerrarModal(); LM.toast('Proveedor guardado.', 'ok'); cargar();
          } catch (e) { LM.toast(e.message, 'error'); }
        } },
      ],
    });
  }

  async function baja(id) {
    if (!confirm('¿Dar de baja el proveedor ' + id + '?')) return;
    try { await LM.api.del('/proveedores/' + id); LM.toast('Proveedor dado de baja.', 'ok'); cargar(); }
    catch (e) { LM.toast(e.message, 'error'); }
  }

  await cargar();
});
</script>

<?php ui_foot(); ?>
