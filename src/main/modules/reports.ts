import { ipcMain } from 'electron'
import { db, getOrderItems } from '../database'

export function registerReportHandlers() {
  
  ipcMain.handle('get-daily-report', (_, { date }) => {
    try {
      // TRUCO DE MIGRACIÓN SILENCIOSA: Añadimos las columnas si no existen
      try {
        db.prepare('ALTER TABLE reporte_diario ADD COLUMN dinero_real FLOAT DEFAULT NULL').run()
        db.prepare('ALTER TABLE reporte_diario ADD COLUMN diferencia FLOAT DEFAULT NULL').run()
      } catch (e) { /* Ignoramos el error si las columnas ya existen */ }

      const report = db.prepare('SELECT * FROM reporte_diario WHERE fecha = ?').get(date)
      const orders = db.prepare(`
        SELECT o.id, o.total, o.creado_en, p.metodo, m.numero as mesa 
        FROM orden o 
        LEFT JOIN pago p ON p.orden_id = o.id 
        LEFT JOIN mesa m ON o.mesa_id = m.id 
        WHERE date(o.creado_en) LIKE ? AND o.estatus = 'pagada' 
        ORDER BY o.creado_en DESC
      `).all(`${date}%`)
      return { success: true, report, orders }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  ipcMain.handle('get-order-details', (_, { orderId }) => {
    try {
      const items = getOrderItems(orderId)
      return { success: true, items }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  // NUEVO: Guardar el corte de caja con el dinero físico
  ipcMain.handle('save-daily-cut', (_, { date, realCash, difference }) => {
    try {
      const report = db.prepare('SELECT id FROM reporte_diario WHERE fecha = ?').get(date) as any
      
      if (report) {
        // Guardamos el dinero real y la diferencia en el reporte
        db.prepare('UPDATE reporte_diario SET dinero_real = ?, diferencia = ? WHERE id = ?').run(realCash, difference, report.id)
        
        // Vinculamos formalmente las órdenes pagadas de ese día a este reporte
        db.prepare(`UPDATE orden SET id_reporte_diario = ? WHERE date(creado_en) LIKE ? AND estatus = 'pagada' AND id_reporte_diario IS NULL`).run(report.id, `${date}%`)
        
        return { success: true }
      } else {
        return { success: false, error: 'No hay ventas registradas en esta fecha para hacer un corte.' }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}