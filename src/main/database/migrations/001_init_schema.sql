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

-- 3. Tabla Licencia (ACTUALIZADA)
CREATE TABLE IF NOT EXISTS licencia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,      -- El string completo generado por Python
  tipo VARCHAR(50) NOT NULL,        -- 'DEMO' o 'FULL'
  device_id VARCHAR(100) NOT NULL,  -- Dirección MAC de la tarjeta de red
  expira_en VARCHAR(50) NOT NULL,   -- Fecha ISO o 'PERPETUAL'
  firma VARCHAR(100) NOT NULL,      -- Hash de seguridad SHA256
  activa BOOLEAN DEFAULT 1,         -- Para poder revocarla desde BD si fuera necesario
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
  creado_en DATE DEFAULT CURRENT_TIMESTAMP,
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
  creado_en DATE DEFAULT CURRENT_TIMESTAMP,
  cambio FLOAT DEFAULT 0,
  FOREIGN KEY (orden_id) REFERENCES orden(id)
);