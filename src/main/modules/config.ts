import { ipcMain } from 'electron'
import { db } from '../database'

export function registerConfigHandlers() {
  
  // Garantizamos que exista la fila #1 para poder actualizarla luego.
  // INSERT OR IGNORE no sobreescribirá si ya existe.
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

}