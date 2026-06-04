-- ===========================================================================
--  Libre Mercado — SUCURSAL SUR — Seed (Etapa 2)
--  id_suc = 2  (globalmente único entre nodos)
--  Productos con stock BAJO para alertas: #1 Auriculares (4/10), #9 Libro (3/8)
-- ===========================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
--  SUCURSAL
-- ---------------------------------------------------------------------------
INSERT INTO sucursales (id_suc, sucursal, direccion, region, nodo) VALUES
    (2, 'Sucursal Sur', 'Av. Sur 4567, Puerto Montt', 'Sur', 'nodo_sucursal_sur');

-- ---------------------------------------------------------------------------
--  STOCK
-- ---------------------------------------------------------------------------
INSERT INTO stock (id_prod, id_suc, cantidad, cantidad_minima) VALUES
    (1,  2,  4, 10),   -- BAJO
    (2,  2, 22,  8),
    (3,  2, 30, 10),
    (4,  2, 12,  5),
    (5,  2, 18,  8),
    (6,  2, 10,  5),
    (7,  2, 40, 10),
    (8,  2, 15,  5),
    (9,  2,  3,  8),   -- BAJO
    (10, 2, 28, 12);

-- ---------------------------------------------------------------------------
--  MOVIMIENTOS_STOCK  (carga inicial de inventario)
-- ---------------------------------------------------------------------------
INSERT INTO movimientos_stock (id_prod, id_suc, tipo, cantidad, motivo, fecha) VALUES
    (1,  2, 'reabastecimiento',  4, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (2,  2, 'reabastecimiento', 22, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (3,  2, 'reabastecimiento', 30, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (4,  2, 'reabastecimiento', 12, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (5,  2, 'reabastecimiento', 18, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (6,  2, 'reabastecimiento', 10, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (7,  2, 'reabastecimiento', 40, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (8,  2, 'reabastecimiento', 15, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (9,  2, 'reabastecimiento',  3, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (10, 2, 'reabastecimiento', 28, 'Carga inicial de inventario', '2026-05-01 09:00:00');

-- ---------------------------------------------------------------------------
--  COMPRA de ejemplo (proveedor HogarPlus, ya completada)
-- ---------------------------------------------------------------------------
INSERT INTO compras (id_compra, id_prov, id_suc, fecha, total, estado) VALUES
    (1, 2, 2, '2026-05-06 10:15:00', 1099880.00, 'completada');

INSERT INTO detalle_compras (id_compra, id_prod, cantidad, precio_unitario) VALUES
    (1, 5, 8, 89990.00),
    (1, 6, 2, 199990.00);

-- ---------------------------------------------------------------------------
--  CARRITO abierto de ejemplo (cliente 4)
-- ---------------------------------------------------------------------------
INSERT INTO carrito (id_carrito, id_cli, id_suc, fecha_creacion, estado) VALUES
    (1, 4, 2, '2026-05-29 12:30:00', 'abierto');

INSERT INTO detalle_carrito (id_carrito, id_prod, cantidad) VALUES
    (1, 7, 2);
