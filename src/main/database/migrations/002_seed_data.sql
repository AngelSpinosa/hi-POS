-- Usuarios iniciales con PIN
INSERT INTO user (nombre, rol, pin, active) VALUES 
('Angel Admin', 'admin', '1234', 1),
('Aldo Cajero', 'cajero', '0000', 1);

-- Licencia demo 
INSERT INTO licencia (codigo, tipo, device_id, expira_en, firma, activa) VALUES 
('DEMO|D0:AB:D5:58:B0:4C|2026-02-09|E2312852B519', 'DEMO', 'D0:AB:D5:58:B0:4C', '2020-12-31', 'FALSO', 1);

-- Productos de Pizzería
INSERT INTO producto (nombre, precio, active) VALUES 
('PIZZA PEPPERONI GRANDE', 180, 1),
('PIZZA HAWAIANA MEDIANA', 150, 1),
('PIZZA QUESO INDIVIDUAL', 80, 1),
('REFRESCO 2L', 40, 1),
('ORDEN DE ALITAS (6PZ)', 95, 1);

-- Mesas iniciales
INSERT INTO mesa (numero, activa) VALUES 
(1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1), (8, 1);

-- =========================================
-- DATOS SEMILLA: INVENTARIO Y RECETAS
-- =========================================

-- Insumos base
INSERT INTO insumo (codigo, nombre, unidad_medida, stock_actual, stock_minimo) VALUES 
('INS-001', 'Masa para Pizza', 'KG', 10.0, 2.0),
('INS-002', 'Queso Mozzarella', 'KG', 5.0, 1.0),
('INS-003', 'Pepperoni en rebanadas', 'KG', 3.0, 0.5),
('INS-004', 'Salsa de Tomate Base', 'L', 4.0, 1.0),
('INS-005', 'Coca-Cola 2L', 'PZ', 24.0, 5.0);

-- Receta: Pizza Pepperoni Grande (Producto ID: 1)
INSERT INTO receta_producto (producto_id, insumo_id, cantidad_requerida) VALUES 
(1, 1, 0.400), -- 400 gramos de Masa
(1, 4, 0.150), -- 150 mililitros de Salsa
(1, 2, 0.250), -- 250 gramos de Queso
(1, 3, 0.100); -- 100 gramos de Pepperoni

-- Receta: Refresco 2L (Producto ID: 4)
INSERT INTO receta_producto (producto_id, insumo_id, cantidad_requerida) VALUES 
(4, 5, 1.0); -- 1 Pieza exacta del insumo