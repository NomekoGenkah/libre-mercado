-- ===========================================================================
--  Libre Mercado — NODO CENTRAL — Objetos de BD (vistas)
--  Concentra los JOIN del catálogo y de ventas en VISTAS reutilizables: los
--  controllers consultan "SELECT * FROM v_*" en lugar de repetir el JOIN.
--  Se crean tras 01_schema.sql y 02_seed.sql (initdb corre en orden alfabético).
-- ===========================================================================

SET NAMES utf8mb4;

-- Catálogo: producto + su categoría (incluye inactivos; se filtra con activo).
CREATE OR REPLACE VIEW v_catalogo AS
SELECT p.id_prod, p.producto, p.precio, p.descripcion,
       p.id_cat, c.categoria, p.activo
FROM productos p
LEFT JOIN categorias c ON c.id_cat = p.id_cat;

-- Cabecera de venta + nombre del cliente.
CREATE OR REPLACE VIEW v_ventas AS
SELECT v.id_venta, v.id_cli, c.nombre AS cliente,
       v.id_suc, v.fecha, v.total, v.estado
FROM ventas v
LEFT JOIN clientes c ON c.id_cli = v.id_cli;

-- Líneas de venta + nombre de producto + subtotal calculado.
CREATE OR REPLACE VIEW v_ventas_detalle AS
SELECT d.id_detalle, d.id_venta, d.id_prod, p.producto,
       d.cantidad, d.precio_unitario,
       (d.cantidad * d.precio_unitario) AS subtotal
FROM detalle_ventas d
LEFT JOIN productos p ON p.id_prod = d.id_prod;

-- Ranking de productos más vendidos. Usa una FUNCIÓN DE VENTANA (RANK() OVER):
-- el ranking se calcula sobre el agregado de unidades, sin subconsultas.
CREATE OR REPLACE VIEW v_ranking_productos AS
SELECT d.id_prod,
       p.producto,
       SUM(d.cantidad)                              AS unidades_vendidas,
       SUM(d.cantidad * d.precio_unitario)          AS ingreso_total,
       RANK() OVER (ORDER BY SUM(d.cantidad) DESC)  AS ranking
FROM detalle_ventas d
JOIN productos p ON p.id_prod = d.id_prod
GROUP BY d.id_prod, p.producto;

-- ---------------------------------------------------------------------------
--  ESTADO DE NODOS (Tercera Evaluación, Requisito 4: "Simular falla").
--  Registro persistente del estado de cada nodo. Cuando un nodo se marca
--  'offline', la capa PHP (Database) rechaza las operaciones hacia él con un
--  503 controlado —igual que si el contenedor estuviera caído— sin tener que
--  apagar Docker. Vive en el nodo CENTRAL (coordinador) para ser la única
--  fuente de verdad del estado de la red.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estado_nodos (
    nodo          VARCHAR(60) PRIMARY KEY,
    estado        ENUM('online','offline') NOT NULL DEFAULT 'online',
    actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                   ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO estado_nodos (nodo, estado) VALUES
    ('central', 'online'),
    ('norte',   'online'),
    ('sur',     'online'),
    ('este',    'online')
ON DUPLICATE KEY UPDATE estado = VALUES(estado);

-- ---------------------------------------------------------------------------
--  PROCEDIMIENTOS: leg CENTRAL de la venta distribuida (Requisito 2 y 3).
--  La venta es una transacción distribuida (2PC coordinado por PHP). El nodo
--  central aporta la CABECERA y las LÍNEAS de la venta mediante procedimientos
--  almacenados; NO abren transacción propia: corren DENTRO del BEGIN que abre
--  VentaController, para que un fallo revierta ambos nodos.
-- ---------------------------------------------------------------------------
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_registrar_venta $$
CREATE PROCEDURE sp_registrar_venta(
    IN p_id_cli INT,
    IN p_id_suc INT,
    IN p_total  DECIMAL(12,2)
)
BEGIN
    INSERT INTO ventas (id_cli, id_suc, total, estado)
    VALUES (p_id_cli, p_id_suc, p_total, 'completada');
    -- Devuelve el id generado para que PHP encadene el detalle y el descuento.
    SELECT LAST_INSERT_ID() AS id_venta;
END $$

DROP PROCEDURE IF EXISTS sp_agregar_detalle_venta $$
CREATE PROCEDURE sp_agregar_detalle_venta(
    IN p_id_venta INT,
    IN p_id_prod  INT,
    IN p_cantidad INT,
    IN p_precio   DECIMAL(10,2)
)
BEGIN
    INSERT INTO detalle_ventas (id_venta, id_prod, cantidad, precio_unitario)
    VALUES (p_id_venta, p_id_prod, p_cantidad, p_precio);
END $$

DELIMITER ;
