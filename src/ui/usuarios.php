<?php require __DIR__ . '/_layout.php'; ui_head('usuarios', 'Usuarios', 'Cuentas de acceso con rol (admin / vendedor / bodeguero). Solo administradores. Baja lógica; nunca se expone el hash.'); ?>

<div style="display:flex;justify-content:flex-end;margin-bottom:16px">
  <button class="btn primary" id="btnNuevo">+ Nuevo usuario</button>
</div>
<div class="panel"><div class="body p0" id="tabla"><div class="empty">Cargando…</div></div></div>

<script>
LM.page(async function () {
  document.getElementById('btnNuevo').onclick = () => form(null);
  const roles = ['admin', 'vendedor', 'bodeguero'];

  async function cargar() {
    const filas = await LM.api.get('/usuarios');
    const cont = document.getElementById('tabla');
    if (!filas.length) { LM.vacio(cont, 'Sin usuarios.'); return; }
    cont.innerHTML = '<table class="tbl"><thead><tr><th>#</th><th>Usuario</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>' +
      filas.map((u) => '<tr' + (Number(u.activo) === 0 ? ' style="opacity:.5"' : '') + '><td class="mono faint">' + u.id_usr + '</td>' +
        '<td><b>' + LM.esc(u.username) + '</b></td>' +
        '<td><span class="chip accent">' + LM.esc(u.rol) + '</span></td>' +
        '<td><span class="chip ' + (Number(u.activo) ? 'ok' : 'danger') + '"><span class="dot"></span>' + (Number(u.activo) ? 'activo' : 'inactivo') + '</span></td>' +
        '<td class="right"><button class="btn ghost sm" data-e="' + u.id_usr + '">Editar</button>' +
        (Number(u.activo) ? ' <button class="btn ghost sm" data-d="' + u.id_usr + '" style="color:var(--danger)">Baja</button>' : '') + '</td>' +
        '</tr>').join('') + '</tbody></table>';
    cont.querySelectorAll('button[data-e]').forEach((b) => b.onclick = () => form(filas.find((x) => x.id_usr == b.getAttribute('data-e'))));
    cont.querySelectorAll('button[data-d]').forEach((b) => b.onclick = () => baja(b.getAttribute('data-d')));
  }

  function form(u) {
    const opts = roles.map((r) => '<option value="' + r + '"' + (u && u.rol === r ? ' selected' : '') + '>' + r + '</option>').join('');
    LM.abrirModal({
      titulo: u ? 'Editar usuario' : 'Nuevo usuario',
      cuerpo: '<div class="field"><label>Usuario</label><input class="input" name="username" value="' + LM.esc(u ? u.username : '') + '"></div>' +
        '<div class="field"><label>Rol</label><select class="input" name="rol">' + opts + '</select></div>' +
        '<div class="field"><label>Contraseña' + (u ? ' (dejar vacío para no cambiar)' : '') + '</label><input class="input" name="password" type="password" placeholder="••••••••"></div>',
      acciones: [
        { txt: 'Cancelar', clase: 'ghost', onClick: () => LM.cerrarModal() },
        { txt: 'Guardar', clase: 'primary', derecha: true, onClick: async (back) => {
          const v = LM.valores(back);
          const payload = { username: v.username, rol: v.rol };
          if (v.password) payload.password = v.password;
          try {
            if (u) await LM.api.put('/usuarios/' + u.id_usr, payload);
            else {
              if (!v.password) return LM.toast('La contraseña es obligatoria.', 'error');
              await LM.api.post('/usuarios', payload);
            }
            LM.cerrarModal(); LM.toast('Usuario guardado.', 'ok'); cargar();
          } catch (e) { LM.toast(e.message, 'error'); }
        } },
      ],
    });
  }

  async function baja(id) {
    if (!confirm('¿Dar de baja el usuario ' + id + '?')) return;
    try { await LM.api.del('/usuarios/' + id); LM.toast('Usuario dado de baja.', 'ok'); cargar(); }
    catch (e) { LM.toast(e.message, 'error'); }
  }

  await cargar();
});
</script>

<?php ui_foot(); ?>
