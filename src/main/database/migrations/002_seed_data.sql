-- Usuarios iniciales con PIN
INSERT INTO user (nombre, rol, pin, active) VALUES 
('Angel Admin', 'admin', '1234', 1),
('Aldo Cajero', 'cajero', '0000', 1);

-- Licencia demo (Datos falsos para cumplir con el esquema. La app pedirá activación real al iniciar)
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
(1, 1),
(2, 1),
(3, 1),
(4, 1),
(5, 1),
(6, 1),
(7, 1),
(8, 1);