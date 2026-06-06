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
