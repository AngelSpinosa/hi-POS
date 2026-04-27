import { db } from '../database'; // Ajusta la ruta de importación de tu instancia de BD según sea necesario
import type { Insumo, movimiento_inventario, receta_producto } from '../../renderer/src/types/db'; // Ajusta la ruta a tus tipos
import { ipcMain } from 'electron';

/**
 * Obtiene todos los insumos activos ordenados alfabéticamente
 */
export function getInsumos(): Insumo[] {
  // Solo seleccionamos los insumos con active = 1
  const stmt = db.prepare('SELECT * FROM Insumo WHERE active = 1 ORDER BY nombre ASC');
  return stmt.all() as Insumo[];
}

/**
 * Obtiene un insumo específico por su ID (solo si está activo)
 */
export function getInsumoById(id: number): Insumo | undefined {
  const stmt = db.prepare('SELECT * FROM Insumo WHERE id = ? AND active = 1');
  return stmt.get(id) as Insumo | undefined;
}

/**
 * Crea un nuevo insumo en la base de datos
 * Nota: Omitimos 'id' y 'active' porque la BD los autogenera.
 */
export function createInsumo(insumo: Omit<Insumo, 'id' | 'active'>): number {
  const stmt = db.prepare(`
    INSERT INTO Insumo (codigo, nombre, unidad_medida, stock_actual, stock_minimo)
    VALUES (@codigo, @nombre, @unidad_medida, @stock_actual, @stock_minimo)
  `);
  const info = stmt.run(insumo);
  return info.lastInsertRowid as number;
}

/**
 * Actualiza parcialmente los datos de un insumo existente
 */
export function updateInsumo(id: number, insumo: Partial<Omit<Insumo, 'id' | 'active'>>): void {
  const fields = Object.keys(insumo)
    .map(key => `${key} = @${key}`)
    .join(', ');
    
  if (!fields) return;

  const stmt = db.prepare(`UPDATE Insumo SET ${fields} WHERE id = @id`);
  stmt.run({ ...insumo, id });
}

/**
 * Elimina un insumo de la base de datos de forma lógica (Soft Delete)
 */
export function deleteInsumo(id: number): void {
  // En lugar de borrar físicamente la fila, solo cambiamos active a 0
  const stmt = db.prepare('UPDATE Insumo SET active = 0 WHERE id = ?');
  stmt.run(id);
}

/**
 * Registra un movimiento de inventario (Entrada, Salida, Merma) 
 */
export function registrarMovimiento(movimiento: Omit<movimiento_inventario, 'id' | 'fecha'>): number {
  const transaction = db.transaction((mov: Omit<movimiento_inventario, 'id' | 'fecha'>) => {
    const insertStmt = db.prepare(`
      INSERT INTO movimiento_inventario (insumo_id, tipo, cantidad, motivo, fecha)
      VALUES (@insumo_id, @tipo, @cantidad, @motivo, datetime('now', 'localtime'))
    `);
    const info = insertStmt.run(mov);

    const operacion = mov.tipo === 'ENTRADA' ? '+' : '-';
    const updateStmt = db.prepare(`
      UPDATE Insumo 
      SET stock_actual = stock_actual ${operacion} @cantidad 
      WHERE id = @insumo_id
    `);
    updateStmt.run({ cantidad: mov.cantidad, insumo_id: mov.insumo_id });

    return info.lastInsertRowid;
  });

  return transaction(movimiento) as number;
}

// ==========================================
// 📊 NUEVO: HISTORIAL DE MOVIMIENTOS
// ==========================================

export function getMovimientosInventario(): any[] {
  const stmt = db.prepare(`
    SELECT m.id, m.insumo_id, m.tipo, m.cantidad, m.motivo, m.fecha,
           i.nombre as insumo_nombre, i.codigo, i.unidad_medida
    FROM movimiento_inventario m
    JOIN Insumo i ON m.insumo_id = i.id
    ORDER BY m.fecha DESC
  `);
  return stmt.all() as any[];
}


// ==========================================
// 🍕 GESTIÓN DE RECETAS (CU-44)
// ==========================================

export function getRecetaByProducto(productoId: number): any[] {
  const stmt = db.prepare(`
    SELECT r.id, r.producto_id, r.insumo_id, r.cantidad_requerida, 
           i.nombre as insumo_nombre, i.unidad_medida, i.codigo
    FROM receta_producto r
    JOIN Insumo i ON r.insumo_id = i.id
    WHERE r.producto_id = ?
  `);
  return stmt.all(productoId) as any[];
}

export function saveRecetaProducto(productoId: number, ingredientes: Omit<receta_producto, 'id' | 'producto_id'>[]): void {
  const transaction = db.transaction((id: number, ings: any[]) => {
    // 1. Limpiamos la receta anterior
    db.prepare('DELETE FROM receta_producto WHERE producto_id = ?').run(id);
    
    // 2. Insertamos los nuevos ingredientes
    const insertStmt = db.prepare(`
      INSERT INTO receta_producto (producto_id, insumo_id, cantidad_requerida) 
      VALUES (?, ?, ?)
    `);
    
    for (const ing of ings) {
      insertStmt.run(id, ing.insumo_id, ing.cantidad_requerida);
    }
  });
  
  transaction(productoId, ingredientes);
}

/**
 * 🚀 FUNCIÓN MAESTRA (CU-44): Descuenta los insumos automáticamente según la receta de los productos vendidos.
 * Esta función debe ser llamada desde tu módulo de órdenes cuando se confirma un pago.
 */
export function descontarInventarioPorVenta(itemsVendidos: { producto_id: number; cantidad: number }[]): void {
  const transaction = db.transaction((items: any[]) => {
    const getRecetaStmt = db.prepare('SELECT insumo_id, cantidad_requerida FROM receta_producto WHERE producto_id = ?');
    const insertMovStmt = db.prepare(`
      INSERT INTO movimiento_inventario (insumo_id, tipo, cantidad, motivo, fecha)
      VALUES (@insumo_id, 'SALIDA', @cantidad, 'Venta automática POS', datetime('now', 'localtime'))
    `);
    const updateStockStmt = db.prepare(`
      UPDATE Insumo SET stock_actual = stock_actual - @cantidad WHERE id = @insumo_id
    `);

    for (const item of items) {
      const receta = getRecetaStmt.all(item.producto_id) as any[];
      
      for (const ingrediente of receta) {
        // Multiplicamos lo que requiere la receta por la cantidad de platillos vendidos
        const totalADescontar = ingrediente.cantidad_requerida * item.cantidad;
        
        insertMovStmt.run({ insumo_id: ingrediente.insumo_id, cantidad: totalADescontar });
        updateStockStmt.run({ cantidad: totalADescontar, insumo_id: ingrediente.insumo_id });
      }
    }
  });

  transaction(itemsVendidos);
}


/**
 * Registra los canales IPC
 */
export function registerInventoryHandlers() {
  ipcMain.handle('get-insumos', () => {
    try { return getInsumos(); } 
    catch (error) { console.error(error); return []; }
  });

  ipcMain.handle('create-insumo', (_, payload) => {
    try { 
      // Nos aseguramos de no enviar ids vacíos u otros campos extra a createInsumo
      const { id, active, ...data } = payload;
      createInsumo(data); 
      return { success: true }; 
    } 
    catch (error: any) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('update-insumo', (_, payload) => {
    try {
      const { id, active, ...data } = payload;
      updateInsumo(id, data);
      return { success: true };
    } 
    catch (error: any) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('delete-insumo', (_, payload) => {
    try { deleteInsumo(payload.id); return { success: true }; } 
    catch (error: any) { return { success: false, error: error.message }; }
  });

  // CANALES PARA RECETAS
  ipcMain.handle('get-receta', (_, productoId: number) => {
    try { return { success: true, data: getRecetaByProducto(productoId) }; } 
    catch (error: any) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('save-receta', (_, payload: { productoId: number, ingredientes: any[] }) => {
    try { 
      saveRecetaProducto(payload.productoId, payload.ingredientes); 
      return { success: true }; 
    } 
    catch (error: any) { return { success: false, error: error.message }; }
  });

  // CANAL PARA REGISTRAR MOVIMIENTOS (REABASTO/MERMA)
  ipcMain.handle('register-movement', (_, payload: Omit<movimiento_inventario, 'id' | 'fecha'>) => {
    try {
      registrarMovimiento(payload);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // NUEVO: CANAL PARA OBTENER EL HISTORIAL
  ipcMain.handle('get-movimientos', () => {
    try {
      return { success: true, data: getMovimientosInventario() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}