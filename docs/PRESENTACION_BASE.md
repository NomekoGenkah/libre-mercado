# Libre Mercado — Documento Base para Presentación

> Sistema de comercio electrónico distribuido para la asignatura **Sistemas Distribuidos (2026)**, prof. Juan Torres O.  
> Arquitectura **CP** (Consistencia + Tolerancia a Particiones) con 4 nodos MariaDB independientes,  
> Two-Phase Commit "casero" en PHP puro, procedimientos almacenados, y consola **PHP + AJAX** sin frameworks.

---

## Índice

1. [Resumen del proyecto](#1-resumen-del-proyecto)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Arquitectura del sistema](#3-arquitectura-del-sistema)
4. [Modelo de datos distribuido](#4-modelo-de-datos-distribuido)
5. [Infraestructura Docker](#5-infraestructura-docker)
6. [Backend PHP](#6-backend-php)
7. [Capa de conexión PDO y manejo de fallos](#7-capa-de-conexión-pdo-y-manejo-de-fallos)
8. [Router y Front Controller](#8-router-y-front-controller)
9. [Autenticación con sesiones y roles](#9-autenticación-con-sesiones-y-roles)
10. [CRUD distribuido](#10-crud-distribuido)
11. [Transacciones ACID — Two-Phase Commit](#11-transacciones-acid--two-phase-commit)
12. [Procedimientos almacenados](#12-procedimientos-almacenados)
13. [Decisión CAP y simulación de fallo](#13-decisión-cap-y-simulación-de-fallo)
14. [Simulación de caída y recuperación de nodos](#14-simulación-de-caída-y-recuperación-de-nodos)
15. [Chaos real con Docker](#15-chaos-real-con-docker)
16. [Métricas con Prometheus](#16-métricas-con-prometheus)
17. [Frontend PHP + AJAX](#17-frontend-php--ajax)
18. [Pruebas automatizadas](#18-pruebas-automatizadas)
19. [Estructura del repositorio](#19-estructura-del-repositorio)
20. [Guion de defensa (demo en vivo)](#20-guion-de-defensa-demo-en-vivo)

---

## 1. Resumen del proyecto

**Libre Mercado** es un prototipo de e-commerce que no usa una sola base de datos, sino **4 nodos MariaDB distribuidos en una LAN Docker**, orquestados por una capa de aplicación en **PHP puro + PDO**. Simula un entorno real de alta disponibilidad con fragmentación geográfica (sucursales Norte, Sur y Este).

### Evaluaciones cubiertas

| Evaluación | Contenido | Estado |
|---|---|---|
| **2ª Evaluación** | CRUD distribuido, ACID, CAP, PHP/PDO | ✅ Completa |
| **3ª Evaluación** | Procedimientos almacenados, falla simulada + recuperación, consola PHP + AJAX | ✅ Completa |

### Conceptos estrella que demuestra

| Concepto | Dónde se ve |
|---|---|
| **Sistema distribuido real** | 4 MariaDB independientes (uno en servidor remoto) |
| **Fragmentación (sharding)** | Central tiene catálogo/ventas; sucursales tienen stock local |
| **Two-Phase Commit casero** | `VentaController::procesarVenta()` — BEGIN en ambos nodos, COMMIT si todo ok, ROLLBACK si falla |
| **CP vs AP** | Si un nodo no responde, la venta se revierte (nunca sobreventa) |
| **Procedimientos almacenados** | `sp_realizar_compra`, `sp_registrar_venta`, `sp_reconstruir_stock`, etc. |
| **Falla simulada** | Marcar nodo OFFLINE → 503 controlado sin apagar Docker |
| **Recuperación desde ledger** | `sp_reconstruir_stock` reconstruye stock desde `movimientos_stock` |
| **PHP + AJAX sin frameworks** | Consola completa en vanilla PHP + JavaScript fetch |

---

## 2. Stack tecnológico

| Componente | Tecnología | Versión |
|---|---|---|
| Lenguaje backend | **PHP** (puro, sin frameworks, sin Composer) | 8.2 |
| Servidor web | **Apache** con mod_rewrite | — |
| Acceso a datos | **PDO** (PHP Data Objects) con `pdo_mysql` | — |
| Bases de datos | **MariaDB** (4 nodos independientes) | 10.6 |
| Contenedores | **Docker + Docker Compose** | v2 |
| Frontend | **PHP renderizado en servidor + JavaScript vanilla (fetch)** | — |
| Monitoreo | **Prometheus** (scrapea métricas desde la API) | — |
| Red entre nodos | **Docker bridge** (`red_distribuida`) + **Tailscale** para el nodo remoto | — |
| Pruebas | **Bash + curl** (e2e) + **PHP puro** (unitarias) | — |

---

## 3. Arquitectura del sistema

### Topología de la red

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cliente Web (navegador)                      │
│              http://localhost:8080/ui/                          │
└────────────────────────┬────────────────────────────────────────┘
                         │  HTTP + AJAX (fetch, credentials:'include')
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│  app_php (Apache + PHP 8.2)    ← NODO COORDINADOR de la lógica  │
│  - API REST (index.php → router.php → controllers)              │
│  - Consola PHP+AJAX (/ui/)                                      │
│  - Front controller con autoloader, CORS, sesión, excepciones   │
└──────┬──────────┬──────────────┬────────────────┬────────────────┘
       │          │              │                │
       ▼          ▼              ▼                ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│ central  │ │  norte   │ │   sur    │ │    este      │
│ (MariaDB)│ │ (MariaDB)│ │ (MariaDB)│ │  (MariaDB)   │
│          │ │          │ │          │ │ (remoto vía  │
│ catálogo │ │ stock    │ │ stock    │ │  Tailscale)  │
│ clientes │ │ compras  │ │ compras  │ │              │
│ usuarios │ │ carrito  │ │ carrito  │ │              │
│ ventas   │ │ movs     │ │ movs     │ │              │
└──────────┘ └──────────┘ └──────────┘ └──────────────┘
```

### Distribución de datos por nodo

| Nodo | Contenedor Docker | Puerto host | Datos |
|---|---|---|---|
| **Central** | `nodo_central` | `3306` | Catálogo (`productos`, `categorias`), `clientes`, `usuarios`, `proveedores`, `ventas`, `detalle_ventas`, `estado_nodos` |
| **Sucursal Norte** (id_suc=1) | `nodo_sucursal_norte` | `3307` | `stock`, `movimientos_stock`, `compras`, `detalle_compras`, `carrito`, `detalle_carrito` |
| **Sucursal Sur** (id_suc=2) | `nodo_sucursal_sur` | `3308` | Ídem |
| **Sucursal Este** (id_suc=3) | `nodo_sucursal_este` | `3309` | Ídem (puede estar en servidor remoto) |
| **App PHP** | `app_php` | `8080` | API REST + consola PHP/AJAX |

### Comunicación app ↔ nodos

La app PHP (`app_php`) se conecta a los 4 nodos MariaDB mediante PDO. Cada nodo tiene su propio host, puerto, base de datos y credenciales, configurados por variables de entorno:

```
CENTRAL_HOST=nodo_central
NORTE_HOST=nodo_sucursal_norte
SUR_HOST=nodo_sucursal_sur
ESTE_HOST=nodo_sucursal_este
```

Para el nodo **Este remoto** (en otro servidor vía Tailscale), la conexión usa un `socat` que hace forwarding:

```
app_php (contenedor) → host.docker.internal:33060 → socat (host WSL) → 100.73.123.84:3306 (servidor)
```

### Decisión CAP: **CP** (Consistencia + Tolerancia a Particiones)

```php
// NodoException.php — línea 11-25
class NodoException extends RuntimeException
{
    private string $nodo;

    public function __construct(string $nodo, string $mensaje, ?Throwable $previa = null)
    {
        $this->nodo = $nodo;
        parent::__construct($mensaje, 503, $previa);
    }

    public function getNodo(): string
    {
        return $this->nodo;
    }
}
```

```php
// Database.php — línea 49-58
// Falla simulada (Tercera Evaluación, Requisito 4)
if (self::nodoOffline($nodo)) {
    throw new NodoException(
        $nodo,
        "El nodo '$nodo' está marcado OFFLINE (falla simulada). Operación rechazada (CP)."
    );
}
```

**Razonamiento:** En e-commerce la sobreventa es inaceptable. Si un nodo de sucursal no responde durante una venta, la transacción distribuida completa hace rollback. El sistema queda temporalmente indisponible para esa operación, pero el inventario nunca queda inconsistente. La disponibilidad se sacrifica de forma deliberada.

---

## 4. Modelo de datos distribuido

### Nodo Central

```sql
-- central/01_schema.sql (esquema)
CREATE TABLE categorias (
    id_cat INT AUTO_INCREMENT PRIMARY KEY,
    categoria VARCHAR(80) NOT NULL,
    UNIQUE KEY uq_categoria (categoria)
) ENGINE=InnoDB;

CREATE TABLE productos (
    id_prod INT AUTO_INCREMENT PRIMARY KEY,
    producto VARCHAR(150) NOT NULL,
    precio DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    descripcion TEXT NULL,
    id_cat INT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,   -- borrado lógico
    CONSTRAINT fk_prod_categoria FOREIGN KEY (id_cat)
        REFERENCES categorias (id_cat) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE clientes (
    id_cli INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,   -- borrado lógico
    UNIQUE KEY uq_cliente_email (email)
) ENGINE=InnoDB;

CREATE TABLE usuarios (
    id_usr INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(60) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,     -- bcrypt
    rol VARCHAR(40) NOT NULL,                -- 'admin'|'vendedor'|'bodeguero'
    activo TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uq_username (username),
    CONSTRAINT fk_usr_rol FOREIGN KEY (rol) REFERENCES roles (rol)
) ENGINE=InnoDB;

CREATE TABLE ventas (
    id_venta INT AUTO_INCREMENT PRIMARY KEY,
    id_cli INT NOT NULL,
    id_suc INT NOT NULL,                     -- cross-node (sin FK)
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(12,2) NOT NULL,
    estado ENUM('pendiente','completada','anulada') NOT NULL DEFAULT 'completada',
    CONSTRAINT fk_venta_cliente FOREIGN KEY (id_cli) REFERENCES clientes (id_cli)
) ENGINE=InnoDB;

CREATE TABLE detalle_ventas (
    id_detalle INT AUTO_INCREMENT PRIMARY KEY,
    id_venta INT NOT NULL,
    id_prod INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_detventa_venta FOREIGN KEY (id_venta) REFERENCES ventas (id_venta)
) ENGINE=InnoDB;
```

### Nodo Sucursal (idéntico en norte/sur/este)

```sql
-- norte/01_schema.sql (esquema de sucursal)
CREATE TABLE sucursales (
    id_suc INT AUTO_INCREMENT PRIMARY KEY,
    sucursal VARCHAR(120) NOT NULL,
    nodo VARCHAR(60) NOT NULL               -- nombre del contenedor Docker
) ENGINE=InnoDB;

CREATE TABLE stock (
    id_stock INT AUTO_INCREMENT PRIMARY KEY,
    id_prod INT NOT NULL,                    -- cross-node (sin FK)
    id_suc INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 0,
    cantidad_minima INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_stock_prod_suc (id_prod, id_suc)
) ENGINE=InnoDB;

CREATE TABLE movimientos_stock (
    id_mov INT AUTO_INCREMENT PRIMARY KEY,
    id_prod INT NOT NULL,
    id_suc INT NOT NULL,
    tipo ENUM('venta','reabastecimiento','ajuste','devolucion') NOT NULL,
    cantidad INT NOT NULL,
    motivo VARCHAR(200) NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE compras (
    id_compra INT AUTO_INCREMENT PRIMARY KEY,
    id_prov INT NOT NULL,                    -- cross-node
    id_suc INT NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    estado ENUM('pendiente','completada','anulada') DEFAULT 'completada'
) ENGINE=InnoDB;
```

### Vistas del nodo central

```sql
-- central/03_objetos.sql
CREATE OR REPLACE VIEW v_catalogo AS
SELECT p.id_prod, p.producto, p.precio, p.descripcion,
       p.id_cat, c.categoria, p.activo
FROM productos p LEFT JOIN categorias c ON c.id_cat = p.id_cat;

CREATE OR REPLACE VIEW v_ventas AS
SELECT v.id_venta, v.id_cli, c.nombre AS cliente,
       v.id_suc, v.fecha, v.total, v.estado
FROM ventas v LEFT JOIN clientes c ON c.id_cli = v.id_cli;

-- Ranking con FUNCIÓN DE VENTANA (RANK() OVER)
CREATE OR REPLACE VIEW v_ranking_productos AS
SELECT d.id_prod, p.producto,
       SUM(d.cantidad) AS unidades_vendidas,
       SUM(d.cantidad * d.precio_unitario) AS ingreso_total,
       RANK() OVER (ORDER BY SUM(d.cantidad) DESC) AS ranking
FROM detalle_ventas d
JOIN productos p ON p.id_prod = d.id_prod
GROUP BY d.id_prod, p.producto;
```

### Vista de stock con semáforo (en cada sucursal)

```sql
-- norte/03_objetos.sql
CREATE OR REPLACE VIEW v_stock AS
SELECT id_stock, id_prod, id_suc, cantidad, cantidad_minima,
       CASE
           WHEN cantidad <= cantidad_minima       THEN 'rojo'
           WHEN cantidad <= cantidad_minima * 1.5  THEN 'amarillo'
           ELSE 'verde'
       END AS estado
FROM stock;
```

### Trigger de auditoría (en cada sucursal)

```sql
-- norte/03_objetos.sql
CREATE TRIGGER trg_stock_auditoria
AFTER UPDATE ON stock
FOR EACH ROW
BEGIN
    IF OLD.cantidad <> NEW.cantidad THEN
        INSERT INTO stock_auditoria
            (id_stock, id_prod, id_suc, cantidad_anterior, cantidad_nueva)
        VALUES
            (NEW.id_stock, NEW.id_prod, NEW.id_suc, OLD.cantidad, NEW.cantidad);
    END IF;
END;
```

---

## 5. Infraestructura Docker

### Servicios (`docker-compose.yml`)

```yaml
services:
  nodo_central:
    image: mariadb:10.6
    container_name: nodo_central
    environment:
      MARIADB_ROOT_PASSWORD: ${MARIADB_ROOT_PASSWORD}
      MARIADB_DATABASE: ${CENTRAL_DB}
      MARIADB_USER: ${CENTRAL_USER}
      MARIADB_PASSWORD: ${CENTRAL_PASSWORD}
    ports: ["3306:3306"]
    volumes:
      - ./sql/central:/docker-entrypoint-initdb.d:ro
      - central_data:/var/lib/mysql
    healthcheck: *mariadb-healthcheck
    networks: [red_distribuida]

  nodo_sucursal_norte:
    image: mariadb:10.6
    container_name: nodo_sucursal_norte
    ports: ["3307:3306"]
    volumes:
      - ./sql/norte:/docker-entrypoint-initdb.d:ro
      - norte_data:/var/lib/mysql
    # ... mismo patrón para sur y este

  app_php:
    build: .
    container_name: app_php
    ports: ["8080:80"]
    volumes:
      - ./src:/var/www/html
      - ./tests:/var/www/tests:ro
      - /var/run/docker.sock:/var/run/docker.sock  # para ChaosController
    extra_hosts:
      - "host.docker.internal:host-gateway"  # para nodo remoto
    environment:
      # Hosts y credenciales de los 4 nodos
      CENTRAL_HOST: ${CENTRAL_HOST}
      NORTE_HOST: ${NORTE_HOST}
      SUR_HOST: ${SUR_HOST}
      ESTE_HOST: ${ESTE_HOST}
      # ... más variables de entorno
    depends_on:
      nodo_central: { condition: service_healthy }
      nodo_sucursal_norte: { condition: service_healthy }
      nodo_sucursal_sur: { condition: service_healthy }
      nodo_sucursal_este: { condition: service_healthy }
    networks: [red_distribuida]

  prometheus:
    image: prom/prometheus:latest
    ports: ["9090:9090"]
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    networks: [red_distribuida]

networks:
  red_distribuida:
    driver: bridge
    name: red_distribuida
```

### Dockerfile

```dockerfile
FROM php:8.2-apache

# Dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
        iputils-ping default-mysql-client curl ca-certificates

# Cliente Docker (para ChaosController: falla REAL de nodos)
RUN curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-24.0.7.tgz \
    | tar -xz -C /tmp && mv /tmp/docker/docker /usr/local/bin/docker

# www-data en el grupo del socket Docker
ARG DOCKER_GID=1001
RUN usermod -aG "$(getent group "${DOCKER_GID}" | cut -d: -f1)" www-data

# Extensiones PHP
RUN docker-php-ext-install pdo pdo_mysql mysqli

# Apache: mod_rewrite + AllowOverride para el front controller
RUN a2enmod rewrite \
    && sed -ri 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf
```

---

## 6. Backend PHP

### Autoloader y Front Controller (`src/index.php`)

```php
declare(strict_types=1);

// Autoloader por convención de carpetas
spl_autoload_register(function (string $clase): void {
    $dirs = [__DIR__ . '/config', __DIR__ . '/helpers', __DIR__ . '/middleware', __DIR__ . '/controllers'];
    foreach ($dirs as $dir) {
        $archivo = "$dir/$clase.php";
        if (is_file($archivo)) { require_once $archivo; return; }
    }
});

require_once __DIR__ . '/router.php';

// CORS
header("Access-Control-Allow-Origin: $origen");
header('Access-Control-Allow-Credentials: true');
// ... más cabeceras

// Sesión PHP
session_set_cookie_params([
    'lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax',
]);
session_start();

// Manejo global de excepciones
set_exception_handler(function (Throwable $e): void {
    if ($e instanceof NodoException) {
        Response::error($e->getMessage(), 503, ['nodo' => $e->getNodo()]);
    }
    if ($e instanceof InvalidArgumentException) {
        Response::error($e->getMessage(), 400);
    }
    Response::error('Error interno del servidor.', 500);
});

// Parseo del body JSON
$body = [];
$crudo = file_get_contents('php://input');
if ($crudo !== '' && $crudo !== false) {
    $decodificado = json_decode($crudo, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        Response::error('JSON inválido en el cuerpo de la petición.', 400);
    }
    $body = is_array($decodificado) ? $decodificado : [];
}

// Despacho
$router = crearRouter();
$router->despachar($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI'], $body);
```

### .htaccess (front controller)

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
RewriteRule ^ index.php [QSA,L]
```

### Response helper (`src/helpers/Response.php`)

```php
class Response
{
    public static function json($payload, int $codigo = 200): void
    {
        http_response_code($codigo);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function exito($data = null, int $codigo = 200): void
    {
        self::json(['ok' => true, 'data' => $data], $codigo);
    }

    public static function error(string $mensaje, int $codigo = 400, $detalle = null): void
    {
        $payload = ['ok' => false, 'error' => $mensaje];
        if ($detalle !== null) $payload['detalle'] = $detalle;
        self::json($payload, $codigo);
    }
}
```

### Validador (`src/helpers/Validador.php`)

```php
class Validador
{
    public static function entero($valor, string $campo, ?int $min = null): int
    {
        if ($valor === null || $valor === '' || !is_numeric($valor)) {
            Response::error("El campo '$campo' debe ser un número entero.", 400);
        }
        // Validación de enteros, decimales, textos, emails, listas...
    }

    public static function esDuplicado(PDOException $e): bool
    {
        return $e->getCode() === '23000';
    }
    // ... texto(), email(), decimal(), enLista(), etc.
}
```

---

## 7. Capa de conexión PDO y manejo de fallos

### Database (`src/config/Database.php`)

```php
class Database
{
    private const SUCURSAL_A_NODO = [
        1 => 'norte',
        2 => 'sur',
        3 => 'este',
    ];

    private static array $conexiones = [];
    private static ?array $estados = null;

    public static function conectarCentral(): PDO
    {
        return self::conectar('central');
    }

    public static function conectarSucursal(string $nodo): PDO
    {
        if (!in_array($nodo, ['norte', 'sur', 'este'], true)) {
            throw new InvalidArgumentException("Sucursal desconocida: '$nodo'");
        }
        // Falla simulada: nodo OFFLINE → 503
        if (self::nodoOffline($nodo)) {
            throw new NodoException($nodo,
                "El nodo '$nodo' está marcado OFFLINE (falla simulada). Operación rechazada (CP).");
        }
        return self::conectar($nodo);
    }

    public static function getNodoPorSucursal(int $id_suc): string
    {
        if (!isset(self::SUCURSAL_A_NODO[$id_suc])) {
            throw new InvalidArgumentException("No existe nodo para la sucursal id_suc=$id_suc");
        }
        return self::SUCURSAL_A_NODO[$id_suc];
    }

    private static function conectar(string $clave): PDO
    {
        if (isset(self::$conexiones[$clave])) {
            return self::$conexiones[$clave];  // Singleton por request
        }

        $cfg = Config::nodo($clave);
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $cfg['host'], $cfg['port'], $cfg['dbname']);

        $opciones = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_TIMEOUT            => 5,          // fail fast (CP)
        ];

        try {
            $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], $opciones);
        } catch (PDOException $e) {
            throw new NodoException($clave,
                "No se pudo conectar al nodo '$clave' ($cfg[host]:$cfg[port]). " .
                "El nodo podría estar caído o inalcanzable.", $e);
        }

        self::$conexiones[$clave] = $pdo;
        return $pdo;
    }

    // Ejecuta un procedimiento almacenado (CALL) con drenado de rowsets
    public static function llamarProc(PDO $pdo, string $sql, array $params = []): ?array
    {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $fila = $stmt->fetch() ?: null;
        while ($stmt->nextRowset()) { /* descartar rowsets extra */ }
        $stmt->closeCursor();
        return $fila;
    }

    // Estado de nodos (falla simulada)
    public static function estadoNodos(): array
    {
        if (self::$estados !== null) return self::$estados;
        self::$estados = [];
        try {
            $central = self::conectarCentral();
            foreach ($central->query("SELECT nodo, estado FROM estado_nodos")->fetchAll() as $f) {
                self::$estados[$f['nodo']] = $f['estado'];
            }
        } catch (Throwable $e) { /* sin estado -> no bloquear */ }
        return self::$estados;
    }

    public static function nodoOffline(string $nodo): bool
    {
        return (self::estadoNodos()[$nodo] ?? 'online') === 'offline';
    }

    public static function olvidarCaches(): void
    {
        self::$conexiones = [];
        self::$estados = null;
    }

    public static function marcarEstadoNodo(string $nodo, string $estado): void
    {
        $central = self::conectarCentral();
        $stmt = $central->prepare(
            "INSERT INTO estado_nodos (nodo, estado) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE estado = VALUES(estado)");
        $stmt->execute([$nodo, $estado]);
        self::$estados = null;   // forzar relectura
    }

    public static function pingNodo(string $clave): bool
    {
        try {
            self::conectar($clave)->query('SELECT 1');
            return true;
        } catch (Throwable $e) { return false; }
    }
}
```

### Config (`src/config/Config.php`)

```php
class Config
{
    private const PREFIJOS = [
        'central' => 'CENTRAL', 'norte' => 'NORTE',
        'sur' => 'SUR', 'este' => 'ESTE',
    ];

    public static function nodo(string $clave): array
    {
        $p = self::PREFIJOS[$clave];
        return [
            'host'   => self::env("{$p}_HOST"),
            'port'   => (int)(self::env("{$p}_PORT", self::env('DB_PORT', '3306'))),
            'dbname' => self::env("{$p}_DB"),
            'user'   => self::env("{$p}_USER"),
            'pass'   => self::env("{$p}_PASSWORD"),
        ];
    }

    public static function nodos(): array
    {
        return array_keys(self::PREFIJOS);
    }
}
```

---

## 8. Router y Front Controller

### Router (`src/router.php`)

El router es una clase que mapea `MÉTODO /ruta` → `Controller@método`, soporta parámetros con `:nombre`, middleware de auth/roles por ruta, y handlers tipo Closure.

```php
class Router
{
    private array $rutas = [];

    public function agregar(string $metodo, string $patron, $handler, array $opciones = []): void
    {
        $this->rutas[] = [
            'metodo' => strtoupper($metodo),
            'patron' => $patron,
            'handler' => $handler,
            'opciones' => $opciones,
        ];
    }

    public function despachar(string $metodo, string $uri, array $body): void
    {
        $ruta = $this->normalizar($uri);
        foreach ($this->rutas as $r) {
            $params = $this->emparejar($r['patron'], $ruta);
            if ($params === null) continue;
            if ($r['metodo'] !== strtoupper($metodo)) continue;

            AuthMiddleware::aplicar($r['opciones']);
            $this->ejecutar($r['handler'], $params, $body);
            return;
        }
        Response::error("Ruta no encontrada: $metodo $ruta", 404);
    }

    private function emparejar(string $patron, string $ruta): ?array
    {
        $regex = preg_replace('#:([a-zA-Z_]+)#', '(?P<$1>[^/]+)', $patron);
        $regex = '#^' . $regex . '$#';
        if (!preg_match($regex, $ruta, $m)) return null;

        $params = [];
        foreach ($m as $clave => $valor) {
            if (!is_int($clave)) $params[$clave] = $valor;
        }
        return $params;
    }

    private function ejecutar($handler, array $params, array $body): void
    {
        if ($handler instanceof Closure) { $handler($params, $body); return; }

        [$clase, $metodo] = explode('@', $handler);
        if (!class_exists($clase) || !method_exists($clase, $metodo)) {
            Response::error("Endpoint aún no implementado ($clase::$metodo).", 501);
        }
        (new $clase())->$metodo($params, $body);
    }
}
```

### Tabla de rutas completa

```php
function crearRouter(): Router
{
    $r = new Router();

    // Públicas (sin sesión)
    $r->agregar('GET', '/',            fn() => Response::exito([...]));
    $r->agregar('GET', '/salud',       fn() => verificarNodos());
    $r->agregar('GET', '/metrics',     'MetricsController@exponer');
    $r->agregar('POST', '/auth/login', 'AuthController@login');
    $r->agregar('GET', '/catalogo',    'CatalogoController@listar');
    $r->agregar('GET', '/catalogo/:id','CatalogoController@obtener');

    // Requieren sesión (auth)
    $r->agregar('GET',  '/productos',     'ProductoController@listar',   ['auth' => true]);
    $r->agregar('GET',  '/clientes',      'ClienteController@listar',   ['auth' => true]);
    $r->agregar('GET',  '/sucursales',    'SucursalController@listar',  ['auth' => true]);
    $r->agregar('GET',  '/stock/:id_suc', 'StockController@porSucursal',['auth' => true]);
    $r->agregar('GET',  '/ventas',        'VentaController@listar',     ['auth' => true]);
    $r->agregar('GET',  '/ventas/:id',    'VentaController@obtener',    ['auth' => true]);
    $r->agregar('GET',  '/compras',       'CompraController@listar',    ['auth' => true]);
    $r->agregar('GET',  '/nodos',         'NodoAdminController@listar', ['auth' => true]);
    $r->agregar('GET',  '/nodos/stream',  'NodoAdminController@stream', ['auth' => true]);
    $r->agregar('GET',  '/reportes/ranking', 'ReporteController@ranking', ['auth' => true]);

    // Roles específicos
    $r->agregar('POST',   '/productos',     'ProductoController@crear',     ['roles' => ['admin']]);
    $r->agregar('DELETE', '/productos/:id', 'ProductoController@eliminar',  ['roles' => ['admin']]);
    $r->agregar('POST',   '/ventas',        'VentaController@procesarVenta',['roles' => ['admin','vendedor']]);
    $r->agregar('POST',   '/compras',       'CompraController@procesarReabastecimiento', ['roles' => ['admin','bodeguero']]);
    $r->agregar('PUT',    '/stock/:id_suc/:id_prod', 'StockController@ajustar', ['roles' => ['admin','bodeguero']]);
    $r->agregar('POST',   '/nodos/:nodo/estado',    'NodoAdminController@cambiarEstado', ['roles' => ['admin']]);
    $r->agregar('POST',   '/nodos/:nodo/chaos',     'ChaosController@ejecutar',          ['roles' => ['admin']]);
    $r->agregar('POST',   '/nodos/:nodo/recuperar', 'NodoAdminController@recuperar',      ['roles' => ['admin']]);
    $r->agregar('POST',   '/debug/simular-fallo',   'DebugController@simularFallo',       ['roles' => ['admin']]);

    return $r;
}
```

---

## 9. Autenticación con sesiones y roles

### AuthController (`src/controllers/AuthController.php`)

```php
class AuthController
{
    public function login(array $params, array $body): void
    {
        $username = Validador::texto($body['username'] ?? null, 'username', 60);
        $password = Validador::texto($body['password'] ?? null, 'password', 255);

        $central = Database::conectarCentral();
        $stmt = $central->prepare(
            "SELECT id_usr, id_cli, username, password_hash, rol, activo
             FROM usuarios WHERE username = ? AND activo = 1"
        );
        $stmt->execute([$username]);
        $usuario = $stmt->fetch();

        if (!$usuario || !password_verify($password, $usuario['password_hash'])) {
            Response::error('Credenciales inválidas.', 401);   // mensaje genérico
        }

        Auth::iniciarSesion($usuario);
        Response::exito([...]);
    }

    public function logout(array $params, array $body): void
    {
        Auth::cerrarSesion();
        Response::exito(['mensaje' => 'Sesión cerrada.']);
    }

    public function me(array $params, array $body): void
    {
        Response::exito(Auth::usuarioActual());
    }
}
```

### Auth helper (`src/helpers/Auth.php`)

```php
class Auth
{
    public static function iniciarSesion(array $usuario): void
    {
        session_regenerate_id(true);   // mitiga fijación de sesión
        $_SESSION['usuario'] = [
            'id_usr'   => (int)$usuario['id_usr'],
            'username' => $usuario['username'],
            'rol'      => $usuario['rol'],
            'id_cli'   => isset($usuario['id_cli']) ? (int)$usuario['id_cli'] : null,
        ];
    }

    public static function requerirLogin(): void
    {
        if (!isset($_SESSION['usuario'])) {
            Response::error('No autenticado. Inicia sesión.', 401);
        }
    }

    public static function requerirRol(string ...$roles): void
    {
        self::requerirLogin();
        $rol = $_SESSION['usuario']['rol'];
        if ($rol === 'admin' || in_array($rol, $roles, true)) return;
        Response::error('No tienes permisos para esta acción.', 403,
            ['rol_actual' => $rol, 'roles_requeridos' => $roles]);
    }
}
```

### AuthMiddleware (`src/middleware/AuthMiddleware.php`)

```php
class AuthMiddleware
{
    public static function aplicar(array $opciones): void
    {
        $roles = $opciones['roles'] ?? null;
        if (!empty($roles)) {
            Auth::requerirRol(...$roles);
            return;
        }
        if (!empty($opciones['auth'])) {
            Auth::requerirLogin();
        }
    }
}
```

### Credenciales de demo (seed)

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | admin |
| `vendedor` | `vendedor123` | vendedor |
| `bodeguero` | `bodeguero123` | bodeguero |

Los passwords se almacenan con `password_hash('...', PASSWORD_DEFAULT)`, que genera bcrypt.

---

## 10. CRUD distribuido

Cada controller implementa las operaciones CRUD con borrado lógico (`activo=0`). Los controllers de datos centrales (`ProductoController`, `ClienteController`, `UsuarioController`, `ProveedorController`) operan sobre el nodo central. Los controllers de sucursal (`StockController`, `SucursalController`, `CarritoController`) operan sobre los nodos de sucursal según `id_suc`.

### Ejemplo: ProductoController

```php
class ProductoController
{
    public function listar(array $params, array $body): void
    {
        $central = Database::conectarCentral();
        $stmt = $central->query(
            "SELECT p.id_prod, p.producto, p.precio, p.descripcion,
                    p.id_cat, c.categoria, p.activo
             FROM productos p LEFT JOIN categorias c ON c.id_cat = p.id_cat
             ORDER BY p.producto"
        );
        Response::exito($stmt->fetchAll());
    }

    public function crear(array $params, array $body): void
    {
        $producto    = Validador::texto($body['producto'] ?? null, 'producto', 150);
        $precio      = Validador::decimal($body['precio'] ?? null, 'precio', 0);
        $descripcion = Validador::texto($body['descripcion'] ?? null, 'descripcion', 1000, false);
        $id_cat      = Validador::enteroOpc($body['id_cat'] ?? null, 'id_cat');

        $central = Database::conectarCentral();
        $stmt = $central->prepare(
            "INSERT INTO productos (producto, precio, descripcion, id_cat)
             VALUES (?, ?, ?, ?)"
        );
        $stmt->execute([$producto, $precio, $descripcion, $id_cat]);

        Response::exito(['id_prod' => (int)$central->lastInsertId()], 201);
    }

    public function eliminar(array $params, array $body): void
    {
        $id = Validador::entero($params['id'] ?? null, 'id', 1);
        $central = Database::conectarCentral();
        $stmt = $central->prepare("UPDATE productos SET activo=0 WHERE id_prod=?");
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            Response::error("Producto $id no encontrado.", 404);
        }
        Response::exito(['mensaje' => "Producto $id desactivado (borrado lógico)."]);
    }
}
```

### Ejemplo: StockController (sucursal)

```php
class StockController
{
    public function porSucursal(array $params, array $body): void
    {
        $id_suc = Validador::entero($params['id_suc'] ?? null, 'id_suc', 1);
        $nodo = Database::getNodoPorSucursal($id_suc);
        $suc  = Database::conectarSucursal($nodo);

        // v_stock trae el semáforo calculado en la BD
        $stmt = $suc->prepare(
            "SELECT id_stock, id_prod, id_suc, cantidad, cantidad_minima, estado
             FROM v_stock WHERE id_suc = ? ORDER BY id_prod"
        );
        $stmt->execute([$id_suc]);
        $filas = $stmt->fetchAll();

        // Enriquece con nombre/precio desde el catálogo central
        $mapa = ProductoController::mapaPorIds(Database::conectarCentral(),
                    array_column($filas, 'id_prod'));
        foreach ($filas as &$f) {
            $prod = $mapa[(int)$f['id_prod']] ?? null;
            $f['producto'] = $prod['producto'] ?? null;
            $f['precio']   = $prod['precio'] ?? null;
        }
        Response::exito($filas);
    }

    public function ajustar(array $params, array $body): void
    {
        // PUT /stock/:id_suc/:id_prod  — ajuste absoluto vía SP
        $nodo = Database::getNodoPorSucursal($id_suc);
        $suc  = Database::conectarSucursal($nodo);

        $res = Database::llamarProc($suc,
            "CALL sp_actualizar_stock(?, ?, ?, ?)",
            [$id_prod, $id_suc, $nueva, $motivo]
        );
        Response::exito([
            'cantidad_anterior' => (int)$res['cantidad_anterior'],
            'cantidad_nueva'    => (int)$res['cantidad_nueva'],
            'delta'             => (int)$res['delta'],
        ]);
    }
}
```

---

## 11. Transacciones ACID — Two-Phase Commit

### VentaController — Núcleo ACID distribuido

La venta es el corazón del sistema: escribe en **dos nodos a la vez** (central + sucursal). Usa un patrón **Two-Phase Commit (2PC)** "casero" desde PHP:

```php
class VentaController
{
    public function procesarVenta(array $params, array $body): void
    {
        // ------------------------------------------------------------------
        //  FASE 0 — Validación y preparación (SIN transacciones abiertas)
        // ------------------------------------------------------------------
        $id_cli = Validador::entero($body['id_cli'] ?? null, 'id_cli', 1);
        $id_suc = Validador::entero($body['id_suc'] ?? null, 'id_suc', 1);

        // Conexiones: si la sucursal está caída → 503 SIN abrir transacción
        $central = Database::conectarCentral();
        $nodo = Database::getNodoPorSucursal($id_suc);
        $suc  = Database::conectarSucursal($nodo);     // NodoException → 503

        // Validar cliente activo, productos activos, stock suficiente...
        // Si falta stock → 409 sin haber abierto transacción

        // ------------------------------------------------------------------
        //  FASE 1 (prepare) + FASE 2 (commit) — el 2PC
        // ------------------------------------------------------------------
        try {
            $central->beginTransaction();    // BEGIN coordinador
            $suc->beginTransaction();         // BEGIN participante

            // CABECERA DE VENTA vía SP (central)
            $resVenta = Database::llamarProc($central,
                "CALL sp_registrar_venta(?, ?, ?)",
                [$id_cli, $id_suc, $total]
            );
            $id_venta = (int)($resVenta['id_venta'] ?? 0);

            // Por línea: detalle (central) + descuento stock (sucursal)
            foreach ($lineas as $id_prod => $l) {
                Database::llamarProc($central,
                    "CALL sp_agregar_detalle_venta(?, ?, ?, ?)",
                    [$id_venta, $id_prod, $l['cantidad'], $l['precio_unitario']]
                );
                Database::llamarProc($suc,
                    "CALL sp_realizar_compra(?, ?, ?, ?)",
                    [$id_prod, $id_suc, $l['cantidad'], "Venta #$id_venta"]
                );
            }

            // FASE 2: commit (participante primero, luego coordinador)
            $suc->commit();
            $central->commit();

            Response::exito(['id_venta' => $id_venta, ...], 201);

        } catch (Throwable $e) {
            // ROLLBACK en AMBOS nodos
            if ($suc->inTransaction())    $suc->rollBack();
            if ($central->inTransaction()) $central->rollBack();

            if ($e instanceof NodoException) {
                Response::error("Nodo '{$e->getNodo()}' no disponible: venta revertida.", 503);
            }
            // SIGNAL de sp_realizar_compra (stock insuficiente) → 409
            $mysqlErrno = ($e instanceof PDOException) ? (int)($e->errorInfo[1] ?? 0) : 0;
            if (in_array($mysqlErrno, [1643, 1644], true)) {
                Response::error('Stock insuficiente: venta revertida.', 409);
            }
            Response::error('La venta no se completó y fue revertida.', 500);
        }
    }
}
```

### CompraController — Transacción local

El reabastecimiento es una transacción **local** porque `compras`, `detalle_compras`, `stock` y `movimientos_stock` viven todas en el mismo nodo de sucursal. El central solo se usa para validar referencias cross-node (proveedor activo, productos activos).

```php
// FASE 1+2: transacción LOCAL en la sucursal
try {
    $suc->beginTransaction();

    $insCompra = $suc->prepare(
        "INSERT INTO compras (id_prov, id_suc, total, estado)
         VALUES (?, ?, ?, 'completada')"
    );
    $insCompra->execute([$id_prov, $id_suc, $total]);
    $id_compra = (int)$suc->lastInsertId();

    foreach ($lineas as $l) {
        // UPSERT de stock + movimiento 'reabastecimiento' vía SP
        Database::llamarProc($suc,
            "CALL sp_reponer_stock(?, ?, ?, ?)",
            [$l['id_prod'], $id_suc, $l['cantidad'], "Compra #$id_compra"]
        );
    }

    $suc->commit();
} catch (Throwable $e) {
    if ($suc->inTransaction()) $suc->rollBack();
    // ...
}
```

### Flujo completo de la venta distribuida

```
FASE 0 (validación, sin transacciones):
  ┌─ Validar cliente activo (central)
  └─ Por cada producto: validar activo (central) + stock suficiente (sucursal)
     Si stock < solicitado → HTTP 409 (sin abrir transacción)
     Si nodo caído → HTTP 503 (NodoException)

FASE 1 (prepare):
  BEGIN TRANSACTION en central
  BEGIN TRANSACTION en sucursal
  ┌─ CENTRAL: CALL sp_registrar_venta(id_cli, id_suc, total)
  │           → devuelve id_venta
  ├─ Por cada línea:
  │   ├─ CENTRAL: CALL sp_agregar_detalle_venta(id_venta, id_prod, cant, precio)
  │   └─ SUCURSAL: CALL sp_realizar_compra(id_prod, id_suc, cant, 'Venta #N')
  │       └─ SELECT ... FOR UPDATE + UPDATE cantidad >= N + INSERT movimiento
  │       └─ Si ROW_COUNT() != 1 → SIGNAL SQLSTATE '45000' (sobreventa evitada)

FASE 2 (commit):
  ┌─ COMMIT sucursal (participante primero)
  └─ COMMIT central (coordinador al final)

  Si cualquier paso falla:
    ROLLBACK en ambos nodos
    Error mapping: NodoException → 503, SIGNAL → 409, otros → 500
```

---

## 12. Procedimientos almacenados

### Central

```sql
-- sp_registrar_venta: cabecera de venta, devuelve id_venta
CREATE PROCEDURE sp_registrar_venta(
    IN p_id_cli INT, IN p_id_suc INT, IN p_total DECIMAL(12,2)
)
BEGIN
    INSERT INTO ventas (id_cli, id_suc, total, estado)
    VALUES (p_id_cli, p_id_suc, p_total, 'completada');
    SELECT LAST_INSERT_ID() AS id_venta;
END;

-- sp_agregar_detalle_venta: línea de detalle
CREATE PROCEDURE sp_agregar_detalle_venta(
    IN p_id_venta INT, IN p_id_prod INT,
    IN p_cantidad INT, IN p_precio DECIMAL(10,2)
)
BEGIN
    INSERT INTO detalle_ventas (id_venta, id_prod, cantidad, precio_unitario)
    VALUES (p_id_venta, p_id_prod, p_cantidad, p_precio);
END;
```

### Sucursal

```sql
-- sp_realizar_compra: LEG de sucursal de la venta distribuida.
-- NO abre transacción propia: corre DENTRO del 2PC de PHP.
-- El UPDATE con cantidad >= N es la barrera anti-sobreventa.
CREATE PROCEDURE sp_realizar_compra(
    IN p_id_prod INT, IN p_id_suc INT,
    IN p_cantidad INT, IN p_motivo VARCHAR(200)
)
BEGIN
    DECLARE v_disp INT;

    -- Bloquea la fila para serializar ventas concurrentes
    SELECT cantidad INTO v_disp
    FROM stock WHERE id_prod = p_id_prod AND id_suc = p_id_suc
    FOR UPDATE;

    IF v_disp IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Producto sin stock registrado en la sucursal',
                MYSQL_ERRNO = 1643;
    END IF;

    -- Descuento atómico anti-sobreventa
    UPDATE stock SET cantidad = cantidad - p_cantidad
    WHERE id_prod = p_id_prod AND id_suc = p_id_suc AND cantidad >= p_cantidad;

    IF ROW_COUNT() <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Stock insuficiente o concurrente (sobreventa evitada)',
                MYSQL_ERRNO = 1644;
    END IF;

    INSERT INTO movimientos_stock (id_prod, id_suc, tipo, cantidad, motivo)
    VALUES (p_id_prod, p_id_suc, 'venta', p_cantidad, p_motivo);
END;

-- sp_actualizar_stock: ajuste absoluto, transacción local atómica
CREATE PROCEDURE sp_actualizar_stock(
    IN p_id_prod INT, IN p_id_suc INT,
    IN p_nueva INT, IN p_motivo VARCHAR(200)
)
BEGIN
    DECLARE v_anterior INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;
        SELECT cantidad INTO v_anterior
        FROM stock WHERE id_prod = p_id_prod AND id_suc = p_id_suc
        FOR UPDATE;

        UPDATE stock SET cantidad = p_nueva
        WHERE id_prod = p_id_prod AND id_suc = p_id_suc;

        INSERT INTO movimientos_stock (...)
        VALUES (p_id_prod, p_id_suc, 'ajuste', p_nueva - v_anterior, p_motivo);
    COMMIT;

    SELECT v_anterior AS cantidad_anterior, p_nueva AS cantidad_nueva,
           p_nueva - v_anterior AS delta;
END;

-- sp_reponer_stock: UPSERT para reabastecimiento
CREATE PROCEDURE sp_reponer_stock(...)
BEGIN
    INSERT INTO stock (id_prod, id_suc, cantidad, cantidad_minima)
    VALUES (p_id_prod, p_id_suc, p_cantidad, 0)
    ON DUPLICATE KEY UPDATE cantidad = cantidad + p_cantidad;

    INSERT INTO movimientos_stock (...)
    VALUES (p_id_prod, p_id_suc, 'reabastecimiento', p_cantidad, p_motivo);
END;

-- sp_reconstruir_stock: RECUPERACIÓN tras falla.
-- Reconstruye stock desde el libro de movimientos.
-- Invariante: cantidad = Σ(entradas) − Σ(salidas)
CREATE PROCEDURE sp_reconstruir_stock(IN p_id_suc INT)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN ROLLBACK; RESIGNAL; END;

    DROP TEMPORARY TABLE IF EXISTS _recon;
    CREATE TEMPORARY TABLE _recon AS
        SELECT s.id_prod,
               s.cantidad AS cantidad_antes,
               COALESCE((
                   SELECT SUM(CASE WHEN m.tipo = 'venta' THEN -m.cantidad
                                   ELSE m.cantidad END)
                   FROM movimientos_stock m
                   WHERE m.id_prod = s.id_prod AND m.id_suc = s.id_suc
               ), s.cantidad) AS cantidad_reconstruida
        FROM stock s WHERE s.id_suc = p_id_suc;

    START TRANSACTION;
        UPDATE stock s
        JOIN _recon r ON r.id_prod = s.id_prod
        SET s.cantidad = r.cantidad_reconstruida
        WHERE s.id_suc = p_id_suc
          AND s.cantidad <> r.cantidad_reconstruida;
    COMMIT;

    SELECT id_prod, cantidad_antes, cantidad_reconstruida,
           (cantidad_reconstruida - cantidad_antes) AS delta
    FROM _recon ORDER BY id_prod;

    DROP TEMPORARY TABLE IF EXISTS _recon;
END;
```

---

## 13. Decisión CAP y simulación de fallo

### ¿Por qué CP?

En e-commerce la sobreventa es inaceptable: vender una unidad de stock que no existe genera pedidos incumplibles, reembolsos y pérdida de confianza. Entre "responder siempre" (AP) y "nunca vender de más" (CP), el negocio exige lo segundo.

| Se gana (CP) | Se sacrifica |
|---|---|
| Inventario siempre consistente | La venta no se completa si un nodo cae |
| Cero sobreventa (incluso con concurrencia) | Disponibilidad parcial durante la partición |
| Datos atómicos (sin estados a medias) | El usuario debe reintentar más tarde |

### DebugController — Simulador CAP

Reproduce el flujo de una venta y lanza una excepción controlada **justo después de descontar el stock y antes del COMMIT**. Demuestra que el rollback funciona en ambos nodos.

```php
class DebugController
{
    public function simularFallo(array $params, array $body): void
    {
        // ... preparación y validación ...

        try {
            $central->beginTransaction();
            $suc->beginTransaction();

            // INSERT ventas (central)
            // INSERT detalle_ventas (central)
            // UPDATE stock − N (sucursal)

            // ⚠ PUNTO DE FALLO: excepción ANTES del COMMIT
            throw new RuntimeException('FALLO SIMULADO: caída del nodo antes del COMMIT.');

        } catch (Throwable $e) {
            if ($suc->inTransaction())    $suc->rollBack();
            if ($central->inTransaction()) $central->rollBack();
        }

        // Verificación posterior
        $consistente = ($stockAntes == $stockDespues) && !$ventaPersistida;

        Response::exito([
            'timeline' => [...],
            'stock' => [
                'antes'               => $stockAntes,
                'durante_transaccion' => $stockDurante,   // descontado
                'despues_rollback'    => $stockDespues,    // = antes
            ],
            'venta_persistida'          => false,
            'consistencia_preservada'   => true,
            'explicacion_CP'            => 'El sistema es CP...',
        ]);
    }
}
```

### Respuesta JSON de ejemplo

```json
{
  "ok": true,
  "data": {
    "simulacion": "Fallo distribuido durante una venta (comportamiento CP)",
    "timeline": [
      { "accion": "1. Conectar a nodo central y a sucursal 'norte'", "resultado": "ok" },
      { "accion": "2. Validar cliente, productos activos y stock suficiente", "resultado": "ok" },
      { "accion": "3. BEGIN en central y en sucursal", "resultado": "ok" },
      { "accion": "4. INSERT ventas (central) → id_venta=35 (sin confirmar)", "resultado": "ok" },
      { "accion": "5. INSERT detalle_ventas (central, sin confirmar)", "resultado": "ok" },
      { "accion": "6. UPDATE stock − N (sucursal, SIN confirmar)", "resultado": "ok" },
      { "accion": "7. Leer stock dentro de la transacción → aparece descontado", "resultado": "ok" },
      { "accion": "8. ⚠ Excepción controlada DESPUÉS del UPDATE y ANTES del COMMIT", "resultado": "FALLO SIMULADO: caída del nodo antes del COMMIT." },
      { "accion": "9. ROLLBACK en ambos nodos", "resultado": "ok" }
    ],
    "stock": {
      "antes": [{ "id_prod": 1, "cantidad": 50 }],
      "durante_transaccion": [{ "id_prod": 1, "cantidad": 48 }],
      "despues_rollback": [{ "id_prod": 1, "cantidad": 50 }]
    },
    "rollback": { "central": "ejecutado", "sucursal": "ejecutado" },
    "venta_persistida": false,
    "consistencia_preservada": true
  }
}
```

---

## 14. Simulación de caída y recuperación de nodos

### NodoAdminController

El estado de los nodos se persiste en la tabla `estado_nodos` del nodo central.

```php
class NodoAdminController
{
    private const SUCURSALES = ['norte', 'sur', 'este'];

    // GET /nodos — lista todos los nodos con flag + reachability real
    public function listar(array $params, array $body): void
    {
        Response::exito(['nodos' => $this->snapshot()]);
    }

    // GET /nodos/stream — Server-Sent Events (actualización cada 2 s)
    public function stream(array $params, array $body): void
    {
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        session_write_close();

        for ($i = 0; $i < 150 && !connection_aborted(); $i++) {
            Database::olvidarCaches();     // relee estado fresco
            echo 'data: ' . json_encode(['nodos' => $this->snapshot()]) . "\n\n";
            flush();
            sleep(2);
        }
    }

    // POST /nodos/:nodo/estado — "Simular falla"
    public function cambiarEstado(array $params, array $body): void
    {
        $nodo   = $this->validarNodo($params['nodo'] ?? null);
        $estado = Validador::enLista($body['estado'] ?? null, 'estado', ['online', 'offline']);
        Database::marcarEstadoNodo($nodo, $estado);
        Response::exito([...]);
    }

    // POST /nodos/:nodo/recuperar — RECUPERACIÓN con sp_reconstruir_stock
    public function recuperar(array $params, array $body): void
    {
        $nodo   = $this->validarNodo($params['nodo'] ?? null);
        $id_suc = Database::idSucursalPorNodo($nodo);

        // 1) Reactivar el nodo
        Database::marcarEstadoNodo($nodo, 'online');

        // 2) Reconstruir stock desde el ledger de movimientos
        $suc  = Database::conectarSucursal($nodo);
        $stmt = $suc->prepare("CALL sp_reconstruir_stock(?)");
        $stmt->execute([$id_suc]);
        $reporte = $stmt->fetchAll();
        while ($stmt->nextRowset()) { /* drenar */ }

        Response::exito([
            'productos'           => count($reporte),
            'productos_reparados' => count(array_filter($reporte, fn($r) => (int)$r['delta'] !== 0)),
            'reporte'             => $reporte,   // antes/después/delta
            'mensaje'             => 'Nodo recuperado...',
        ]);
    }

    private function snapshot(): array
    {
        $flags = Database::estadoNodos();
        $nodos = [];
        foreach (Config::nodos() as $clave) {
            $nodos[] = [
                'nodo'       => $clave,
                'rol'        => $clave === 'central' ? 'coordinador' : 'sucursal',
                'estado'     => $flags[$clave] ?? 'online',     // flag (falla simulada)
                'alcanzable' => Database::pingNodo($clave),     // reachability real
                'simulable'  => in_array($clave, self::SUCURSALES, true),
            ];
        }
        return $nodos;
    }
}
```

### Tabla estado_nodos

```sql
CREATE TABLE IF NOT EXISTS estado_nodos (
    nodo           VARCHAR(60) PRIMARY KEY,
    estado         ENUM('online','offline') NOT NULL DEFAULT 'online',
    actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                   ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO estado_nodos (nodo, estado) VALUES
    ('central', 'online'), ('norte', 'online'),
    ('sur', 'online'), ('este', 'online');
```

---

## 15. Chaos real con Docker

El `ChaosController` usa el socket de Docker montado en el contenedor `app_php` para **apagar o encender contenedores de sucursal reales**, provocando una falla genuina de nodo (no simulada).

```php
class ChaosController
{
    private const CONTENEDOR = [
        'norte' => 'nodo_sucursal_norte',
        'sur'   => 'nodo_sucursal_sur',
        'este'  => 'nodo_sucursal_este',
    ];

    private const ACCIONES = ['stop', 'start'];

    public function ejecutar(array $params, array $body): void
    {
        $nodo = strtolower(trim((string)($params['nodo'] ?? '')));
        $accion     = Validador::enLista($body['accion'] ?? null, 'accion', self::ACCIONES);
        $contenedor = self::CONTENEDOR[$nodo];

        exec('docker ' . escapeshellarg($accion) . ' ' . escapeshellarg($contenedor) . ' 2>&1', $salida, $codigo);

        if ($codigo !== 0) {
            Response::error("No se pudo ejecutar 'docker $accion $contenedor'.", 500);
        }

        Response::exito([
            'mensaje' => "Contenedor '$contenedor' " . ($accion === 'stop' ? 'apagado' : 'encendido') . " (falla real vía Docker).",
        ]);
    }
}
```

---

## 16. Métricas con Prometheus

La API expone un endpoint `GET /metrics` en formato Prometheus (text/plain, público):

```php
class MetricsController
{
    public function exponer(array $params, array $body): void
    {
        // Salud de la red
        $flags = Database::estadoNodos();
        foreach (Config::nodos() as $nodo) {
            echo "libremercado_nodo_alcanzable{nodo=\"$nodo\"} " . (Database::pingNodo($nodo) ? 1 : 0) . "\n";
            echo "libremercado_nodo_offline{nodo=\"$nodo\"} " . (($flags[$nodo] ?? 'online') === 'offline' ? 1 : 0) . "\n";
        }

        // Métricas de negocio (desde central)
        $c = Database::conectarCentral();
        echo "libremercado_ventas_total " . $c->query("SELECT COUNT(*) FROM ventas")->fetchColumn() . "\n";
        echo "libremercado_ingresos_total " . $c->query("SELECT COALESCE(SUM(total),0) FROM ventas")->fetchColumn() . "\n";
        echo "libremercado_productos_activos " . $c->query("SELECT COUNT(*) FROM productos WHERE activo=1")->fetchColumn() . "\n";
    }
}
```

Prometheus está configurado para scrapear cada 5 s:

```yaml
# prometheus.yml
global:
  scrape_interval: 5s
scrape_configs:
  - job_name: libremercado
    metrics_path: /metrics
    static_configs:
      - targets: ["app_php:80"]
```

---

## 17. Frontend PHP + AJAX

### Arquitectura del frontend

- **Servido por el mismo `app_php`** en `http://localhost:8080/ui/` (mismo origen que la API, sin CORS necesario)
- **PHP renderizado en el servidor**: cada página es un `.php` que pinta el HTML inicial
- **Toda la data llega por AJAX** (`fetch` con `credentials:'include'`) contra la API JSON
- **Sin frameworks ni Node/npm**: vanilla JavaScript puro
- **Dos mundos**:
  - **Vitrina pública** (`tienda.php`, `producto.php`) — catálogo del comprador sin sesión
  - **Consola interna** (dashboard, ventas, compras, stock, CRUD, nodos, simulador) — con login y roles

### Mapa del frontend

| Archivo | Ruta | Rol | Descripción |
|---|---|---|---|
| `index.php` | `/ui/` | Público | Redirige a `tienda.php` |
| `tienda.php` | `/ui/tienda.php` | Público | Catálogo con búsqueda, filtros, slider |
| `producto.php` | `/ui/producto.php?id=N` | Público | Ficha de producto con galería |
| `login.php` | `/ui/login.php` | Público | Formulario de login |
| `dashboard.php` | `/ui/dashboard.php` | Interno | Panel con KPI, topología en vivo, ranking |
| `ventas.php` | `/ui/ventas.php` | Interno | Registrar venta + historial |
| `compras.php` | `/ui/compras.php` | Interno | Registrar compra + historial |
| `stock.php` | `/ui/stock.php` | Interno | Stock por sucursal + movimientos |
| `productos.php` | `/ui/productos.php` | Interno | CRUD de productos |
| `clientes.php` | `/ui/clientes.php` | Interno | CRUD de clientes |
| `proveedores.php` | `/ui/proveedores.php` | Interno | CRUD de proveedores |
| `usuarios.php` | `/ui/usuarios.php` | Interno | CRUD de usuarios (solo admin) |
| `nodos.php` | `/ui/nodos.php` | Interno | Estado de nodos, simular falla, recuperar |
| `simulador.php` | `/ui/simulador.php` | Interno | Simulador CAP |
| `_layout.php` | — | Layout | Sidebar + topbar + helpers de render |

### Layout (`_layout.php`)

```php
function ui_head(string $active, string $title, string $subtitle = ''): void
{
    // Sidebar con navegación agrupada:
    //   Operación: Panel, Ventas, Compras, Stock
    //   Catálogo: Productos, Clientes, Proveedores
    //   Sistema distribuido: Nodos, Simulador CAP, Usuarios (solo admin)
}

function ui_head_publico(string $title): void
{
    // Vitrina pública: sin sidebar, solo header con logo + "Ingresar"
}
```

### Motor AJAX (`assets/app.js`)

```javascript
// Core de peticiones AJAX
async function pedir(metodo, url, body) {
    const opts = {
        method: metodo,
        credentials: 'include',   // envía cookie de sesión PHP
        headers: { Accept: 'application/json' },
    };
    if (body !== undefined) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const cuerpo = await res.json();
    if (cuerpo.ok) return cuerpo.data;
    throw new ApiError(cuerpo.error || 'Error de la API', res.status);
}

const api = {
    get:  (u) => pedir('GET', u),
    post: (u, b) => pedir('POST', u, b === undefined ? {} : b),
    put:  (u, b) => pedir('PUT', u, b === undefined ? {} : b),
    del:  (u) => pedir('DELETE', u),
};

// Guard de sesión: verifica /auth/me en cada página protegida
async function guard() {
    let u;
    try { u = await api.get('/auth/me'); }
    catch (e) { location.href = 'login.php'; return null; }
    LM.user = u;
    // Oculta elementos según rol (data-role)
    document.querySelectorAll('[data-role]').forEach((el) => {
        const roles = el.getAttribute('data-role').split(',');
        if (!esAdmin && !roles.includes(u.rol)) el.remove();
    });
    return u;
}

// SSE para topología en vivo
function streamNodos(onNodos) {
    const es = new EventSource('/nodos/stream');
    es.onmessage = (e) => { try { onNodos(JSON.parse(e.data).nodos); } catch (_) {} };
    return { close: () => es.close() };
}
```

### Pantalla: Simulador CAP (`simulador.php`)

El simulador es la pantalla estrella de la defensa: ejecuta `POST /debug/simular-fallo` y muestra:
- **Veredicto**: consistencia preservada / inconsistencia
- **Timeline**: cada paso del 2PC con indicación del punto de fallo
- **Tabla de stock**: antes / durante (descontado) / después (restaurado)

```javascript
$('btnRun').onclick = async function () {
    const r = await LM.api.post('/debug/simular-fallo', body);
    pintar(r);
    LM.toast(r.consistencia_preservada
        ? 'Consistencia preservada: rollback total, sin sobreventa.'
        : '¡Inconsistencia detectada!', r.consistencia_preservada ? 'ok' : 'error');
};
```

### Pantalla: Nodos de la red (`nodos.php`)

Muestra la topología en vivo vía SSE y permite 3 operaciones por sucursal:
1. **"Simular falla"** / **"Reactivar"** → `POST /nodos/:nodo/estado`
2. **"Recuperar"** → `POST /nodos/:nodo/recuperar` (ejecuta `sp_reconstruir_stock`)
3. **"Apagar/Encender contenedor"** → `POST /nodos/:nodo/chaos` (falla real con Docker)

### Pantalla: Ventas (`ventas.php`)

- Modal de "Nueva venta" con selector de cliente, sucursal y productos con stock
- Cada línea se puede ajustar en cantidad (respetando el máximo disponible)
- Confirmación → `POST /ventas` (2PC distribuido)
- Errores: 409 (stock insuficiente), 503 (nodo caído/offline)

---

## 18. Pruebas automatizadas

### Suite unificada (`tests/run.sh`)

```bash
bash tests/run.sh
```

Corre dos niveles de prueba:

#### Pruebas unitarias (`tests/unit/run.php`) — 22 tests

Prueban lógica PHP pura (mapeo de nodos, validación de input) **sin tocar la base de datos**.

```
== Database::getNodoPorSucursal ==
  ok   id_suc 1 -> norte
  ok   id_suc 2 -> sur
  ok   id_suc 3 -> este
  ok   id_suc inexistente lanza InvalidArgumentException

== Database::idSucursalPorNodo ==
  ok   norte -> id_suc 1
  ok   sur -> id_suc 2
  ok   este -> id_suc 3
  ok   round-trip id_suc -> nodo -> id_suc

== Validador (entradas válidas) ==
  ok   entero("5") -> int 5
  ok   enteroOpc(null) -> null
  ok   decimal("9.5") -> float 9.5
  ok   texto recorta espacios
  ok   email válido se conserva

== Validador (entradas inválidas -> 400) ==
  ok   entero("abc") produce ok:false y menciona el campo
  ok   entero("0", min 1) produce ok:false
  ok   email inválido produce ok:false
  ok   texto requerido vacío produce ok:false
```

#### Pruebas e2e (`tests/e2e/api.sh`) — 52 tests

Ejercen la API real con `curl`, cubriendo:

| Prueba | Lo que verifica |
|---|---|
| `GET /salud` | Los 4 nodos responden |
| Sin sesión → 401 | Protección de rutas |
| Login con credenciales inválidas → 401 | No revela existencia del usuario |
| Login admin → 200 | Autenticación correcta |
| CRUD productos | Crear, leer, actualizar, borrado lógico |
| Validación → 400 | Campos obligatorios, tipos incorrectos |
| Email duplicado → 409 | Unique constraint |
| Venta normal → 201 + stock baja 2 unidades | 2PC distribuido |
| Sobreventa → 409 sin alterar stock | Anti-overventa (CP) |
| Reabastecimiento → 201 + stock sube 5 | Transacción local ACID |
| Ajuste de stock vía SP → 200 | `sp_actualizar_stock` |
| Ranking con función de ventana → 200 | `v_ranking_productos` |
| Simulación CAP → `consistencia_preservada:true` | Rollback en ambos nodos |
| Marcar nodo OFFLINE → venta 503 | Falla simulada |
| Recuperar nodo → stock consistente | `sp_reconstruir_stock` |
| Roles: vendedor no puede crear producto → 403 | Guards de autorización |
| Logout → 401 en /auth/me | Cierre de sesión |

---

## 19. Estructura del repositorio

```
.
├── docker-compose.yml          # 5 servicios en red_distribuida (bridge)
├── Dockerfile                  # PHP 8.2 + Apache + pdo_mysql + cliente Docker
├── .env / .env.example         # Credenciales y hosts por nodo
├── prometheus.yml              # Config de scrapeo (cada 5 s)
│
├── src/                        # ← Montado en app_php:/var/www/html
│   ├── index.php               # Front controller: autoloader, CORS, sesión,
│   │                           #   manejo de excepciones, parseo JSON, despacho
│   ├── router.php              # Router + tabla de rutas completa
│   ├── .htaccess               # Reescribe todo a index.php
│   │
│   ├── config/
│   │   ├── Config.php          # Lee variables de entorno por nodo
│   │   ├── Database.php        # Conexión PDO singleton, estado de nodos,
│   │   │                       #   mapeo id_suc→nodo, llamada a SPs
│   │   └── NodoException.php   # Excepción con nombre de nodo (→ HTTP 503)
│   │
│   ├── helpers/
│   │   ├── Response.php        # Respuestas JSON {ok, data|error} con exit
│   │   ├── Auth.php            # Sesiones PHP, guards de login/rol
│   │   └── Validador.php       # Validación de input (entero, texto, email...)
│   │
│   ├── middleware/
│   │   └── AuthMiddleware.php  # Aplica guards según opciones de ruta
│   │
│   ├── controllers/
│   │   ├── AuthController.php      # login/logout/me
│   │   ├── CatalogoController.php  # Vitrina pública (GET /catalogo)
│   │   ├── ProductoController.php  # CRUD productos
│   │   ├── ClienteController.php   # CRUD clientes
│   │   ├── UsuarioController.php   # CRUD usuarios (admin)
│   │   ├── ProveedorController.php # CRUD proveedores
│   │   ├── SucursalController.php  # Listar sucursales
│   │   ├── StockController.php     # Stock por sucursal + ajuste + movimientos
│   │   ├── CarritoController.php   # Carrito por cliente
│   │   ├── VentaController.php     # ⭐ 2PC distribuido (ACID)
│   │   ├── CompraController.php    # Reabastecimiento (transacción local)
│   │   ├── NodoAdminController.php # Estado de nodos, falla simulada, recuperación
│   │   ├── DebugController.php     # ⭐ Simulador CAP (POST /debug/simular-fallo)
│   │   ├── ChaosController.php     # Falla real (Docker stop/start)
│   │   ├── ReporteController.php   # Ranking con función de ventana
│   │   └── MetricsController.php   # Métricas Prometheus
│   │
│   └── ui/                     # ← Frontend PHP + AJAX
│       ├── _layout.php         #   Layout (sidebar, topbar, public header)
│       ├── index.php           #   Redirige a tienda.php
│       ├── .htaccess           #   DirectoryIndex index.php
│       ├── tienda.php          #   Vitrina pública (catálogo)
│       ├── producto.php        #   Ficha de producto
│       ├── login.php           #   Login (admin/admin123)
│       ├── dashboard.php       #   Panel con KPIs + topología en vivo + ranking
│       ├── ventas.php          #   Ventas (registrar + historial)
│       ├── compras.php         #   Compras (registrar + historial)
│       ├── stock.php           #   Stock por sucursal + movimientos + ajuste
│       ├── productos.php       #   CRUD productos
│       ├── clientes.php        #   CRUD clientes
│       ├── proveedores.php     #   CRUD proveedores
│       ├── usuarios.php        #   CRUD usuarios
│       ├── nodos.php           #   Estado, falla simulada, recuperación, chaos
│       ├── simulador.php       #   ⭐ Simulador CAP
│       └── assets/
│           ├── app.js          #   Motor AJAX, guard, SSE, helpers de UI
│           ├── styles.css      #   Estilos (consola técnica clara)
│           └── productos/      #   Imágenes de productos (id.jpg, id_N.jpg)
│
├── sql/                        # Scripts SQL para initdb
│   ├── central/
│   │   ├── 01_schema.sql      #   Tablas del nodo central
│   │   ├── 02_seed.sql        #   Datos de demo
│   │   └── 03_objetos.sql     #   Vistas + estado_nodos + SPs centrales
│   ├── norte/
│   │   ├── 01_schema.sql      #   Tablas de sucursal (stock, compras, carrito)
│   │   ├── 02_seed.sql        #   Stock inicial, sucursales
│   │   └── 03_objetos.sql     #   Vista v_stock, trigger, SPs de sucursal
│   ├── sur/                   #   Ídem
│   └── este/                  #   Ídem
│
├── tests/
│   ├── run.sh                 # Orquesta: unit + e2e en un solo comando
│   ├── lib/harness.php        # Helpers de aserción para pruebas unitarias
│   ├── unit/run.php           # 22 tests modulares (PHP puro, sin BD)
│   └── e2e/api.sh             # 52 tests end-to-end (curl contra la API)
│
└── docs/
    ├── arquitectura_CAP.md    # Justificación de la elección CP
    ├── tercera_evaluacion.md  # Documento técnico de la 3ª evaluación
    └── guion_demo.md          # Guion minuto a minuto para la defensa
```

---

## 20. Guion de defensa (demo en vivo)

### Setup distribuido

- La sucursal **Este** corre en un servidor remoto (Tailscale `100.73.123.84`)
- `socat` en la laptop hace forwarding `localhost:33060 → servidor:3306`
- Plan B: todo local (cambiar `ESTE_HOST` en `.env`)

### Minuto a minuto (~10 min)

| Tiempo | Segmento | Qué mostrar |
|---|---|---|
| **1:30** | Arquitectura | Dashboard → topología de 4 nodos, explicar que el Este está en otro servidor |
| **1:30** | CRUD + roles | Crear/eliminar producto (borrado lógico), mostrar roles vendedor/bodeguero |
| **2:00** | Venta normal (2PC) | Registrar venta → stock baja atómicamente; evidencia en BD de ambos nodos |
| **3:00** | ⭐ Partición REAL | `docker stop nodo_sucursal_este` → venta da 503 → rollback total; venta a Norte sí funciona |
| **1:00** | Simulador CAP | Ejecutar `/debug/simular-fallo` → timeline + stock antes/durante/después |
| **1:00** | Cierre | Resumen: BD distribuida, CRUD, ACID con 2PC, decisión CP |

### Preguntas probables del profesor

**"¿Esto es un Two-Phase Commit de verdad?"**
> Es 2PC con el central como coordinador: fase de preparación (BEGIN + escrituras en ambos nodos) y fase de commit. Es un 2PC a nivel de aplicación, no XA nativo. La ventana de inconsistencia se mitiga confirmando al coordinador al final y dejando auditado en `error_log`.

**"¿Cómo evitan la sobreventa con dos clientes comprando a la vez?"**
> `UPDATE stock SET cantidad = cantidad - N WHERE ... AND cantidad >= N` con verificación de `rowCount() == 1`. InnoDB bloquea la fila; si el stock ya no alcanza, el UPDATE afecta 0 filas y se aborta toda la transacción. Es atómico a nivel de fila.

**"¿Por qué CP y no AP?"**
> Porque el costo de una sobreventa (pedido incumplible, reembolso, pérdida de confianza) es mayor que el de pedir "reintenta en un momento". En inventario y dinero la consistencia manda.

**"¿La partición fue real o simulada?"**
> Real: detuvimos el contenedor MariaDB en otro servidor. Además tenemos el simulador (`/debug/simular-fallo`) para reproducir el fallo en el punto exacto de forma controlada.
