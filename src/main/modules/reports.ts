import { ipcMain } from 'electron'
import { db, getOrderItems } from '../database'

export function registerReportHandlers() {
  
  ipcMain.handle('get-daily-report', (_, { date }) => {
    try {
      // TRUCO DE MIGRACIÓN SILENCIOSA
      try {
        db.prepare('ALTER TABLE reporte_diario ADD COLUMN dinero_real FLOAT DEFAULT NULL').run()
        db.prepare('ALTER TABLE reporte_diario ADD COLUMN diferencia FLOAT DEFAULT NULL').run()
      } catch (e) { /* Ignoramos si ya existen */ }

      const report = db.prepare('SELECT * FROM reporte_diario WHERE fecha = ?').get(date)
      
      // 🐛 CORRECCIÓN AL BUG DE LAS FECHAS: 
      // Quitamos la función date() y usamos o.creado_en directamente para que SQLite
      // no falle al leer fechas con formato ISO de JavaScript (con la T en medio).
      const orders = db.prepare(`
        SELECT o.id, o.total, o.creado_en, p.metodo, m.numero as mesa 
        FROM orden o 
        LEFT JOIN pago p ON p.orden_id = o.id 
        LEFT JOIN mesa m ON o.mesa_id = m.id 
        WHERE o.creado_en LIKE ? AND o.estatus = 'pagada' 
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

  // NUEVO: Guardado Inteligente del corte de caja
  ipcMain.handle('save-daily-cut', (_, { date, realCash, difference }) => {
    try {
      // 1. Obtener todas las órdenes estrictamente del día local (la verdadera fuente de la verdad)
      const orders = db.prepare(`
        SELECT o.total, p.metodo 
        FROM orden o 
        LEFT JOIN pago p ON p.orden_id = o.id 
        WHERE o.creado_en LIKE ? AND o.estatus = 'pagada'
      `).all(`${date}%`) as any[];

      if (orders.length === 0) {
        return { success: false, error: 'No hay ventas registradas en esta fecha para hacer un corte.' }
      }

      // 2. Calcular los totales de forma absoluta desde las órdenes para evitar desajustes de horario
      let totalVentas = 0;
      let totalEfectivo = 0;
      let totalTarjeta = 0;
      const totalPedidos = orders.length;

      orders.forEach(o => {
        totalVentas += o.total;
        if(o.metodo === 'efectivo') totalEfectivo += o.total;
        if(o.metodo === 'tarjeta') totalTarjeta += o.total;
      });

      // 3. Buscar si existe un reporte, si la zona horaria falló, lo creamos para el día correcto
      let report = db.prepare('SELECT id FROM reporte_diario WHERE fecha = ?').get(date) as any
      
      if (report) {
        db.prepare(`
          UPDATE reporte_diario 
          SET total_ventas = ?, total_pedidos = ?, total_efectivo = ?, total_tarjeta = ?, dinero_real = ?, diferencia = ? 
          WHERE id = ?
        `).run(totalVentas, totalPedidos, totalEfectivo, totalTarjeta, realCash, difference, report.id)
      } else {
        const info = db.prepare(`
          INSERT INTO reporte_diario (fecha, total_ventas, total_pedidos, total_efectivo, total_tarjeta, dinero_real, diferencia)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(date, totalVentas, totalPedidos, totalEfectivo, totalTarjeta, realCash, difference)
        report = { id: info.lastInsertRowid }
      }

      // 4. Asegurar que las órdenes queden correctamente vinculadas al reporte final
      db.prepare(`
        UPDATE orden 
        SET id_reporte_diario = ? 
        WHERE creado_en LIKE ? AND estatus = 'pagada' AND id_reporte_diario IS NULL
      `).run(report.id, `${date}%`)

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}