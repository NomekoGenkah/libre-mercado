<?php require __DIR__ . '/_layout.php'; ui_head('clientes', 'Clientes', 'Registro de clientes en el nodo central. Baja lógica (activo = 0). Email único.'); ?>

<div style="display:flex;justify-content:flex-end;margin-bottom:16px">
  <button class="btn primary" id="btnNuevo" data-role="vendedor">+ Nuevo cliente</button>
</div>
<div class="panel"><div class="body p0" id="tabla"><div class="empty">Cargando…</div></div></div>

<script>
LM.page(async function () {
  const puedeEditar = LM.tieneRol('vendedor');
  const puedeBaja = LM.tieneRol('admin');
  const btn = document.getElementById('btnNuevo');
  if (btn) btn.onclick = () => form(null);

  async function cargar() {
    const filas = await LM.api.get('/clientes');
    const cont = document.getElementById('tabla');
    if (!filas.length) { LM.vacio(cont, 'Sin clientes.'); return; }
    cont.innerHTML = '<table class="tbl"><thead><tr><th>#</th><th>Nombre</th><th>Email</th><th>Teléfono</th>' + (puedeEditar ? '<th></th>' : '') + '</tr></thead><tbody>' +
      filas.map((c) => '<tr><td class="mono faint">' + c.id_cli + '</td><td><b>' + LM.esc(c.nombre) + '</b></td>' +
        '<td class="muted">' + LM.esc(c.email) + '</td><td class="mono faint">' + LM.esc(c.telefono || '—') + '</td>' +
        (puedeEditar ? '<td class="right"><button class="btn ghost sm" data-e="' + c.id_cli + '">Editar</button>' +
          (puedeBaja ? ' <button class="btn ghost sm" data-d="' + c.id_cli + '" style="color:var(--danger)">Baja</button>' : '') + '</td>' : '') +
        '</tr>').join('') + '</tbody></table>';
    cont.querySelectorAll('button[data-e]').forEach((b) => b.onclick = () => form(filas.find((x) => x.id_cli == b.getAttribute('data-e'))));
    cont.querySelectorAll('button[data-d]').forEach((b) => b.onclick = () => baja(b.getAttribute('data-d')));
  }

  function form(c) {
    LM.abrirModal({
      titulo: c ? 'Editar cliente' : 'Nuevo cliente',
      cuerpo: '<div class="field"><label>Nombre</label><input class="input" name="nombre" value="' + LM.esc(c ? c.nombre : '') + '"></div>' +
        '<div class="field"><label>Email</label><input class="input" name="email" type="email" value="' + LM.esc(c ? c.email : '') + '"></div>' +
        '<div class="field"><label>Teléfono</label><input class="input" name="telefono" value="' + LM.esc(c ? (c.telefono || '') : '') + '"></div>',
      acciones: [
        { txt: 'Cancelar', clase: 'ghost', onClick: () => LM.cerrarModal() },
        { txt: 'Guardar', clase: 'primary', derecha: true, onClick: async (back) => {
          const v = LM.valores(back);
          try {
            if (c) await LM.api.put('/clientes/' + c.id_cli, v);
            else await LM.api.post('/clientes', v);
            LM.cerrarModal(); LM.toast('Cliente guardado.', 'ok'); cargar();
          } catch (e) { LM.toast(e.message, 'error'); }
        } },
      ],
    });
  }

  async function baja(id) {
    if (!confirm('¿Dar de baja el cliente ' + id + '?')) return;
    try { await LM.api.del('/clientes/' + id); LM.toast('Cliente dado de baja.', 'ok'); cargar(); }
    catch (e) { LM.toast(e.message, 'error'); }
  }

  await cargar();
});
</script>

<?php ui_foot(); ?>
