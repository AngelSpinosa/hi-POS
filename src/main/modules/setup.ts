import { ipcMain, dialog } from 'electron'
import { db } from '../database'
import fs from 'fs' 

export function registerSetupHandlers() {

  // CU-52, 53 y 54: Guardar toda la configuración inicial de golpe
  ipcMain.handle('setup-initial-data', (_, payload) => {
    // NUEVO: Recibimos el arreglo de empleados
    const { config, numMesas, platillos, adminPin, empleados } = payload;
    
    if (!db) return { success: false, error: 'Sin conexión a BD' };

    try {
      const tx = db.transaction(() => {
        
        // 1. Guardar Identidad Visual y marcar setup como completado
        db.prepare(`
          UPDATE app_config 
          SET business_name = ?, color_primary = ?, color_secondary = ?, logo_path = ?, setup_completed = 1 
          WHERE id = 1
        `).run(
          config.business_name || 'Mi Negocio', 
          config.color_primary || '#f97316', 
          config.color_secondary || '#3b82f6', 
          config.logo_path || null
        );

        // 2. Crear Mesas
        if (numMesas > 0) {
          const insertMesa = db.prepare('INSERT OR IGNORE INTO mesa (numero, activa) VALUES (?, 1)');
          for (let i = 1; i <= numMesas; i++) {
            insertMesa.run(i);
          }
        }

        // 3. Crear Platillos Iniciales
        if (platillos && platillos.length > 0) {
          const insertPlatillo = db.prepare('INSERT INTO producto (nombre, precio, active) VALUES (?, ?, 1)');
          platillos.forEach((p: any) => {
            insertPlatillo.run(p.nombre.toUpperCase(), p.precio);
          });
        }

        // 4. Crear Administrador Principal
        if (adminPin) {
          const adminExists = db.prepare("SELECT id FROM user WHERE rol = 'admin' AND pin = ?").get(adminPin);
          if (!adminExists) {
            db.prepare('INSERT INTO user (nombre, rol, pin, active) VALUES (?, ?, ?, 1)')
              .run('Admin Principal', 'admin', adminPin);
          }
        }

        // 5. NUEVO: Registrar Empleados Adicionales
        if (empleados && empleados.length > 0) {
          const insertUser = db.prepare('INSERT INTO user (nombre, rol, pin, active) VALUES (?, ?, ?, 1)');
          empleados.forEach((emp: any) => {
            // Verificamos que no exista para evitar duplicados si hay un re-proceso de red
            const userExists = db.prepare("SELECT id FROM user WHERE nombre = ? AND pin = ?").get(emp.nombre, emp.pin);
            if (!userExists) {
              insertUser.run(emp.nombre, emp.rol, emp.pin);
            }
          });
        }

      });

      tx();
      return { success: true };
    } catch (e: any) {
      console.error("Error en setup inicial:", e);
      return { success: false, error: e.message };
    }
  });

  // El usuario presionó el botón "Omitir"
  ipcMain.handle('setup-skip', () => {
    if (!db) return { success: false };
    
    try {
      const tx = db.transaction(() => {
        db.prepare('UPDATE app_config SET setup_completed = 1 WHERE id = 1').run();
        
        const adminCount = db.prepare("SELECT count(*) as count FROM user WHERE rol = 'admin'").get() as any;
        if (adminCount.count === 0) {
          db.prepare("INSERT INTO user (nombre, rol, pin, active) VALUES ('Admin Default', 'admin', '1234', 1)").run();
        }
      });
      
      tx();
      return { success: true };
    } catch (e: any) {
      console.error("Error al omitir setup:", e);
      return { success: false, error: e.message };
    }
  });

  // Endpoint para seleccionar y procesar el Logo
  ipcMain.handle('select-logo', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Seleccionar Logo del Negocio',
        properties: ['openFile'],
        filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
      });

      if (canceled || filePaths.length === 0) return { success: false, canceled: true };

      const sourcePath = filePaths[0];
      const imageBuffer = fs.readFileSync(sourcePath);
      
      if (imageBuffer.length > 2 * 1024 * 1024) {
        return { success: false, error: 'La imagen es muy pesada. Por favor elige una menor a 2MB.' };
      }

      const extension = sourcePath.split('.').pop();
      const base64Image = `data:image/${extension};base64,${imageBuffer.toString('base64')}`;

      return { success: true, logoData: base64Image };
    } catch (error: any) {
      console.error('Error procesando logo:', error);
      return { success: false, error: error.message };
    }
  });

}