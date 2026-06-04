-- ===========================================================================
--  Libre Mercado — SUCURSAL NORTE — Seed (Etapa 2)
--  id_suc = 1  (globalmente único entre nodos)
--  Productos con stock BAJO para alertas: #3 Mouse (5/10), #7 Balón (8/10)
-- ===========================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
--  SUCURSAL
-- ---------------------------------------------------------------------------
INSERT INTO sucursales (id_suc, sucursal, direccion, region, nodo) VALUES
    (1, 'Sucursal Norte', 'Av. Norte 1234, Antofagasta', 'Norte', 'nodo_sucursal_norte');

-- ---------------------------------------------------------------------------
--  STOCK  (10 productos; cantidad / cantidad_minima)
-- ---------------------------------------------------------------------------
INSERT INTO stock (id_prod, id_suc, cantidad, cantidad_minima) VALUES
    (1,  1, 50, 10),
    (2,  1, 40, 10),
    (3,  1,  5, 10),   -- BAJO
    (4,  1, 25,  5),
    (5,  1, 30,  8),
    (6,  1, 15,  5),
    (7,  1,  8, 10),   -- BAJO
    (8,  1, 20,  5),
    (9,  1, 35,  8),
    (10, 1, 45, 12);

-- ---------------------------------------------------------------------------
--  MOVIMIENTOS_STOCK  (carga inicial de inventario)
-- ---------------------------------------------------------------------------
INSERT INTO movimientos_stock (id_prod, id_suc, tipo, cantidad, motivo, fecha) VALUES
    (1,  1, 'reabastecimiento', 50, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (2,  1, 'reabastecimiento', 40, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (3,  1, 'reabastecimiento',  5, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (4,  1, 'reabastecimiento', 25, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (5,  1, 'reabastecimiento', 30, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (6,  1, 'reabastecimiento', 15, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (7,  1, 'reabastecimiento',  8, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (8,  1, 'reabastecimiento', 20, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (9,  1, 'reabastecimiento', 35, 'Carga inicial de inventario', '2026-05-01 09:00:00'),
    (10, 1, 'reabastecimiento', 45, 'Carga inicial de inventario', '2026-05-01 09:00:00');

-- ---------------------------------------------------------------------------
--  COMPRA de ejemplo (proveedor TecnoSur, ya completada)
-- ---------------------------------------------------------------------------
INSERT INTO compras (id_compra, id_prov, id_suc, fecha, total, estado) VALUES
    (1, 1, 1, '2026-05-05 11:30:00', 1139650.00, 'completada');

INSERT INTO detalle_compras (id_compra, id_prod, cantidad, precio_unitario) VALUES
    (1, 1, 20, 29990.00),
    (1, 2, 10, 45990.00),
    (1, 3,  5, 15990.00);

-- ---------------------------------------------------------------------------
--  CARRITO abierto de ejemplo (cliente 2)
-- ---------------------------------------------------------------------------
INSERT INTO carrito (id_carrito, id_cli, id_suc, fecha_creacion, estado) VALUES
    (1, 2, 1, '2026-05-28 16:00:00', 'abierto');

INSERT INTO detalle_carrito (id_carrito, id_prod, cantidad) VALUES
    (1, 1, 1),
    (1, 5, 1);
