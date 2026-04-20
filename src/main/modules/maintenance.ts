import { ipcMain, dialog, app } from 'electron'
import { db } from '../database'
import fs from 'fs'

export function registerMaintenanceHandlers() {
  
  // ==========================================
  // CU-47: RESTABLECER BASE DE DATOS
  // ==========================================
  ipcMain.handle('reset-database', (_, options: { transactions: boolean, catalog: boolean, users: boolean }) => {
    if (!db) return { success: false, error: 'Sin conexión a BD' }

    try {
      const tx = db.transaction(() => {
        // 1. Borrar Transacciones
        if (options.transactions) {
          db.prepare('DELETE FROM pago').run();
          db.prepare('DELETE FROM orden_item').run();
          db.prepare('DELETE FROM orden').run();
          db.prepare('DELETE FROM reporte_diario').run();
          db.prepare('DELETE FROM movimiento_inventario').run();
          
          db.prepare(`UPDATE sqlite_sequence SET seq = 0 WHERE name IN ('pago', 'orden_item', 'orden', 'reporte_diario', 'movimiento_inventario')`).run();
          db.prepare('UPDATE insumo SET stock_actual = 0').run();
        }

        // 2. Borrar Catálogo
        if (options.catalog) {
          db.prepare('DELETE FROM receta_producto').run();
          db.prepare('DELETE FROM producto').run();
          db.prepare('DELETE FROM insumo').run();
          
          db.prepare(`UPDATE sqlite_sequence SET seq = 0 WHERE name IN ('receta_producto', 'producto', 'insumo')`).run();
        }

        // 3. Borrar Personal
        if (options.users) {
          db.prepare(`
            DELETE FROM user 
            WHERE id NOT IN (
              SELECT id FROM user WHERE rol = 'admin' ORDER BY id ASC LIMIT 1
            )
          `).run();
        }
      });

      tx();
      return { success: true };
    } catch (error: any) {
      console.error('Error restableciendo BD:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // CU-48: RESPALDAR Y RESTAURAR BD
  // ==========================================

  // EXPORTAR (Respaldar)
  ipcMain.handle('export-database', async () => {
    try {
      // Pedimos al usuario dónde quiere guardar el respaldo
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar Respaldo de Base de Datos',
        defaultPath: `Respaldo_POS_${new Date().toISOString().split('T')[0]}.db`,
        filters: [
          { name: 'Base de Datos SQLite', extensions: ['db', 'sqlite', 'posbackup'] }
        ]
      });

      if (canceled || !filePath) return { success: false, canceled: true };

      // Copiamos el archivo .db actual hacia la nueva ruta
      // @ts-ignore - db.name contiene la ruta física del archivo si usas better-sqlite3
      fs.copyFileSync(db.name, filePath);
      
      return { success: true };
    } catch (error: any) {
      console.error('Error al exportar BD:', error);
      return { success: false, error: error.message };
    }
  });

  // IMPORTAR (Restaurar)
  ipcMain.handle('import-database', async () => {
    try {
      // Pedimos al usuario que seleccione su respaldo
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Seleccionar Respaldo a Importar',
        properties: ['openFile'],
        filters: [
          { name: 'Base de Datos SQLite', extensions: ['db', 'sqlite', 'posbackup'] }
        ]
      });

      if (canceled || filePaths.length === 0) return { success: false, canceled: true };

      const backupPath = filePaths[0];

      // 1. Cerramos la conexión a la base de datos actual para liberar el archivo
      db.close();

      // 2. Sobrescribimos el archivo actual con el respaldo
      // @ts-ignore
      fs.copyFileSync(backupPath, db.name);

      // 3. Reiniciamos la aplicación para que vuelva a conectar con los nuevos datos
      app.relaunch();
      app.exit(0);

      return { success: true }; // Técnicamente no llegará aquí por el exit(), pero es buena práctica
    } catch (error: any) {
      console.error('Error al importar BD:', error);
      return { success: false, error: error.message };
    }
  });
}