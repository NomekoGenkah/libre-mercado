-- ===========================================================================
--  Libre Mercado — SUCURSAL ESTE — Seed (Etapa 2)
--  id_suc = 3  (globalmente único entre nodos)
--  Productos con stock BAJO para alertas: #6 Aspiradora (2/5), #10 Puzzle (6/12)
-- ===========================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
--  SUCURSAL
-- ---------------------------------------------------------------------------
INSERT INTO sucursales (id_suc, sucursal, direccion, region, nodo) VALUES
    (3, 'Sucursal Este', 'Av. Este 8910, San Bernardo', 'Este', 'nodo_sucursal_este');

-- ---------------------------------------------------------------------------
--  STOCK
-- ---------------------------------------------------------------------------
INSERT INTO stock (id_prod, id_suc, cantidad, cantidad_minima) VALUES
    (1,  3, 33, 10),
    (2,  3, 27,  8),
    (3,  3, 19, 10),
    (4,  3, 14,  5),
    (5,  3, 21,  8),
    (6,  3,  2,  5),   -- BAJO
    (7,  3, 26, 10),
    (8,  3, 17,  5),
    (9,  3, 12,  8),
    (10, 3,  6, 12);   -- BAJO

-- ---------------------------------------------------------------------------
--  MOVIMIENTOS_STOCK  (carga inicial de inventario)
-- ---------------------------------------------------------------------------
INSERT INTO movimientos_stock (id_prod, id_suc, tipo, cantidad, motivo, fecha) VALUES
    (1,  3, 'reabastecimiento', 33, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (2,  3, 'reabastecimiento', 27, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (3,  3, 'reabastecimiento', 19, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (4,  3, 'reabastecimiento', 14, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (5,  3, 'reabastecimiento', 21, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (6,  3, 'reabastecimiento',  2, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (7,  3, 'reabastecimiento', 26, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (8,  3, 'reabastecimiento', 17, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (9,  3, 'reabastecimiento', 12, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (10, 3, 'reabastecimiento',  6, 'Carga inicial de inventario', '2026-05-01 09:00:00');

-- ---------------------------------------------------------------------------
--  COMPRA de ejemplo (proveedor Deportes MdM, ya completada)
-- ---------------------------------------------------------------------------
INSERT INTO compras (id_compra, id_prov, id_suc, fecha, total, estado) VALUES
    (1, 3, 3, '2026-05-07 09:45:00', 489840.00, 'completada');

INSERT INTO detalle_compras (id_compra, id_prod, cantidad, precio_unitario) VALUES
    (1, 7, 12, 19990.00),
    (1, 8,  7, 34990.00);

-- ---------------------------------------------------------------------------
--  CARRITO abierto de ejemplo (cliente 6)
-- ---------------------------------------------------------------------------
INSERT INTO carrito (id_carrito, id_cli, id_suc, fecha_creacion, estado) VALUES
    (1, 6, 3, '2026-05-30 18:20:00', 'abierto');

INSERT INTO detalle_carrito (id_carrito, id_prod, cantidad) VALUES
    (1, 2, 1),
    (1, 9, 1);
