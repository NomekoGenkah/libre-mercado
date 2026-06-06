#!/usr/bin/env bash
# ===========================================================================
#  Libre Mercado — Pruebas END-TO-END de la API (curl).
#  Requiere el stack levantado (docker compose up -d). Ejerce el flujo real:
#  salud, login/roles/logout, CRUD, validación (400), duplicados (409),
#  guards de auth (401/403) y el semáforo de stock.
#
#  Ejecutar:  bash tests/e2e/api.sh        (o vía tests/run.sh)
#  Variable:  BASE_URL (por defecto http://localhost:8080)
# ===========================================================================
set -uo pipefail

BASE="${BASE_URL:-http://localhost:8080}"
JAR="$(mktemp)"
BODYFILE="$(mktemp)"
PASS=0
FAIL=0
GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'

# req METODO RUTA [JSON]  -> exporta HTTP (código) y BODY (cuerpo)
req() {
    local metodo="$1" ruta="$2" data="${3:-}"
    if [ -n "$data" ]; then
        HTTP=$(curl -s -o "$BODYFILE" -w '%{http_code}' -b "$JAR" -c "$JAR" \
            -X "$metodo" -H 'Content-Type: application/json' -d "$data" "$BASE$ruta")
    else
        HTTP=$(curl -s -o "$BODYFILE" -w '%{http_code}' -b "$JAR" -c "$JAR" \
            -X "$metodo" "$BASE$ruta")
    fi
    BODY=$(cat "$BODYFILE")
}

check() { # descripción esperado actual
    if [ "$2" = "$3" ]; then
        printf "  ${GREEN}ok${NC}   %s\n" "$1"; PASS=$((PASS + 1))
    else
        printf "  ${RED}FAIL${NC} %s (esperado %s, obtuvo %s)\n       body: %s\n" "$1" "$2" "$3" "$BODY"
        FAIL=$((FAIL + 1))
    fi
}

contiene() { # descripción aguja
    if printf '%s' "$BODY" | grep -q -- "$2"; then
        printf "  ${GREEN}ok${NC}   %s\n" "$1"; PASS=$((PASS + 1))
    else
        printf "  ${RED}FAIL${NC} %s (no contiene '%s')\n       body: %s\n" "$1" "$2" "$BODY"
        FAIL=$((FAIL + 1))
    fi
}

echo ""
echo "== Salud =="
req GET /salud
check "GET /salud -> 200" 200 "$HTTP"

echo "== Autenticación =="
req GET /productos
check "sin sesión, /productos -> 401" 401 "$HTTP"
req POST /auth/login '{"username":"admin","password":"incorrecta"}'
check "login con contraseña mala -> 401" 401 "$HTTP"
req POST /auth/login '{"username":"admin","password":"admin123"}'
check "login admin -> 200" 200 "$HTTP"
req GET /auth/me
check "/auth/me con sesión -> 200" 200 "$HTTP"
contiene "/auth/me devuelve al usuario admin" '"username":"admin"'

echo "== Productos (CRUD + validación) =="
req POST /productos '{"producto":"Producto E2E","precio":1234.5,"id_cat":1}'
check "crear producto -> 201" 201 "$HTTP"
PID=$(printf '%s' "$BODY" | grep -o '"id_prod":[0-9]*' | head -1 | grep -o '[0-9]*$')
req GET "/productos/$PID"
check "obtener producto creado -> 200" 200 "$HTTP"
req PUT "/productos/$PID" '{"precio":999}'
check "actualizar producto -> 200" 200 "$HTTP"
contiene "precio actualizado a 999" '999'
req POST /productos '{"producto":"sin precio"}'
check "crear producto sin precio -> 400" 400 "$HTTP"
req GET "/productos/999999"
check "producto inexistente -> 404" 404 "$HTTP"
req DELETE "/productos/$PID"
check "borrado lógico de producto -> 200" 200 "$HTTP"

echo "== Clientes (duplicado 409) =="
EMAIL="e2e+$(date +%s)@example.com"
req POST /clientes "{\"nombre\":\"Cliente E2E\",\"email\":\"$EMAIL\"}"
check "crear cliente -> 201" 201 "$HTTP"
req POST /clientes "{\"nombre\":\"Otro\",\"email\":\"$EMAIL\"}"
check "email duplicado -> 409" 409 "$HTTP"

echo "== Stock (semáforo) =="
req GET /stock/1
check "stock de sucursal 1 -> 200" 200 "$HTTP"
contiene "incluye campo estado (semáforo)" '"estado"'

# Lee la cantidad de stock de un producto en la sucursal 1 desde $BODY.
# Tolera que PDO serialice los enteros con o sin comillas ("50" o 50).
stock_de() {
    printf '%s' "$BODY" \
        | grep -o "\"id_prod\":\"\\?$1\"\\?,\"id_suc\":\"\\?1\"\\?,\"cantidad\":\"\\?[0-9]*" \
        | grep -o '[0-9]*$'
}

echo "== Venta (transacción distribuida ACID / 2PC) =="
req GET /stock/1; ANTES=$(stock_de 1)
req POST /ventas '{"id_cli":1,"id_suc":1,"items":[{"id_prod":1,"cantidad":2}]}'
check "venta válida -> 201" 201 "$HTTP"
req GET /stock/1; DESPUES=$(stock_de 1)
check "stock bajó exactamente 2 (descuento atómico)" "$((ANTES - 2))" "$DESPUES"

req POST /ventas '{"id_cli":1,"id_suc":1,"items":[{"id_prod":1,"cantidad":99999999}]}'
check "sobreventa -> 409 (sin abrir transacción)" 409 "$HTTP"
req GET /stock/1
check "tras el 409 el stock NO cambió (CP: no se sobrevende)" "$DESPUES" "$(stock_de 1)"

req POST /ventas '{"id_cli":1,"id_suc":1,"items":[]}'
check "venta sin items -> 400" 400 "$HTTP"
req POST /ventas '{"id_cli":999999,"id_suc":1,"items":[{"id_prod":1,"cantidad":1}]}'
check "venta con cliente inexistente -> 404" 404 "$HTTP"

req GET /ventas
check "listar ventas -> 200" 200 "$HTTP"
req GET /movimientos/1
contiene "movimientos incluye tipo 'venta'" '"venta"'

echo "== Compra (reabastecimiento, transacción local ACID) =="
req POST /compras '{"id_prov":1,"id_suc":1,"items":[{"id_prod":1,"cantidad":5,"precio_unitario":20000}]}'
check "reabastecimiento -> 201" 201 "$HTTP"
req GET /stock/1
check "stock subió exactamente 5" "$((DESPUES + 5))" "$(stock_de 1)"
req GET /compras
check "listar compras -> 200" 200 "$HTTP"

echo "== Simulación de fallo CAP (/debug/simular-fallo) =="
req GET /stock/1; CAP_ANTES=$(stock_de 1)
req POST /debug/simular-fallo '{"id_suc":1,"items":[{"id_prod":1,"cantidad":2}]}'
check "simular-fallo -> 200" 200 "$HTTP"
contiene "reporta consistencia_preservada:true" '"consistencia_preservada":true'
contiene "reporta venta_persistida:false (central revirtió)" '"venta_persistida":false'
req GET /stock/1
check "stock intacto tras la simulación (rollback CP)" "$CAP_ANTES" "$(stock_de 1)"

echo "== Roles (403) =="
req POST /auth/login '{"username":"vendedor","password":"vendedor123"}'
check "login vendedor -> 200" 200 "$HTTP"
req POST /productos '{"producto":"x","precio":1}'
check "vendedor NO puede crear producto -> 403" 403 "$HTTP"

echo "== Logout =="
req POST /auth/logout
check "logout -> 200" 200 "$HTTP"
req GET /auth/me
check "tras logout, /auth/me -> 401" 401 "$HTTP"

rm -f "$JAR" "$BODYFILE"
echo ""
echo "  ── E2E: $PASS ok, $FAIL fallos ──"
[ "$FAIL" -eq 0 ]
