#!/usr/bin/env bash
# ===========================================================================
#  Libre Mercado — Suite de pruebas (un solo comando).
#  Corre las pruebas MODULARES (unit, dentro del contenedor app_php) y las
#  END-TO-END (e2e, vía curl contra la API). Requiere el stack levantado.
#
#  Uso:   bash tests/run.sh
# ===========================================================================
set -uo pipefail
cd "$(dirname "$0")/.."

BASE="${BASE_URL:-http://localhost:8080}"

echo "============================================================"
echo "  Libre Mercado — Suite de pruebas"
echo "============================================================"

# --- 0. ¿Está la API arriba? ----------------------------------------------
if ! curl -s -o /dev/null --max-time 5 "$BASE/salud"; then
    echo "✗ La API no responde en $BASE"
    echo "  Levanta el stack primero:  docker compose up -d --build"
    exit 1
fi

# --- 1. Pruebas modulares (unit) en el contenedor -------------------------
echo ""
echo ">> Pruebas modulares (unit) — en el contenedor app_php"
UNIT=1
if docker compose exec -T app_php test -f /var/www/tests/unit/run.php 2>/dev/null; then
    docker compose exec -T app_php php /var/www/tests/unit/run.php
    UNIT=$?
else
    echo "  ✗ /var/www/tests no está montado en app_php."
    echo "    Recrea el contenedor para tomar el volumen:  docker compose up -d"
fi

# --- 2. Pruebas end-to-end (e2e) desde el host ----------------------------
echo ""
echo ">> Pruebas end-to-end (e2e) — curl contra $BASE"
bash tests/e2e/api.sh
E2E=$?

# --- Resumen final --------------------------------------------------------
echo ""
echo "============================================================"
if [ "$UNIT" -eq 0 ] && [ "$E2E" -eq 0 ]; then
    echo "  ✓ TODO VERDE (unit + e2e)"
    echo "============================================================"
    exit 0
else
    echo "  ✗ Hubo fallos  (unit=$UNIT, e2e=$E2E)"
    echo "============================================================"
    exit 1
fi
