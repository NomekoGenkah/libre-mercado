<?php
// Puerta de entrada pública: la vitrina del comprador (sin sesión).
// El equipo entra por "Ingresar" → login.php → consola interna (dashboard).
header('Location: tienda.php');
exit;
