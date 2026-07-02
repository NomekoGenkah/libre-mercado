<?php require __DIR__ . '/_layout.php'; ui_head_publico('Producto'); ?>

<a class="volver" href="tienda.php">← Volver al catálogo</a>
<div id="ficha"><div class="empty">Cargando producto…</div></div>

<script>
LM.pagePublica(async function () {
  const cont = document.getElementById('ficha');
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { LM.vacio(cont, 'Producto no indicado.'); return; }

  let p;
  try {
    p = await LM.api.get('/catalogo/' + encodeURIComponent(id));
  } catch (e) {
    LM.vacio(cont, e.codigo === 404 ? 'Este producto no existe o ya no está disponible.' : 'No se pudo cargar el producto.');
    return;
  }

  const agotado = !!p.agotado;
  cont.className = 'ficha';
  cont.innerHTML =
    '<div class="ficha-media">' + LM.imgProducto(p.id_prod, p.producto) + '</div>' +
    '<div class="ficha-info">' +
      (p.categoria ? '<span class="chip neutral">' + LM.esc(p.categoria) + '</span>' : '') +
      '<h1 class="ficha-name">' + LM.esc(p.producto) + '</h1>' +
      '<div class="ficha-price">' + LM.money(p.precio) + '</div>' +
      '<div class="ficha-avail">' +
        '<span class="chip ' + (agotado ? 'danger' : 'ok') + '"><span class="dot"></span>' + (agotado ? 'Sin stock' : 'Disponible') + '</span>' +
        (agotado ? '' : '<span class="faint">' + LM.num(p.disponible) + ' unidades en bodega</span>') +
      '</div>' +
      (p.descripcion ? '<div class="ficha-desc"><h2>Descripción</h2><p>' + LM.esc(p.descripcion) + '</p></div>' : '') +
      '<div class="ficha-nota">Para concretar tu compra, acércate a una de nuestras sucursales con un vendedor.</div>' +
    '</div>';
});
</script>

<?php ui_foot_publico(); ?>
