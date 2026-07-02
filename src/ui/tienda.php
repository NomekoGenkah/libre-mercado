<?php require __DIR__ . '/_layout.php'; ui_head_publico('Tienda'); ?>

<section class="hero">
  <span class="kicker">Catálogo</span>
  <h1>Todo lo que buscas, <span class="accent-text">disponible ahora</span>.</h1>
  <p>Explora el catálogo y revisa la disponibilidad en tiempo real. Sin registrarte.</p>
</section>

<div class="shop-tools">
  <label class="search">
    <span class="search-ico">◎</span>
    <input class="input" id="q" type="search" placeholder="Buscar productos…" autocomplete="off">
  </label>
  <div class="filtros" id="filtros"></div>
</div>

<div id="aviso"></div>
<div id="grid"><div class="empty">Cargando catálogo…</div></div>

<script>
LM.pagePublica(async function () {
  const grid = document.getElementById('grid');
  const filtros = document.getElementById('filtros');
  const inputQ = document.getElementById('q');

  let datos;
  try {
    datos = await LM.api.get('/catalogo');
  } catch (e) {
    LM.vacio(grid, 'No se pudo cargar el catálogo.');
    return;
  }

  const productos = datos.productos || [];
  if (datos.parcial) {
    document.getElementById('aviso').innerHTML =
      '<div class="aviso-parcial">Algunas sucursales no respondieron; la disponibilidad puede ser parcial.</div>';
  }

  // Categorías presentes (para los filtros).
  const cats = [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort();
  let q = '';
  let cat = null;

  function chip(label, activo, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'filtro' + (activo ? ' on' : '');
    b.textContent = label;
    b.onclick = onClick;
    return b;
  }

  function pintarFiltros() {
    filtros.innerHTML = '';
    filtros.appendChild(chip('Todo', !cat, () => { cat = null; render(); }));
    cats.forEach((c) => filtros.appendChild(chip(c, cat === c, () => { cat = c; render(); })));
  }

  function card(p) {
    const agotado = !!p.agotado;
    return '<a class="prod-card" href="producto.php?id=' + p.id_prod + '">' +
      '<div class="prod-media">' + LM.imgProducto(p.id_prod, p.producto) + '</div>' +
      '<div class="prod-top">' +
        (p.categoria ? '<span class="chip neutral">' + LM.esc(p.categoria) + '</span>' : '<span></span>') +
        '<span class="chip ' + (agotado ? 'danger' : 'ok') + '"><span class="dot"></span>' + (agotado ? 'Agotado' : 'Disponible') + '</span>' +
      '</div>' +
      '<h3 class="prod-name">' + LM.esc(p.producto) + '</h3>' +
      (p.descripcion ? '<p class="prod-desc">' + LM.esc(p.descripcion) + '</p>' : '') +
      '<div class="prod-price">' + LM.money(p.precio) + '</div>' +
      '</a>';
  }

  function render() {
    pintarFiltros();
    const term = q.trim().toLowerCase();
    const visibles = productos.filter((p) => {
      if (cat && p.categoria !== cat) return false;
      if (term && !String(p.producto).toLowerCase().includes(term)) return false;
      return true;
    });
    if (!visibles.length) { LM.vacio(grid, 'Sin resultados. Prueba con otra búsqueda o categoría.'); return; }
    grid.className = 'shop-grid';
    grid.innerHTML = visibles.map(card).join('');
  }

  inputQ.addEventListener('input', function () { q = inputQ.value; render(); });
  render();
});
</script>

<?php ui_foot_publico(); ?>
