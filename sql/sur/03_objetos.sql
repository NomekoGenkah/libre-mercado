-- ===========================================================================
--  Libre Mercado — NODO SUCURSAL — Objetos de BD
--  Vista de stock con semáforo + trigger de auditoría + procedimientos
--  almacenados para operaciones LOCALES (ajuste y reposición de stock).
--  IDÉNTICO en los 3 nodos de sucursal (norte / sur / este).
--
--  Nota de diseño: la VENTA es distribuida (central + sucursal) y por eso su
--  Two-Phase Commit vive en PHP (un procedimiento no puede abarcar dos
--  servidores). Las operaciones de UN SOLO nodo sí se encapsulan aquí.
-- ===========================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
--  VISTA: stock con el semáforo (rojo/amarillo/verde) calculado en la BD.
--  Antes el "estado" se calculaba en PHP; ahora es responsabilidad de la vista.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_stock AS
SELECT id_stock, id_prod, id_suc, cantidad, cantidad_minima,
       CASE
           WHEN cantidad <= cantidad_minima       THEN 'rojo'
           WHEN cantidad <= cantidad_minima * 1.5  THEN 'amarillo'
           ELSE 'verde'
       END AS estado
FROM stock;

-- ---------------------------------------------------------------------------
--  AUDITORÍA: tabla + TRIGGER que bitacora cada cambio de cantidad de stock.
--  Demuestra el concepto de trigger sin alterar la lógica de negocio.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_auditoria (
    id_aud            INT AUTO_INCREMENT PRIMARY KEY,
    id_stock          INT NOT NULL,
    id_prod           INT NOT NULL,
    id_suc            INT NOT NULL,
    cantidad_anterior INT NOT NULL,
    cantidad_nueva    INT NOT NULL,
    fecha             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_aud_prod (id_prod),
    KEY idx_aud_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$

DROP TRIGGER IF EXISTS trg_stock_auditoria $$
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
END $$

-- ---------------------------------------------------------------------------
--  PROCEDIMIENTO: sp_actualizar_stock — ajuste de stock a una cantidad ABSOLUTA.
--  (Tercera Evaluación, Requisito 3: "sp_actualizar_stock — recibir producto,
--  recibir cantidad, modificar existencia".)
--  Transacción local atómica: UPDATE stock + INSERT movimiento 'ajuste'.
--  Devuelve un result set con cantidad anterior / nueva / delta.
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_actualizar_stock $$
CREATE PROCEDURE sp_actualizar_stock(
    IN p_id_prod INT,
    IN p_id_suc  INT,
    IN p_nueva   INT,
    IN p_motivo  VARCHAR(200)
)
BEGIN
    DECLARE v_anterior INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;   -- propaga el error a PHP
    END;

    START TRANSACTION;
        SELECT cantidad INTO v_anterior
        FROM stock
        WHERE id_prod = p_id_prod AND id_suc = p_id_suc
        FOR UPDATE;

        UPDATE stock SET cantidad = p_nueva
        WHERE id_prod = p_id_prod AND id_suc = p_id_suc;

        INSERT INTO movimientos_stock (id_prod, id_suc, tipo, cantidad, motivo)
        VALUES (p_id_prod, p_id_suc, 'ajuste', p_nueva - v_anterior, p_motivo);
    COMMIT;

    SELECT v_anterior            AS cantidad_anterior,
           p_nueva               AS cantidad_nueva,
           p_nueva - v_anterior  AS delta;
END $$

-- ---------------------------------------------------------------------------
--  PROCEDIMIENTO: reposición de stock (UPSERT + movimiento 'reabastecimiento').
--  NO abre transacción propia: corre DENTRO de la que abre CompraController,
--  para que toda la compra (cabecera + detalle + reposiciones) sea atómica.
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_reponer_stock $$
CREATE PROCEDURE sp_reponer_stock(
    IN p_id_prod  INT,
    IN p_id_suc   INT,
    IN p_cantidad INT,
    IN p_motivo   VARCHAR(200)
)
BEGIN
    INSERT INTO stock (id_prod, id_suc, cantidad, cantidad_minima)
    VALUES (p_id_prod, p_id_suc, p_cantidad, 0)
    ON DUPLICATE KEY UPDATE cantidad = cantidad + p_cantidad;

    INSERT INTO movimientos_stock (id_prod, id_suc, tipo, cantidad, motivo)
    VALUES (p_id_prod, p_id_suc, 'reabastecimiento', p_cantidad, p_motivo);
END $$

-- ---------------------------------------------------------------------------
--  PROCEDIMIENTO: sp_realizar_compra — LEG DE SUCURSAL de la venta distribuida.
--  (Tercera Evaluación, Requisito 3: "sp_realizar_compra — validar stock,
--  actualizar inventario, controlar errores".) La INSERCIÓN de la venta ocurre
--  en el nodo CENTRAL (sp_registrar_venta); aquí va el paso crítico y atómico
--  de descontar el inventario evitando sobreventa.
--
--  NO abre transacción propia: corre DENTRO del Two-Phase Commit que abre PHP
--  (VentaController), de modo que un fallo aquí hace ROLLBACK en ambos nodos.
--  Ante stock insuficiente o concurrencia lanza SIGNAL (SQLSTATE 45000) para
--  que PHP lo capture, revierta y responda 409.
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_realizar_compra $$
CREATE PROCEDURE sp_realizar_compra(
    IN p_id_prod  INT,
    IN p_id_suc   INT,
    IN p_cantidad INT,
    IN p_motivo   VARCHAR(200)
)
BEGIN
    DECLARE v_disp INT;

    -- Bloquea la fila del producto para serializar ventas concurrentes.
    SELECT cantidad INTO v_disp
    FROM stock
    WHERE id_prod = p_id_prod AND id_suc = p_id_suc
    FOR UPDATE;

    IF v_disp IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Producto sin stock registrado en la sucursal',
                MYSQL_ERRNO = 1643;   -- 1643 -> PHP lo mapea a 409/404
    END IF;

    -- Descuento atómico anti-sobreventa: sólo baja si hay saldo suficiente.
    UPDATE stock SET cantidad = cantidad - p_cantidad
    WHERE id_prod = p_id_prod AND id_suc = p_id_suc AND cantidad >= p_cantidad;

    IF ROW_COUNT() <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Stock insuficiente o concurrente (sobreventa evitada)',
                MYSQL_ERRNO = 1644;   -- 1644 -> PHP lo mapea a 409
    END IF;

    INSERT INTO movimientos_stock (id_prod, id_suc, tipo, cantidad, motivo)
    VALUES (p_id_prod, p_id_suc, 'venta', p_cantidad, p_motivo);
END $$

-- ---------------------------------------------------------------------------
--  PROCEDIMIENTO: sp_reconstruir_stock — RECUPERACIÓN tras una falla de nodo.
--  (Tercera Evaluación, Requisito 3: "sp_reconstruir_stock — recuperar
--  información después de una falla".) Reconstruye la cantidad de cada producto
--  de la sucursal a partir del LIBRO MAYOR de movimientos (fuente de verdad),
--  aplicando el invariante:  cantidad = Σ(reabastecimiento, ajuste, devolución)
--  − Σ(venta). Toda operación de negocio registra su movimiento, así que el
--  ledger reconstruye el estado consistente y repara cualquier desincronización
--  (p.ej. stock corrupto tras un corte). Devuelve antes/después por producto.
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_reconstruir_stock $$
CREATE PROCEDURE sp_reconstruir_stock(
    IN p_id_suc INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

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
        FROM stock s
        WHERE s.id_suc = p_id_suc;

    START TRANSACTION;
        UPDATE stock s
        JOIN _recon r ON r.id_prod = s.id_prod
        SET s.cantidad = r.cantidad_reconstruida
        WHERE s.id_suc = p_id_suc
          AND s.cantidad <> r.cantidad_reconstruida;
    COMMIT;

    SELECT id_prod,
           cantidad_antes,
           cantidad_reconstruida,
           (cantidad_reconstruida - cantidad_antes) AS delta
    FROM _recon
    ORDER BY id_prod;

    DROP TEMPORARY TABLE IF EXISTS _recon;
END $$

DELIMITER ;
