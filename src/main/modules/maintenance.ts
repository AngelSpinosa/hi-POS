import { ipcMain, dialog, app } from 'electron'
import { db, closeDatabase, currentDbPath } from '../database' 
import fs from 'fs'
import Database from 'better-sqlite3' 

export function registerMaintenanceHandlers() {
  
  // ==========================================
  // CU-47: RESTABLECER BASE DE DATOS
  // ==========================================
  ipcMain.handle('reset-database', (_, options: { transactions: boolean, catalog: boolean, users: boolean }) => {
    if (!db) return { success: false, error: 'Sin conexión a BD' }

    try {
      const tx = db.transaction(() => {
        if (options.transactions) {
          db.prepare('DELETE FROM pago').run();
          db.prepare('DELETE FROM orden_item').run();
          db.prepare('DELETE FROM orden').run();
          db.prepare('DELETE FROM reporte_diario').run();
          db.prepare('DELETE FROM movimiento_inventario').run();
          db.prepare(`UPDATE sqlite_sequence SET seq = 0 WHERE name IN ('pago', 'orden_item', 'orden', 'reporte_diario', 'movimiento_inventario')`).run();
          db.prepare('UPDATE insumo SET stock_actual = 0').run();
        }

        if (options.catalog) {
          db.prepare('DELETE FROM receta_producto').run();
          db.prepare('DELETE FROM producto').run();
          db.prepare('DELETE FROM insumo').run();
          db.prepare(`UPDATE sqlite_sequence SET seq = 0 WHERE name IN ('producto', 'insumo', 'receta_producto')`).run();
        }

        if (options.users) {
          db.prepare("DELETE FROM user WHERE rol != 'admin'").run();
        }
      });
      
      tx();
      return { success: true };
    } catch (error: any) {
      console.error('Error al restablecer la base de datos:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // INYECTAR DATOS DE PRUEBA
  // ==========================================
  ipcMain.handle('inject-demo-data', () => {
    if (!db) return { success: false, error: 'Sin conexión a BD' }

    try {
      const tx = db.transaction(() => {
        // CORRECCIÓN: Agregado el campo 'codigo' a la consulta de insumos
        const insumoInsert = db.prepare('INSERT OR IGNORE INTO insumo (codigo, nombre, unidad_medida, stock_actual, stock_minimo) VALUES (?, ?, ?, ?, ?)');
        const insPeperoni = insumoInsert.run('INS-PEP', 'Peperoni', 'GR', 5000, 500).lastInsertRowid;
        const insMasa = insumoInsert.run('INS-MAS', 'Masa de Pizza', 'GR', 10000, 1000).lastInsertRowid;
        const insAlitas = insumoInsert.run('INS-ALI', 'Alitas de Pollo', 'PZ', 200, 50).lastInsertRowid;
        const insSalsaBBQ = insumoInsert.run('INS-BBQ', 'Salsa BBQ', 'ML', 3000, 500).lastInsertRowid;

        const prodInsert = db.prepare('INSERT OR IGNORE INTO producto (nombre, precio) VALUES (?, ?)');
        const prodPizza = prodInsert.run('Pizza Peperoni', 150).lastInsertRowid;
        const prodAlitas = prodInsert.run('Alitas BBQ', 120).lastInsertRowid;
        const recetaInsert = db.prepare('INSERT OR IGNORE INTO receta_producto (producto_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?)');
        
        // Verificamos que se hayan insertado correctamente antes de vincular las recetas
        if (prodPizza && insMasa) recetaInsert.run(prodPizza, insMasa, 250);
        if (prodPizza && insPeperoni) recetaInsert.run(prodPizza, insPeperoni, 50);
        if (prodAlitas && insAlitas) recetaInsert.run(prodAlitas, insAlitas, 10);
        if (prodAlitas && insSalsaBBQ) recetaInsert.run(prodAlitas, insSalsaBBQ, 50);

        const userInsert = db.prepare('INSERT OR IGNORE INTO user (nombre, pin, rol, active) VALUES (?, ?, ?, 1)');
        userInsert.run('Angel Admin', '9999', 'admin');
        userInsert.run('Aldo Cajero', '8888', 'cajero');
      });
      
      tx();
      return { success: true };
    } catch (error: any) {
      console.error('Error inyectando datos de prueba:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // CU-48: CREAR RESPALDO LOCAL (REESCRITURA TOTAL)
  // ==========================================
  ipcMain.handle('export-database', async () => {
    try {
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const defaultPath = `hiPOS_backup_${dateStr}.db`;

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar Respaldo de Base de Datos',
        defaultPath,
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
      });

      if (canceled || !filePath) return { success: false, canceled: true };

      // Extrae un respaldo perfecto y completo sin importar el WAL ni bloqueos.
      await db.backup(filePath);

      return { success: true, path: filePath };
    } catch (error: any) {
      console.error('Error al crear el respaldo:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // CU-49: IMPORTAR RESPALDO LOCAL (REESCRITURA SEGURA)
  // ==========================================
  ipcMain.handle('import-database', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Seleccionar Respaldo de Base de Datos',
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        properties: ['openFile']
      });

      if (canceled || filePaths.length === 0) return { success: false, canceled: true };

      const sourcePath = filePaths[0];

      let currentLicense: any = null;
      try {
        currentLicense = db.prepare('SELECT * FROM licencia WHERE activa = 1 ORDER BY id DESC LIMIT 1').get();
      } catch (err) {
        console.warn("No se pudo obtener licencia actual o no existe.", err);
      }

      // Cerrar la conexión principal
      closeDatabase();

      const walPath = `${currentDbPath}-wal`;
      const shmPath = `${currentDbPath}-shm`;
      
      try { if (fs.existsSync(walPath)) fs.unlinkSync(walPath); } catch (e) { }
      try { if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath); } catch (e) { }

      try {
        if (fs.existsSync(currentDbPath)) {
            fs.rmSync(currentDbPath, { force: true });
        }
        fs.copyFileSync(sourcePath, currentDbPath);
      } catch (fsError) {
         console.error("Error al reemplazar el archivo físico:", fsError);
         return { success: false, error: "No se pudo sobrescribir la base de datos." };
      }

      if (currentLicense) {
        try {
          const tempDb = new Database(currentDbPath);
          const tx = tempDb.transaction(() => {
            tempDb.prepare(`
              CREATE TABLE IF NOT EXISTS licencia (
                id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT NOT NULL UNIQUE, tipo VARCHAR(50) NOT NULL, 
                device_id VARCHAR(100) NOT NULL, expira_en VARCHAR(50) NOT NULL, firma VARCHAR(100) NOT NULL, 
                activa BOOLEAN DEFAULT 1, creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `).run();
            
            tempDb.prepare('UPDATE licencia SET activa = 0').run();
            
            tempDb.prepare(`
              INSERT INTO licencia (codigo, tipo, device_id, expira_en, firma, activa, creado_en)
              VALUES (?, ?, ?, ?, ?, 1, ?)
            `).run(
              currentLicense.codigo, currentLicense.tipo, currentLicense.device_id, 
              currentLicense.expira_en, currentLicense.firma, currentLicense.creado_en
            );
          });
          tx();
          tempDb.close();
        } catch (err) {
          console.error('Error restaurando la licencia en el archivo importado:', err);
        }
      }

      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, 500);

      return { success: true };
    } catch (error: any) {
      console.error('Error en restauración:', error);
      return { success: false, error: error.message };
    }
  });

}