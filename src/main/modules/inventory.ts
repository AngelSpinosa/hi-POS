import { db } from '../database'; // Ajusta la ruta de importación de tu instancia de BD según sea necesario
import type { Insumo, MovimientoInventario, RecetaProducto } from '../../renderer/src/types/db'; // Ajusta la ruta a tus tipos
import { ipcMain } from 'electron';

/**
 * Obtiene todos los insumos ordenados alfabéticamente
 */
export function getInsumos(): Insumo[] {
  const stmt = db.prepare('SELECT * FROM Insumo ORDER BY nombre ASC');
  return stmt.all() as Insumo[];
}

/**
 * Obtiene un insumo específico por su ID
 */
export function getInsumoById(id: number): Insumo | undefined {
  const stmt = db.prepare('SELECT * FROM Insumo WHERE id = ?');
  return stmt.get(id) as Insumo | undefined;
}

/**
 * Crea un nuevo insumo en la base de datos
 * @returns El ID del insumo recién insertado
 */
export function createInsumo(insumo: Omit<Insumo, 'id'>): number {
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
export function updateInsumo(id: number, insumo: Partial<Omit<Insumo, 'id'>>): void {
  const fields = Object.keys(insumo)
    .map(key => `${key} = @${key}`)
    .join(', ');
    
  if (!fields) return;

  const stmt = db.prepare(`UPDATE Insumo SET ${fields} WHERE id = @id`);
  stmt.run({ ...insumo, id });
}

/**
 * Elimina un insumo de la base de datos
 */
export function deleteInsumo(id: number): void {
  const stmt = db.prepare('DELETE FROM Insumo WHERE id = ?');
  stmt.run(id);
}

/**
 * Registra un movimiento de inventario (Entrada, Salida, Merma) 
 * y automáticamente actualiza el stock actual del insumo afectado.
 * * Se asume que el campo `fecha` será generado automáticamente por SQLite.
 */
export function registrarMovimiento(movimiento: Omit<MovimientoInventario, 'id' | 'fecha'>): number {
  // Envolvemos ambas operaciones en una transacción para mantener la integridad de los datos
  const transaction = db.transaction((mov: Omit<MovimientoInventario, 'id' | 'fecha'>) => {
    // 1. Insertar el registro del movimiento
    const insertStmt = db.prepare(`
      INSERT INTO MovimientoInventario (insumo_id, tipo, cantidad, motivo, fecha)
      VALUES (@insumo_id, @tipo, @cantidad, @motivo, datetime('now', 'localtime'))
    `);
    const info = insertStmt.run(mov);

    // 2. Determinar si se suma o resta al stock
    const operacion = mov.tipo === 'ENTRADA' ? '+' : '-';
    
    // 3. Actualizar el stock actual en la tabla Insumo
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

/**
 * Registra los canales IPC para la gestión de insumos en el frontend
 */
export function registerInventoryHandlers() {
  ipcMain.handle('get-insumos', () => {
    try {
      return getInsumos();
    } catch (error) {
      console.error('Error al obtener insumos:', error);
      return [];
    }
  });

  ipcMain.handle('create-insumo', (_, payload) => {
    try {
      createInsumo(payload);
      return { success: true };
    } catch (error: any) {
      console.error('Error al crear insumo:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('update-insumo', (_, payload) => {
    try {
      // Separamos el ID del resto de la data para el update
      const { id, ...data } = payload;
      updateInsumo(id, data);
      return { success: true };
    } catch (error: any) {
      console.error('Error al actualizar insumo:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-insumo', (_, payload) => {
    try {
      deleteInsumo(payload.id);
      return { success: true };
    } catch (error: any) {
      console.error('Error al eliminar insumo:', error);
      return { success: false, error: error.message };
    }
  });
}