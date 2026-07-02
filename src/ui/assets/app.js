/* ==========================================================================
   Libre Mercado — Motor de la consola PHP + AJAX (vanilla JS, sin frameworks).
   Todas las peticiones son AJAX (fetch) contra la MISMA API JSON del backend,
   mismo origen (:8080), con la cookie de sesión PHP (credentials:'include').
   El backend responde el sobre { ok:true, data } | { ok:false, error }.
   ========================================================================== */
(function () {
  'use strict';

  // -------------------------------------------------------------- AJAX core
  async function pedir(metodo, url, body) {
    const opts = {
      method: metodo,
      credentials: 'include',
      headers: { Accept: 'application/json' },
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(url, opts);
    } catch (e) {
      throw new ApiError('No se pudo contactar la API (¿backend en :8080?).', 0);
    }
    let cuerpo = null;
    try { cuerpo = await res.json(); } catch (e) { /* respuesta sin JSON */ }

    if (cuerpo && typeof cuerpo === 'object' && 'ok' in cuerpo) {
      if (cuerpo.ok) return cuerpo.data;
      throw new ApiError(cuerpo.error || 'Error de la API', res.status, cuerpo.detalle);
    }
    if (!res.ok) throw new ApiError('Error HTTP ' + res.status, res.status);
    return cuerpo;
  }

  function ApiError(mensaje, codigo, detalle) {
    this.message = mensaje; this.codigo = codigo; this.detalle = detalle; this.name = 'ApiError';
  }
  ApiError.prototype = Object.create(Error.prototype);

  const api = {
    get: (u) => pedir('GET', u),
    post: (u, b) => pedir('POST', u, b === undefined ? {} : b),
    put: (u, b) => pedir('PUT', u, b === undefined ? {} : b),
    del: (u) => pedir('DELETE', u),
  };

  // ---------------------------------------------------------- formateadores
  const money = (n) =>
    (Number(n) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  const num = (n) => (Number(n) || 0).toLocaleString('es-CL');
  const folio = (n) => String(n).padStart(4, '0');
  function fechaHora(s) {
    if (!s) return '—';
    const d = new Date(String(s).replace(' ', 'T'));
    if (isNaN(d)) return s;
    return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  const NODOS = { 1: 'Norte', 2: 'Sur', 3: 'Este' };
  const nombreNodo = (idSuc) => NODOS[idSuc] || ('suc ' + idSuc);
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------------------------------------------------------------- toasts
  function toast(msg, tipo) {
    let cont = document.querySelector('.toasts');
    if (!cont) { cont = document.createElement('div'); cont.className = 'toasts'; document.body.appendChild(cont); }
    const t = document.createElement('div');
    t.className = 'toast ' + (tipo || 'info');
    t.textContent = msg;
    cont.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = '0.3s'; setTimeout(() => t.remove(), 300); }, 3600);
  }

  // ---------------------------------------------------------------- modal
  // abrirModal({ titulo, subtitulo, cuerpo(html), acciones:[{txt,clase,onClick}] })
  function abrirModal(cfg) {
    cerrarModal();
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML =
      '<div class="modal" role="dialog">' +
      '<div class="m-head"><h3>' + esc(cfg.titulo || '') + '</h3>' +
      (cfg.subtitulo ? '<p>' + esc(cfg.subtitulo) + '</p>' : '') + '</div>' +
      '<div class="m-body">' + (cfg.cuerpo || '') + '</div>' +
      '<div class="m-foot"></div></div>';
    const foot = back.querySelector('.m-foot');
    (cfg.acciones || []).forEach((a) => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.clase || '');
      b.textContent = a.txt;
      if (a.derecha) b.style.marginLeft = 'auto';
      b.onclick = () => a.onClick(back);
      foot.appendChild(b);
    });
    back.addEventListener('mousedown', (e) => { if (e.target === back) cerrarModal(); });
    document.body.appendChild(back);
    const primer = back.querySelector('input,select,textarea');
    if (primer) primer.focus();
    return back;
  }
  function cerrarModal() { const m = document.querySelector('.modal-back'); if (m) m.remove(); }

  // valores de un form dentro de un contenedor (por name)
  function valores(scope) {
    const o = {};
    scope.querySelectorAll('[name]').forEach((el) => { o[el.name] = el.value; });
    return o;
  }

  // ------------------------------------------------------------ auth guard
  // Corre en cada página protegida: valida sesión vía /auth/me (AJAX). Si no
  // hay sesión -> redirige a login. Aplica visibilidad por rol y pinta el chip.
  async function guard() {
    let u;
    try {
      u = await api.get('/auth/me');
    } catch (e) {
      location.href = 'login.php';
      return null;
    }
    LM.user = u;
    const esAdmin = u.rol === 'admin';
    // ocultar elementos marcados data-role si el rol no coincide (admin pasa todo)
    document.querySelectorAll('[data-role]').forEach((el) => {
      const roles = el.getAttribute('data-role').split(',').map((s) => s.trim());
      if (!esAdmin && !roles.includes(u.rol)) el.remove();
    });
    // chip de usuario
    const chip = document.querySelector('#userchip');
    if (chip) {
      chip.innerHTML =
        '<div class="who"><b>' + esc(u.username) + '</b><small>' + esc(u.rol) + '</small></div>' +
        '<div class="avatar">' + esc((u.username || '?')[0].toUpperCase()) + '</div>' +
        '<button class="btn ghost sm" id="btnLogout" title="Cerrar sesión">Salir</button>';
      document.querySelector('#btnLogout').onclick = logout;
    }
    return u;
  }
  function tieneRol() {
    const roles = Array.prototype.slice.call(arguments);
    if (!LM.user) return false;
    if (LM.user.rol === 'admin') return true;
    return roles.indexOf(LM.user.rol) !== -1;
  }
  async function logout() {
    try { await api.post('/auth/logout'); } catch (e) {}
    location.href = 'login.php';
  }

  // helpers de render
  function loading(el, txt) { el.innerHTML = '<div class="empty">' + esc(txt || 'Cargando…') + '</div>'; }
  function vacio(el, txt) { el.innerHTML = '<div class="empty">' + esc(txt || 'Sin datos') + '</div>'; }

  // Dibuja la topología: nodo central coordinador + fila de sucursales.
  // nodos = [{nodo, rol, estado:'online'|'offline', alcanzable:bool}, ...]
  function renderTopo(el, nodos) {
    const central = nodos.find((n) => n.nodo === 'central') || { nodo: 'central', estado: 'online', alcanzable: true };
    const sucs = nodos.filter((n) => n.nodo !== 'central');
    const box = (n) => {
      const off = n.estado === 'offline' || !n.alcanzable;
      const clase = off ? 'offline' : 'online';
      const etiqueta = n.estado === 'offline' ? 'OFFLINE (simulado)' : (n.alcanzable ? 'online' : 'inalcanzable');
      return '<div class="node-box ' + clase + '"><b>' + esc(n.nodo) + '</b>' +
             '<small>' + esc(n.rol || '') + '</small>' +
             '<span class="chip ' + (off ? 'danger' : 'ok') + '" style="margin-top:6px"><span class="dot"></span>' + etiqueta + '</span></div>';
    };
    el.innerHTML =
      '<div class="topo"><div class="node-box ' + (central.alcanzable ? 'online' : 'offline') + '">' +
      '<b>central</b><small>coordinador 2PC</small></div>' +
      '<div class="link"></div>' +
      '<div class="row">' + sucs.map(box).join('') + '</div></div>';
  }

  // Arranque de página protegida: espera al DOM, valida sesión (guard) y luego
  // ejecuta la lógica de la página con el usuario ya conocido.
  function page(initFn) {
    document.addEventListener('DOMContentLoaded', async function () {
      const u = await guard();
      if (!u) return; // guard ya redirigió a login
      try { await initFn(u); } catch (e) { toast(e.message || 'Error inesperado', 'error'); }
    });
  }

  // exportar
  window.LM = {
    api, ApiError, money, num, folio, fechaHora, nombreNodo, esc, toast,
    abrirModal, cerrarModal, valores, guard, tieneRol, logout, loading, vacio, page,
    renderTopo, user: null,
  };
})();
