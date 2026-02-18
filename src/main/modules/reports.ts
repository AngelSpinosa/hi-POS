import { ipcMain } from 'electron'
import { db, getOrderItems } from '../database'

export function registerReportHandlers() {
  
  ipcMain.handle('get-daily-report', (_, { date }) => {
    try {
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
}