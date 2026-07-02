<?php header('Content-Type: text/html; charset=utf-8'); ?><!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ingreso · Libre Mercado</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Public+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/styles.css">
<script src="assets/app.js"></script>
</head>
<body>
<div class="login-wrap">
  <form class="login-card" id="form">
    <div class="brand">
      <span class="logo">LM</span>
      <div><b>Libre Mercado</b><small>Consola SD · PHP + AJAX</small></div>
    </div>
    <div class="field">
      <label>Usuario</label>
      <input class="input" name="username" autocomplete="username" value="admin" required>
    </div>
    <div class="field">
      <label>Contraseña</label>
      <input class="input" name="password" type="password" autocomplete="current-password" value="admin123" required>
    </div>
    <button class="btn primary" style="width:100%; justify-content:center" id="btn" type="submit">Ingresar</button>
    <div class="hint">Demo: admin / admin123 · vendedor / vendedor123 · bodeguero / bodeguero123</div>
  </form>
</div>
<script>
document.addEventListener('DOMContentLoaded', function () {
  // Si ya hay sesión viva, saltar directo al panel.
  LM.api.get('/auth/me').then(function () { location.href = 'dashboard.php'; }).catch(function () {});

  var form = document.getElementById('form');
  var btn = document.getElementById('btn');
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var v = LM.valores(form);
    btn.disabled = true; btn.textContent = 'Ingresando…';
    try {
      await LM.api.post('/auth/login', { username: v.username, password: v.password });
      location.href = 'dashboard.php';
    } catch (err) {
      LM.toast(err.message || 'Credenciales inválidas', 'error');
      btn.disabled = false; btn.textContent = 'Ingresar';
    }
  });
});
</script>
</body>
</html>
