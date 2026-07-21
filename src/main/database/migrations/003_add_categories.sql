-- 1. Crear tabla de categorías
CREATE TABLE IF NOT EXISTS categoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  activa BOOLEAN DEFAULT 1
);

-- 2. Modificar tabla producto para incluir la llave foránea
-- SQLite permite añadir columnas con llaves foráneas de esta manera. 
-- Por defecto el valor será NULL para los productos ya existentes.
ALTER TABLE producto ADD COLUMN categoria_id INTEGER REFERENCES categoria(id) ON DELETE SET NULL;

-- 3. Crear tabla de relación para promociones por categoría
-- Asumiendo que la tabla 'promocion' ya fue creada en la migración 002
CREATE TABLE IF NOT EXISTS promocion_categoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promocion_id INTEGER NOT NULL,
  categoria_id INTEGER NOT NULL,
  FOREIGN KEY (promocion_id) REFERENCES promocion(id) ON DELETE CASCADE,
  FOREIGN KEY (categoria_id) REFERENCES categoria(id) ON DELETE CASCADE
);