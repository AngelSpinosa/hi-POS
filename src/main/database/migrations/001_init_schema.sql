-- Habilitar claves foráneas por seguridad
PRAGMA foreign_keys = ON;

-- 1. Tabla de Control de Migraciones
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  ejecutado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla User
CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre VARCHAR(100) NOT NULL,
  rol VARCHAR(50) NOT NULL, -- 'admin', 'cajero'
  pin VARCHAR(10) NOT NULL, -- Clave de acceso rápida
  active BOOLEAN DEFAULT 1,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP -- Auditoría de creación
);

-- 3. Tabla Licencia
CREATE TABLE IF NOT EXISTS licencia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,      
  tipo VARCHAR(50) NOT NULL,        
  device_id VARCHAR(100) NOT NULL,  
  expira_en VARCHAR(50) NOT NULL,   
  firma VARCHAR(100) NOT NULL,      
  activa BOOLEAN DEFAULT 1,         
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla Reporte Diario
CREATE TABLE IF NOT EXISTS reporte_diario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  total_ventas INTEGER DEFAULT 0,
  total_pedidos INTEGER DEFAULT 0,
  total_efectivo INTEGER DEFAULT 0,
  total_tarjeta INTEGER DEFAULT 0,
  dinero_real FLOAT DEFAULT NULL,
  diferencia FLOAT DEFAULT NULL,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabla Mesa
CREATE TABLE IF NOT EXISTS mesa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero INTEGER NOT NULL UNIQUE,
  activa BOOLEAN DEFAULT 1
);

-- 6. Tabla Orden
CREATE TABLE IF NOT EXISTS orden (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  id_reporte_diario INTEGER,
  mesa_id INTEGER,
  estatus VARCHAR(50) DEFAULT 'abierta',
  total FLOAT DEFAULT 0,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  ticket_impreso BOOLEAN DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES user(id),
  FOREIGN KEY (id_reporte_diario) REFERENCES reporte_diario(id),
  FOREIGN KEY (mesa_id) REFERENCES mesa(id)
);

-- 7. Tabla Producto
CREATE TABLE IF NOT EXISTS producto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre VARCHAR(150) NOT NULL,
  precio INTEGER NOT NULL,
  active BOOLEAN DEFAULT 1
);

-- 8. Tabla Orden Item
CREATE TABLE IF NOT EXISTS orden_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  precio FLOAT NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  comanda_impresa BOOLEAN DEFAULT 0,
  FOREIGN KEY (orden_id) REFERENCES orden(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES producto(id)
);

-- 9. Tabla Pago
CREATE TABLE IF NOT EXISTS pago (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id INTEGER NOT NULL UNIQUE, 
  metodo VARCHAR(50) NOT NULL,
  monto_recibido FLOAT NOT NULL,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  cambio FLOAT DEFAULT 0,
  FOREIGN KEY (orden_id) REFERENCES orden(id)
);

-- =========================================
-- NUEVAS TABLAS: SISTEMA DE INVENTARIO
-- =========================================

-- 10. Tabla Insumo (Materia Prima o Productos Cerrados)
CREATE TABLE IF NOT EXISTS insumo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nombre VARCHAR(150) NOT NULL,
  unidad_medida VARCHAR(20) NOT NULL, -- Ej: 'KG', 'GR', 'L', 'ML', 'PZ'
  stock_actual FLOAT NOT NULL DEFAULT 0,
  stock_minimo FLOAT NOT NULL DEFAULT 0
);

-- 11. Tabla Receta_Producto (La receta / Explosión de materiales)
CREATE TABLE IF NOT EXISTS receta_producto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL,
  insumo_id INTEGER NOT NULL,
  cantidad_requerida FLOAT NOT NULL,
  FOREIGN KEY (producto_id) REFERENCES producto(id) ON DELETE CASCADE,
  FOREIGN KEY (insumo_id) REFERENCES insumo(id) ON DELETE CASCADE
);

-- 12. Tabla Movimiento_Inventario (Auditoría de Entradas/Salidas)
CREATE TABLE IF NOT EXISTS movimiento_inventario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  insumo_id INTEGER NOT NULL,
  tipo VARCHAR(20) NOT NULL, -- 'ENTRADA', 'SALIDA', 'MERMA'
  cantidad FLOAT NOT NULL,
  motivo VARCHAR(150) NOT NULL, -- Ej: 'Venta Orden #5', 'Compra a Proveedor'
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (insumo_id) REFERENCES insumo(id) ON DELETE CASCADE
);