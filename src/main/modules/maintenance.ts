import { ipcMain, dialog, app } from 'electron'
import { db } from '../database'
import fs from 'fs'
import Database from 'better-sqlite3' // IMPORTANTE: Agregamos esta importación

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
      
      // En modo WAL, debemos asegurar que SQLite haga un "checkpoint" 
      // antes de exportar, pero better-sqlite3 ya gestiona bien el archivo .db base
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
      
      // @ts-ignore
      const targetPath = db.name; // Obtenemos la ruta exacta de pos.db

      // 🛡️ 1. SALVAGUARDAR LA LICENCIA Y SEGURIDAD LOCAL 
      let currentLicense: any = null;
      let currentSecurity: any[] = [];
      try {
        currentLicense = db.prepare('SELECT * FROM licencia WHERE activa = 1 ORDER BY id DESC LIMIT 1').get();
        // Asegurarnos de que el respaldo no pise nuestro historial de seguridad (Ej. Device ID y Time Tampering)
        const hasSecurityTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='security_config'").get();
        if (hasSecurityTable) {
          currentSecurity = db.prepare('SELECT * FROM security_config').all() as any[];
        }
      } catch(e) {
        console.log('No se encontró licencia o config de seguridad local para respaldar.');
      }
      
      // 2. Cerrar conexión a BD actual
      db.close();
      
      // 3. Sobrescribir pos.db con el respaldo
      fs.copyFileSync(backupPath, targetPath);

      // 4. ¡CRÍTICO! Eliminar archivos temporales WAL y SHM
      if (fs.existsSync(`${targetPath}-wal`)) fs.unlinkSync(`${targetPath}-wal`);
      if (fs.existsSync(`${targetPath}-shm`)) fs.unlinkSync(`${targetPath}-shm`);

      // 🛡️ 5. INYECTAR LA LICENCIA GUARDADA EN LA NUEVA BASE DE DATOS
      if (currentLicense || currentSecurity.length > 0) {
        const tempDb = new Database(targetPath); // Abrimos la BD recién importada
        try {
          const tx = tempDb.transaction(() => {
            
            // A. Restaurar tabla de seguridad (Device ID)
            if (currentSecurity.length > 0) {
              tempDb.prepare('CREATE TABLE IF NOT EXISTS security_config (id TEXT PRIMARY KEY, value TEXT)').run();
              tempDb.prepare('DELETE FROM security_config').run(); // Limpiamos los datos que trajera el respaldo
              const insertSec = tempDb.prepare('INSERT INTO security_config (id, value) VALUES (?, ?)');
              for (const conf of currentSecurity) {
                insertSec.run(conf.id, conf.value);
              }
            }

            // B. Restaurar Licencia Activa
            if (currentLicense) {
              tempDb.prepare(`
                CREATE TABLE IF NOT EXISTS licencia (
                  id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT NOT NULL UNIQUE, tipo VARCHAR(50) NOT NULL, 
                  device_id VARCHAR(100) NOT NULL, expira_en VARCHAR(50) NOT NULL, firma VARCHAR(100) NOT NULL, 
                  activa BOOLEAN DEFAULT 1, creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
                )
              `).run();
              
              tempDb.prepare('UPDATE licencia SET activa = 0').run(); // Desactivar cualquier licencia que trajera el respaldo
              
              tempDb.prepare(`
                INSERT INTO licencia (codigo, tipo, device_id, expira_en, firma, activa, creado_en)
                VALUES (?, ?, ?, ?, ?, 1, ?)
              `).run(
                currentLicense.codigo, currentLicense.tipo, currentLicense.device_id, 
                currentLicense.expira_en, currentLicense.firma, currentLicense.creado_en
              );
            }
          });
          tx();
        } catch (err) {
          console.error('Error restaurando la licencia en el archivo importado:', err);
        } finally {
          tempDb.close();
        }
      }

      // 6. Reiniciar la aplicación
      app.relaunch();
      app.exit(0);

      return { success: true };
    } catch (error: any) {
      console.error('Error en restauración:', error);
      return { success: false, error: error.message };
    }
  });
}