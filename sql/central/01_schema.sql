-- ===========================================================================
--  Libre Mercado — NODO CENTRAL — Schema (Etapa 2)
--  Datos globales: catálogo, clientes, usuarios, ventas, proveedores.
--  Todas las tablas InnoDB (requerido para transacciones ACID).
-- ===========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
--  CATEGORÍAS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
    id_cat      INT AUTO_INCREMENT PRIMARY KEY,
    categoria   VARCHAR(80) NOT NULL,
    UNIQUE KEY uq_categoria (categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  PRODUCTOS  (borrado lógico vía `activo`)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
    id_prod     INT AUTO_INCREMENT PRIMARY KEY,
    producto    VARCHAR(150) NOT NULL,
    precio      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    descripcion TEXT NULL,
    id_cat      INT NULL,
    activo      TINYINT(1) NOT NULL DEFAULT 1,
    KEY idx_prod_categoria (id_cat),
    KEY idx_prod_activo (activo),
    CONSTRAINT fk_prod_categoria FOREIGN KEY (id_cat)
        REFERENCES categorias (id_cat) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  CLIENTES  (borrado lógico vía `activo`)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
    id_cli      INT AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    email       VARCHAR(150) NOT NULL,
    telefono    VARCHAR(30) NULL,
    activo      TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uq_cliente_email (email),
    KEY idx_cli_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  ROLES  (catálogo de roles del sistema)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id_rol      INT AUTO_INCREMENT PRIMARY KEY,
    rol         VARCHAR(40) NOT NULL,
    descripcion VARCHAR(200) NULL,
    UNIQUE KEY uq_rol (rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  USUARIOS  (autenticación; borrado lógico vía `activo`)
--  rol referencia al catálogo roles(rol); id_cli opcional (admin no es cliente)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id_usr        INT AUTO_INCREMENT PRIMARY KEY,
    id_cli        INT NULL,
    username      VARCHAR(60) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol           VARCHAR(40) NOT NULL,
    activo        TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uq_username (username),
    KEY idx_usr_rol (rol),
    KEY idx_usr_cliente (id_cli),
    CONSTRAINT fk_usr_cliente FOREIGN KEY (id_cli)
        REFERENCES clientes (id_cli) ON DELETE RESTRICT,
    CONSTRAINT fk_usr_rol FOREIGN KEY (rol)
        REFERENCES roles (rol) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  PROVEEDORES  (borrado lógico vía `activo`)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proveedores (
    id_prov     INT AUTO_INCREMENT PRIMARY KEY,
    proveedor   VARCHAR(150) NOT NULL,
    contacto    VARCHAR(120) NULL,
    email       VARCHAR(150) NULL,
    activo      TINYINT(1) NOT NULL DEFAULT 1,
    KEY idx_prov_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  VENTAS
--  id_suc apunta a una sucursal que vive en OTRO nodo (sin FK cross-node).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas (
    id_venta    INT AUTO_INCREMENT PRIMARY KEY,
    id_cli      INT NOT NULL,
    id_suc      INT NOT NULL,
    fecha       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    estado      ENUM('pendiente','completada','anulada') NOT NULL DEFAULT 'completada',
    KEY idx_venta_cliente (id_cli),
    KEY idx_venta_sucursal (id_suc),
    KEY idx_venta_fecha (fecha),
    CONSTRAINT fk_venta_cliente FOREIGN KEY (id_cli)
        REFERENCES clientes (id_cli) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  DETALLE_VENTAS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_ventas (
    id_detalle      INT AUTO_INCREMENT PRIMARY KEY,
    id_venta        INT NOT NULL,
    id_prod         INT NOT NULL,
    cantidad        INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    KEY idx_detventa_venta (id_venta),
    KEY idx_detventa_prod (id_prod),
    CONSTRAINT fk_detventa_venta FOREIGN KEY (id_venta)
        REFERENCES ventas (id_venta) ON DELETE RESTRICT,
    CONSTRAINT fk_detventa_prod FOREIGN KEY (id_prod)
        REFERENCES productos (id_prod) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
