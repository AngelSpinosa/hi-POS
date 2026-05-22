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
  // INYECTOR DE DATOS DE PRUEBA DINÁMICO
  // ==========================================
  ipcMain.handle('inject-demo-data', (_, { category }) => {
    if (!db) return { success: false, error: 'Sin conexión a BD' };

    // Diccionario de datos ricos por categoría
    const datasets: any = {
      pizza: {
        insumos: [
          { cod: 'HAR-01', nom: 'Harina de Trigo', um: 'kg', cant: 50, min: 10 },
          { cod: 'QUE-01', nom: 'Queso Mozzarella', um: 'kg', cant: 20, min: 5 },
          { cod: 'PEP-01', nom: 'Peperoni en rodajas', um: 'kg', cant: 15, min: 3 },
          { cod: 'SAL-01', nom: 'Salsa de Tomate', um: 'lt', cant: 30, min: 5 },
          { cod: 'ALI-01', nom: 'Alitas de Pollo', um: 'kg', cant: 25, min: 5 },
          { cod: 'REF-01', nom: 'Refresco Cola 600ml', um: 'pz', cant: 100, min: 20 }
        ],
        productos: [
          { nom: 'Pizza Peperoni Grande', precio: 180, receta: [{cod: 'HAR-01', req: 0.3}, {cod: 'QUE-01', req: 0.25}, {cod: 'PEP-01', req: 0.1}, {cod: 'SAL-01', req: 0.15}] },
          { nom: 'Pizza Queso Mediana', precio: 140, receta: [{cod: 'HAR-01', req: 0.2}, {cod: 'QUE-01', req: 0.3}, {cod: 'SAL-01', req: 0.1}] },
          { nom: 'Orden Alitas BBQ (500g)', precio: 120, receta: [{cod: 'ALI-01', req: 0.5}] },
          { nom: 'Refresco Cola', precio: 30, receta: [{cod: 'REF-01', req: 1}] }
        ]
      },
      restaurante: {
        insumos: [
          { cod: 'CAR-01', nom: 'Carne de Res Molida', um: 'kg', cant: 40, min: 10 },
          { cod: 'PAN-01', nom: 'Pan Hamburguesa', um: 'pz', cant: 150, min: 30 },
          { cod: 'PAP-01', nom: 'Papa Blanca', um: 'kg', cant: 50, min: 15 },
          { cod: 'TOC-01', nom: 'Tocino Ahumado', um: 'kg', cant: 10, min: 2 },
          { cod: 'CER-01', nom: 'Cerveza Clara 355ml', um: 'pz', cant: 200, min: 48 }
        ],
        productos: [
          { nom: 'Hamburguesa Clásica c/Papas', precio: 150, receta: [{cod: 'CAR-01', req: 0.2}, {cod: 'PAN-01', req: 1}, {cod: 'PAP-01', req: 0.3}] },
          { nom: 'Hamburguesa Tocino Especial', precio: 180, receta: [{cod: 'CAR-01', req: 0.2}, {cod: 'PAN-01', req: 1}, {cod: 'PAP-01', req: 0.3}, {cod: 'TOC-01', req: 0.05}] },
          { nom: 'Orden Papas Francesas', precio: 60, receta: [{cod: 'PAP-01', req: 0.4}] },
          { nom: 'Cerveza Clara', precio: 45, receta: [{cod: 'CER-01', req: 1}] }
        ]
      },
      cafe: {
        insumos: [
          { cod: 'CAF-01', nom: 'Café en Grano Tostado', um: 'kg', cant: 20, min: 5 },
          { cod: 'LEC-01', nom: 'Leche Entera', um: 'lt', cant: 60, min: 12 },
          { cod: 'CHO-01', nom: 'Jarabe de Chocolate', um: 'lt', cant: 10, min: 2 },
          { cod: 'PAS-01', nom: 'Pastel Zanahoria (Entero)', um: 'pz', cant: 5, min: 1 },
          { cod: 'CRO-01', nom: 'Croissant Mantequilla', um: 'pz', cant: 40, min: 10 }
        ],
        productos: [
          { nom: 'Capuchino Clásico', precio: 65, receta: [{cod: 'CAF-01', req: 0.02}, {cod: 'LEC-01', req: 0.25}] },
          { nom: 'Frappé Mocha', precio: 85, receta: [{cod: 'CAF-01', req: 0.02}, {cod: 'LEC-01', req: 0.2}, {cod: 'CHO-01', req: 0.03}] },
          { nom: 'Rebanada Pastel Zanahoria', precio: 70, receta: [{cod: 'PAS-01', req: 0.125}] }, // 1/8 de pastel
          { nom: 'Croissant Sencillo', precio: 45, receta: [{cod: 'CRO-01', req: 1}] }
        ]
      }
    };

    const data = datasets[category] || datasets['pizza'];

    try {
      const tx = db.transaction(() => {
        // 1. Crear Admin si no existe
        const adminCount = db.prepare("SELECT count(*) as count FROM user WHERE rol = 'admin'").get() as any;
        if (adminCount.count === 0) {
          db.prepare("INSERT INTO user (nombre, rol, pin, active) VALUES ('Admin Demo', 'admin', '1234', 1)").run();
        }

        // 2. Crear Cajero de prueba
        const cajeroExists = db.prepare("SELECT id FROM user WHERE nombre = 'Cajero Demo'").get();
        if (!cajeroExists) {
          db.prepare("INSERT INTO user (nombre, rol, pin, active) VALUES ('Cajero Demo', 'cajero', '0000', 1)").run();
        }

        // 3. Crear 10 mesas si no hay suficientes
        const mesasCount = db.prepare("SELECT count(*) as count FROM mesa").get() as any;
        if (mesasCount.count < 10) {
          const insertMesa = db.prepare('INSERT OR IGNORE INTO mesa (numero, activa) VALUES (?, 1)');
          for (let i = 1; i <= 10; i++) insertMesa.run(i);
        }

        // Preparamos sentencias para inventario y menú
        const insertInsumo = db.prepare('INSERT INTO insumo (codigo, nombre, unidad_medida, stock_actual, stock_minimo, active) VALUES (?, ?, ?, ?, ?, 1)');
        const insertMovimiento = db.prepare("INSERT INTO movimiento_inventario (insumo_id, tipo, cantidad, motivo, fecha) VALUES (?, 'ENTRADA', ?, 'Inventario Inicial Demo', datetime('now', 'localtime'))");
        const insertProducto = db.prepare('INSERT INTO producto (nombre, precio, active) VALUES (?, ?, 1)');
        const insertReceta = db.prepare('INSERT INTO receta_producto (producto_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?)');

        // Mapa temporal para saber el ID generado de cada insumo basado en su código
        const insumosMap = new Map();

        // 4. Inyectar Insumos y registrar movimiento de Entrada para el historial
        data.insumos.forEach((ins: any) => {
          const info = insertInsumo.run(ins.cod, ins.nom, ins.um, ins.cant, ins.min);
          const newInsumoId = info.lastInsertRowid;
          insumosMap.set(ins.cod, newInsumoId);
          // Registrar el movimiento en el historial
          insertMovimiento.run(newInsumoId, ins.cant);
        });

        // 5. Inyectar Productos y sus Recetas
        data.productos.forEach((prod: any) => {
          const info = insertProducto.run(prod.nom, prod.precio);
          const newProdId = info.lastInsertRowid;
          
          prod.receta.forEach((req: any) => {
            const insumoId = insumosMap.get(req.cod);
            if (insumoId) {
              insertReceta.run(newProdId, insumoId, req.req);
            }
          });
        });
      });

      tx();
      return { success: true };
    } catch (error: any) {
      console.error("Error al inyectar datos de prueba:", error);
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