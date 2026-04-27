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
  // DATOS DE PRUEBA (DEMO)
  // ==========================================
  ipcMain.handle('inject-demo-data', () => {
    if (!db) return { success: false, error: 'Sin conexión a BD' };

    try {
      const tx = db.transaction(() => {
        // Asegurarse de tener al menos un administrador y un cajero
        db.prepare("INSERT OR IGNORE INTO user (id, nombre, rol, pin, active) VALUES (998, 'Angel Admin', 'admin', '1234', 1)").run();
        db.prepare("INSERT OR IGNORE INTO user (id, nombre, rol, pin, active) VALUES (999, 'Aldo Cajero', 'cajero', '0000', 1)").run();

        // 10 Mesas
        const insertMesa = db.prepare('INSERT OR IGNORE INTO mesa (numero, activa) VALUES (?, 1)');
        for(let i = 1; i <= 10; i++) insertMesa.run(i);

        // 5 Productos
        db.prepare("INSERT INTO producto (nombre, precio, active) VALUES ('PIZZA PEPPERONI GRANDE', 180, 1)").run();
        db.prepare("INSERT INTO producto (nombre, precio, active) VALUES ('PIZZA HAWAIANA MEDIANA', 150, 1)").run();
        db.prepare("INSERT INTO producto (nombre, precio, active) VALUES ('REFRESCO 2L', 40, 1)").run();
        db.prepare("INSERT INTO producto (nombre, precio, active) VALUES ('ORDEN DE ALITAS (6PZ)', 95, 1)").run();
        
        // 5 Insumos base
        db.prepare("INSERT INTO insumo (codigo, nombre, unidad_medida, stock_actual, stock_minimo) VALUES ('INS-001', 'Masa para Pizza', 'KG', 10.0, 2.0)").run();
        db.prepare("INSERT INTO insumo (codigo, nombre, unidad_medida, stock_actual, stock_minimo) VALUES ('INS-002', 'Queso Mozzarella', 'KG', 5.0, 1.0)").run();
        db.prepare("INSERT INTO insumo (codigo, nombre, unidad_medida, stock_actual, stock_minimo) VALUES ('INS-003', 'Pepperoni en rebanadas', 'KG', 3.0, 0.5)").run();
        db.prepare("INSERT INTO insumo (codigo, nombre, unidad_medida, stock_actual, stock_minimo) VALUES ('INS-004', 'Salsa de Tomate Base', 'L', 4.0, 1.0)").run();
        db.prepare("INSERT INTO insumo (codigo, nombre, unidad_medida, stock_actual, stock_minimo) VALUES ('INS-005', 'Refresco 2L', 'PZ', 24.0, 5.0)").run();
        
      });
      
      tx();
      return { success: true };
    } catch(e: any) {
      console.error('Error inyectando datos demo:', e);
      return { success: false, error: e.message };
    }
  });

  // ==========================================
  // CU-48: RESPALDAR Y RESTAURAR BD
  // ==========================================

  // EXPORTAR (Respaldar)
  ipcMain.handle('export-database', async () => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar Respaldo de Base de Datos',
        defaultPath: `Respaldo_POS_${new Date().toISOString().split('T')[0]}.db`,
        filters: [{ name: 'Base de Datos SQLite', extensions: ['db', 'sqlite', 'posbackup'] }]
      });

      if (canceled || !filePath) return { success: false, canceled: true };
      // @ts-ignore
      fs.copyFileSync(db.name, filePath);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // IMPORTAR (Restaurar)
  ipcMain.handle('import-database', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Seleccionar Respaldo a Importar',
        properties: ['openFile'],
        filters: [{ name: 'Base de Datos SQLite', extensions: ['db', 'sqlite', 'posbackup'] }]
      });

      if (canceled || filePaths.length === 0) return { success: false, canceled: true };

      const backupPath = filePaths[0];
      db.close();
      // @ts-ignore
      fs.copyFileSync(backupPath, db.name);

      app.relaunch();
      app.exit(0);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}