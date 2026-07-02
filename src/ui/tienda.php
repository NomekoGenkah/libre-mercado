<?php require __DIR__ . '/_layout.php'; ui_head_publico('Tienda'); ?>

<section class="hero">
  <span class="kicker">Catálogo</span>
  <h1>Todo lo que buscas, <span class="accent-text">disponible ahora</span>.</h1>
  <p>Explora el catálogo y revisa la disponibilidad en tiempo real. Sin registrarte.</p>
</section>

<section class="showcase" id="showcase" hidden>
  <div class="showcase-track" id="showcaseTrack"></div>
  <button class="showcase-nav prev" id="showcasePrev" type="button" aria-label="Anterior">‹</button>
  <button class="showcase-nav next" id="showcaseNext" type="button" aria-label="Siguiente">›</button>
  <div class="showcase-dots" id="showcaseDots"></div>
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

  montarShowcase(productos.filter((p) => !p.agotado).slice(0, 6));

  // ---- Grilla + filtros -------------------------------------------------
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

  // ---- Slider de destacados --------------------------------------------
  function montarShowcase(destacados) {
    if (destacados.length < 2) return; // sin slider si no hay suficientes
    const cont = document.getElementById('showcase');
    const track = document.getElementById('showcaseTrack');
    const dots = document.getElementById('showcaseDots');
    cont.hidden = false;

    track.innerHTML = destacados.map((p) =>
      '<article class="slide">' +
        '<div class="slide-media">' + LM.imgProducto(p.id_prod, p.producto) + '</div>' +
        '<div class="slide-info">' +
          (p.categoria ? '<span class="kicker">' + LM.esc(p.categoria) + '</span>' : '') +
          '<h2>' + LM.esc(p.producto) + '</h2>' +
          '<div class="slide-price">' + LM.money(p.precio) + '</div>' +
          '<a class="btn primary" href="producto.php?id=' + p.id_prod + '">Ver producto</a>' +
        '</div>' +
      '</article>'
    ).join('');

    dots.innerHTML = destacados.map((_, i) =>
      '<button type="button" class="' + (i === 0 ? 'on' : '') + '" aria-label="Ir al destacado ' + (i + 1) + '"></button>'
    ).join('');

    let i = 0;
    const total = destacados.length;
    const botones = [...dots.children];
    function ir(n) {
      i = (n + total) % total;
      track.style.transform = 'translateX(-' + (i * 100) + '%)';
      botones.forEach((b, k) => b.classList.toggle('on', k === i));
    }
    botones.forEach((b, k) => b.addEventListener('click', () => { ir(k); reiniciar(); }));
    document.getElementById('showcasePrev').addEventListener('click', () => { ir(i - 1); reiniciar(); });
    document.getElementById('showcaseNext').addEventListener('click', () => { ir(i + 1); reiniciar(); });

    // Autoplay (pausa al pasar el ratón / pestaña oculta / reduce-motion).
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer = null;
    function reiniciar() {
      if (timer) clearInterval(timer);
      if (reduce) return;
      timer = setInterval(() => ir(i + 1), 5000);
    }
    cont.addEventListener('mouseenter', () => { if (timer) clearInterval(timer); });
    cont.addEventListener('mouseleave', reiniciar);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (timer) clearInterval(timer); } else { reiniciar(); }
    });
    reiniciar();
  }
});
</script>

<?php ui_foot_publico(); ?>
