-- ===========================================================================
--  Libre Mercado — NODO CENTRAL — Seed (Etapa 2)
--  Datos de demo: 5 categorías, 10 productos, 8 clientes, 4 proveedores,
--  3 roles y 3 usuarios (admin / vendedor / bodeguero).
--  IDs explícitos para mantener referencias estables entre nodos.
-- ===========================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
--  CATEGORÍAS
-- ---------------------------------------------------------------------------
INSERT INTO categorias (id_cat, categoria) VALUES
    (1, 'Electrónica'),
    (2, 'Hogar'),
    (3, 'Deportes'),
    (4, 'Libros'),
    (5, 'Juguetes');

-- ---------------------------------------------------------------------------
--  PRODUCTOS  (10 productos)
-- ---------------------------------------------------------------------------
INSERT INTO productos (id_prod, producto, precio, descripcion, id_cat, activo) VALUES
    (1,  'Auriculares Bluetooth',          29990.00,  'Auriculares inalámbricos con cancelación de ruido',        1, 1),
    (2,  'Teclado Mecánico RGB',           45990.00,  'Teclado mecánico switches red con iluminación RGB',        1, 1),
    (3,  'Mouse Inalámbrico',              15990.00,  'Mouse óptico 1600 DPI con receptor USB',                   1, 1),
    (4,  'Monitor 24" Full HD',           119990.00,  'Monitor IPS 24 pulgadas 1080p 75Hz',                       1, 1),
    (5,  'Cafetera Express',               89990.00,  'Cafetera express 15 bares con espumador de leche',         2, 1),
    (6,  'Aspiradora Robot',              199990.00,  'Aspiradora robótica con mapeo y app móvil',                2, 1),
    (7,  'Balón de Fútbol',                19990.00,  'Balón tamaño 5 cosido a máquina',                          3, 1),
    (8,  'Set de Mancuernas 20kg',         34990.00,  'Par de mancuernas ajustables hasta 20kg',                  3, 1),
    (9,  'Libro: Sistemas Distribuidos',   39990.00,  'Texto universitario sobre arquitecturas distribuidas',     4, 1),
    (10, 'Rompecabezas 1000 piezas',       12990.00,  'Puzzle paisaje 1000 piezas con póster guía',               5, 1);

-- ---------------------------------------------------------------------------
--  CLIENTES  (8 clientes)
-- ---------------------------------------------------------------------------
INSERT INTO clientes (id_cli, nombre, email, telefono, activo) VALUES
    (1, 'María González',   'maria.gonzalez@example.com', '+56 9 1111 1111', 1),
    (2, 'Juan Pérez',       'juan.perez@example.com',     '+56 9 2222 2222', 1),
    (3, 'Camila Rojas',     'camila.rojas@example.com',   '+56 9 3333 3333', 1),
    (4, 'Diego Fuentes',    'diego.fuentes@example.com',  '+56 9 4444 4444', 1),
    (5, 'Valentina Soto',   'valentina.soto@example.com', '+56 9 5555 5555', 1),
    (6, 'Sebastián Muñoz',  'sebastian.munoz@example.com','+56 9 6666 6666', 1),
    (7, 'Fernanda Castro',  'fernanda.castro@example.com','+56 9 7777 7777', 1),
    (8, 'Ignacio Vera',     'ignacio.vera@example.com',   '+56 9 8888 8888', 1);

-- ---------------------------------------------------------------------------
--  ROLES
-- ---------------------------------------------------------------------------
INSERT INTO roles (id_rol, rol, descripcion) VALUES
    (1, 'admin',     'Acceso total a todos los endpoints del sistema'),
    (2, 'vendedor',  'Crea ventas y consulta productos/stock'),
    (3, 'bodeguero', 'Consulta y ajusta stock, registra compras');

-- ---------------------------------------------------------------------------
--  USUARIOS  (contraseñas: admin123 / vendedor123 / bodeguero123)
-- ---------------------------------------------------------------------------
INSERT INTO usuarios (id_usr, id_cli, username, password_hash, rol, activo) VALUES
    (1, NULL, 'admin',     '$2y$10$D5MBQ4o7DHndxADeAxsK/eNHRLDsq7OCAWyKhfXZOvovBiyV9qmH6', 'admin',     1),
    (2, NULL, 'vendedor',  '$2y$10$dlL6e1qFi4MAfstKLRbCdOqRV7F4k3Dz8wjGXy533GNBt8SRr7jOq', 'vendedor',  1),
    (3, NULL, 'bodeguero', '$2y$10$FR.soJMDqbAewRY1E9j76OGWgPa43jS3iFT4RubrvXcFr/TNf3vPi', 'bodeguero', 1);

-- ---------------------------------------------------------------------------
--  PROVEEDORES  (4 proveedores)
-- ---------------------------------------------------------------------------
INSERT INTO proveedores (id_prov, proveedor, contacto, email, activo) VALUES
    (1, 'Distribuidora TecnoSur',   'Pedro Salas',    'ventas@tecnosur.cl',    1),
    (2, 'Importadora HogarPlus',    'Ana Díaz',       'contacto@hogarplus.cl', 1),
    (3, 'Deportes MdM',             'Luis Tapia',     'compras@deportesmdm.cl',1),
    (4, 'Editorial Andina',         'Rocío Herrera',  'pedidos@edandina.cl',   1);

-- Nota: la tabla `ventas` se deja vacía a propósito; las ventas se generan
-- durante la demo (Etapa 6) para evidenciar el descuento de stock en vivo.
