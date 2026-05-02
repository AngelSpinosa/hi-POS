import { ipcMain } from 'electron'
import { db } from '../database'

export function registerConfigHandlers() {
  
  // Garantizamos que exista la fila #1 para poder actualizarla luego.
  try {
    db.prepare(`
      INSERT OR IGNORE INTO app_config (id, business_name, color_primary, color_secondary, setup_completed) 
      VALUES (1, 'Mi Negocio POS', '#f97316', '#3b82f6', 0)
    `).run();
  } catch (error) {
    console.error("Error inicializando app_config:", error);
  }

  // Frontend llama a esto al abrir la app para saber si mostrar el Login o el Asistente
  ipcMain.handle('get-app-config', () => {
    if (!db) return { success: false, error: 'Sin BD' };
    try {
      const config = db.prepare('SELECT * FROM app_config WHERE id = 1').get();
      return { success: true, data: config };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // Handler para actualizar la identidad visual
  ipcMain.handle('update-app-config', (_, payload) => {
    if (!db) return { success: false, error: 'Sin conexión a BD' };
    try {
      db.prepare(`
        UPDATE app_config 
        SET business_name = ?, color_primary = ?, color_secondary = ?, logo_path = ?
        WHERE id = 1
      `).run(
        payload.business_name || 'Mi Negocio', 
        payload.color_primary || '#f97316', 
        payload.color_secondary || '#3b82f6', 
        payload.logo_path || null
      );
      return { success: true };
    } catch (e: any) {
      console.error("Error actualizando app_config:", e);
      return { success: false, error: e.message };
    }
  });

  // ==========================================
  // GESTIÓN DINÁMICA DE MESAS
  // ==========================================

  ipcMain.handle('add-table', () => {
    if (!db) return { success: false, error: 'Sin BD' };
    try {
        // Primero buscamos si hay alguna mesa "desactivada" para reciclarla
        const inactive = db.prepare('SELECT id, numero FROM mesa WHERE activa = 0 ORDER BY numero ASC LIMIT 1').get() as any;
        if (inactive) {
            db.prepare('UPDATE mesa SET activa = 1 WHERE id = ?').run(inactive.id);
            return { success: true, newTableNumber: inactive.numero };
        } else {
            // Si no hay mesas reciclables, creamos una nueva buscando el número máximo
            const max = db.prepare('SELECT MAX(numero) as max FROM mesa').get() as any;
            const nextNum = (max?.max || 0) + 1;
            db.prepare('INSERT INTO mesa (numero, activa) VALUES (?, 1)').run(nextNum);
            return { success: true, newTableNumber: nextNum };
        }
    } catch (e: any) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('remove-last-table', () => {
    if (!db) return { success: false, error: 'Sin BD' };
    try {
        // Buscamos la última mesa activa
        const maxActive = db.prepare('SELECT id, numero FROM mesa WHERE activa = 1 ORDER BY numero DESC LIMIT 1').get() as any;
        if (!maxActive) return { success: false, error: 'No hay mesas activas.' };

        // 🛡️ SEGURIDAD: Verificamos que esa mesa no tenga una orden viva
        const activeOrder = db.prepare(`SELECT id FROM orden WHERE mesa_id = ? AND estatus IN ('abierta', 'enviada_cocina', 'cuenta_solicitada')`).get(maxActive.id);
        if (activeOrder) {
            return { success: false, error: `La mesa ${maxActive.numero} tiene una orden abierta. Cóbrela o cancélela primero para poder eliminarla.` };
        }

        // Realizamos el borrado lógico (Soft Delete)
        db.prepare('UPDATE mesa SET activa = 0 WHERE id = ?').run(maxActive.id);
        return { success: true, removedTableNumber: maxActive.numero };
    } catch (e: any) { return { success: false, error: e.message }; }
  });

}