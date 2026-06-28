-- ==========================================================
-- MIGRACIÓN v0.1.1: DELIVERY, PROMOCIONES Y DIVISIÓN DE CUENTAS
-- ==========================================================

PRAGMA foreign_keys = OFF; -- Apagado temporalmente para permitir reconstrucción de tablas

BEGIN TRANSACTION;

-- =========================================
-- 1. MÓDULO DE DELIVERY
-- =========================================

CREATE TABLE IF NOT EXISTS canal_delivery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre VARCHAR(100) NOT NULL,
  activo BOOLEAN DEFAULT 1,
  comision_porcentaje_default FLOAT DEFAULT 0.0,
  impuesto_retenido_default FLOAT DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS cliente (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre VARCHAR(150) NOT NULL,
  telefono VARCHAR(20) UNIQUE,
  direccion_defecto TEXT,
  notas TEXT
);
CREATE INDEX IF NOT EXISTS idx_cliente_telefono ON cliente(telefono);

CREATE TABLE IF NOT EXISTS orden_domicilio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id INTEGER NOT NULL UNIQUE,
  cliente_id INTEGER NOT NULL,
  canal_delivery_id INTEGER NOT NULL,
  codigo_plataforma VARCHAR(50),
  costo_envio FLOAT DEFAULT 0,
  notas_entrega TEXT,
  monto_comision FLOAT DEFAULT 0,
  ingreso_neto FLOAT DEFAULT 0,
  FOREIGN KEY (orden_id) REFERENCES orden(id) ON DELETE CASCADE,
  FOREIGN KEY (cliente_id) REFERENCES cliente(id),
  FOREIGN KEY (canal_delivery_id) REFERENCES canal_delivery(id)
);

-- Alteraciones a Reporte Diario (Delivery)
ALTER TABLE reporte_diario ADD COLUMN total_ingreso_apps FLOAT DEFAULT 0;
ALTER TABLE reporte_diario ADD COLUMN total_comisiones_pagadas FLOAT DEFAULT 0;

-- =========================================
-- 2. MÓDULO DE PROMOCIONES
-- =========================================

CREATE TABLE IF NOT EXISTS promocion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre VARCHAR(150) NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- 'porcentaje', 'monto_fijo', '2x1'
  valor FLOAT NOT NULL,
  dias_activa VARCHAR(50) NOT NULL, -- Ej: '1,2,3,4,5'
  hora_inicio VARCHAR(10), -- 'HH:MM'
  hora_fin VARCHAR(10),
  activa BOOLEAN DEFAULT 1
);

CREATE TABLE IF NOT EXISTS promocion_producto (
  promocion_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  PRIMARY KEY (promocion_id, producto_id),
  FOREIGN KEY (promocion_id) REFERENCES promocion(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES producto(id) ON DELETE CASCADE
);

-- Alteraciones a OrdenItem (Promociones)
ALTER TABLE orden_item ADD COLUMN descuento_aplicado FLOAT DEFAULT 0;
ALTER TABLE orden_item ADD COLUMN promocion_id INTEGER REFERENCES promocion(id);

-- =========================================
-- 3. MÓDULO DE DIVISIÓN DE CUENTAS Y ÓRDENES
-- =========================================

-- Alteraciones a Orden (Múltiples Módulos)
-- Nota: mesa_id ya acepta NULL en tu esquema original al no tener "NOT NULL"
ALTER TABLE orden ADD COLUMN tipo_orden VARCHAR(20) DEFAULT 'local'; -- 'local', 'domicilio', 'llevar'
ALTER TABLE orden ADD COLUMN orden_padre_id INTEGER REFERENCES orden(id);
ALTER TABLE orden ADD COLUMN descuento_total FLOAT DEFAULT 0;
ALTER TABLE orden ADD COLUMN motivo_descuento VARCHAR(150);

-- Reconstrucción de Tabla Pago (Remover UNIQUE en orden_id para pagos múltiples)
CREATE TABLE IF NOT EXISTS pago_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id INTEGER NOT NULL, 
  metodo VARCHAR(50) NOT NULL,
  monto_recibido FLOAT NOT NULL,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  cambio FLOAT DEFAULT 0,
  FOREIGN KEY (orden_id) REFERENCES orden(id) ON DELETE CASCADE
);

-- Migrar datos existentes
INSERT INTO pago_new (id, orden_id, metodo, monto_recibido, creado_en, cambio)
SELECT id, orden_id, metodo, monto_recibido, creado_en, cambio FROM pago;

-- Reemplazar tabla
DROP TABLE pago;
ALTER TABLE pago_new RENAME TO pago;

COMMIT;

PRAGMA foreign_keys = ON;