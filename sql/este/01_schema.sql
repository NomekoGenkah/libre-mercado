-- ===========================================================================
--  Libre Mercado — NODO SUCURSAL — Schema (Etapa 2)
--  Datos locales de la sucursal: stock, movimientos, compras, carrito.
--  Schema idéntico en los 3 nodos de sucursal (norte / sur / este).
--  Columnas que referencian al nodo central (id_prod, id_cli, id_prov) NO
--  llevan FK (relación cross-node) pero sí índice.
-- ===========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
--  SUCURSALES  (local; `nodo` = nombre del contenedor Docker)
--  id_suc es globalmente único entre nodos (se asigna explícito en el seed).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sucursales (
    id_suc      INT AUTO_INCREMENT PRIMARY KEY,
    sucursal    VARCHAR(120) NOT NULL,
    direccion   VARCHAR(200) NULL,
    region      VARCHAR(80) NULL,
    nodo        VARCHAR(60) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  STOCK  (cantidad por producto/sucursal; UNIQUE evita duplicados)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock (
    id_stock        INT AUTO_INCREMENT PRIMARY KEY,
    id_prod         INT NOT NULL,
    id_suc          INT NOT NULL,
    cantidad        INT NOT NULL DEFAULT 0,
    cantidad_minima INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_stock_prod_suc (id_prod, id_suc),
    KEY idx_stock_prod (id_prod),
    KEY idx_stock_suc (id_suc),
    CONSTRAINT fk_stock_sucursal FOREIGN KEY (id_suc)
        REFERENCES sucursales (id_suc) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  MOVIMIENTOS_STOCK  (historial: venta, reabastecimiento, ajuste, devolucion)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_stock (
    id_mov      INT AUTO_INCREMENT PRIMARY KEY,
    id_prod     INT NOT NULL,
    id_suc      INT NOT NULL,
    tipo        ENUM('venta','reabastecimiento','ajuste','devolucion') NOT NULL,
    cantidad    INT NOT NULL,
    motivo      VARCHAR(200) NULL,
    fecha       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_mov_prod (id_prod),
    KEY idx_mov_suc (id_suc),
    KEY idx_mov_tipo (tipo),
    KEY idx_mov_fecha (fecha),
    CONSTRAINT fk_mov_sucursal FOREIGN KEY (id_suc)
        REFERENCES sucursales (id_suc) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  COMPRAS  (reabastecimiento desde proveedores; id_prov es cross-node)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compras (
    id_compra   INT AUTO_INCREMENT PRIMARY KEY,
    id_prov     INT NOT NULL,
    id_suc      INT NOT NULL,
    fecha       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    estado      ENUM('pendiente','completada','anulada') NOT NULL DEFAULT 'completada',
    KEY idx_compra_prov (id_prov),
    KEY idx_compra_suc (id_suc),
    KEY idx_compra_fecha (fecha),
    CONSTRAINT fk_compra_sucursal FOREIGN KEY (id_suc)
        REFERENCES sucursales (id_suc) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  DETALLE_COMPRAS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_compras (
    id_detalle      INT AUTO_INCREMENT PRIMARY KEY,
    id_compra       INT NOT NULL,
    id_prod         INT NOT NULL,
    cantidad        INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    KEY idx_detcompra_compra (id_compra),
    KEY idx_detcompra_prod (id_prod),
    CONSTRAINT fk_detcompra_compra FOREIGN KEY (id_compra)
        REFERENCES compras (id_compra) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  CARRITO  (id_cli es cross-node)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carrito (
    id_carrito      INT AUTO_INCREMENT PRIMARY KEY,
    id_cli          INT NOT NULL,
    id_suc          INT NOT NULL,
    fecha_creacion  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado          ENUM('abierto','convertido','abandonado') NOT NULL DEFAULT 'abierto',
    KEY idx_carrito_cli (id_cli),
    KEY idx_carrito_suc (id_suc),
    KEY idx_carrito_estado (estado),
    CONSTRAINT fk_carrito_sucursal FOREIGN KEY (id_suc)
        REFERENCES sucursales (id_suc) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  DETALLE_CARRITO
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_carrito (
    id_detalle  INT AUTO_INCREMENT PRIMARY KEY,
    id_carrito  INT NOT NULL,
    id_prod     INT NOT NULL,
    cantidad    INT NOT NULL,
    KEY idx_detcarrito_carrito (id_carrito),
    KEY idx_detcarrito_prod (id_prod),
    CONSTRAINT fk_detcarrito_carrito FOREIGN KEY (id_carrito)
        REFERENCES carrito (id_carrito) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
