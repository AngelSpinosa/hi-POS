import { ipcMain } from 'electron'
import { db } from '../database'

export function registerSetupHandlers() {

  // CU-52, 53 y 54: Guardar toda la configuración inicial de golpe
  ipcMain.handle('setup-initial-data', (_, payload) => {
    const { config, numMesas, platillos, adminPin } = payload;
    
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

        // 2. Crear Mesas (Solución: INSERT OR IGNORE previene el crash de restricción única)
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
          // Buscamos si ya existe un admin para no duplicar en caso de reprocesamiento
          const adminExists = db.prepare("SELECT id FROM user WHERE rol = 'admin' AND pin = ?").get(adminPin);
          if (!adminExists) {
            db.prepare('INSERT INTO user (nombre, rol, pin, active) VALUES (?, ?, ?, 1)')
              .run('Admin Principal', 'admin', adminPin);
          }
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
        // Solo marcamos como completado para que no vuelva a salir la pantalla
        db.prepare('UPDATE app_config SET setup_completed = 1 WHERE id = 1').run();
        
        // Verificamos si existe al menos 1 admin. Si no existe (BD vacía), lo creamos por default para no bloquear el sistema.
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

}