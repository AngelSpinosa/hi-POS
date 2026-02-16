import { ipcMain } from 'electron'
import { db, getOrderItems, getDailyReportId, recalculateOrderTotal } from '../database'

export function registerOrderHandlers() {

  ipcMain.handle('get-tables', () => {
    if (!db) return []
    try {
      const mesas = db.prepare('SELECT * FROM mesa WHERE activa = 1').all() as any[]
      const mesasConEstado = mesas.map(mesa => {
        const ordenActiva = db.prepare(`SELECT estatus, total FROM orden WHERE mesa_id = ? AND estatus IN ('abierta', 'enviada_cocina', 'cuenta_solicitada') LIMIT 1`).get(mesa.id) as any
        return { ...mesa, estado_orden: ordenActiva ? ordenActiva.estatus : 'libre', total_actual: ordenActiva ? ordenActiva.total : 0 }
      })
      return mesasConEstado
    } catch (error) { return [] }
  })

  ipcMain.handle('open-table-order', (_, { tableId, userId }) => {
    if (!db) return { success: false, error: 'Sin conexión BD' }
    try {
      let order = db.prepare(`
        SELECT o.*, u.nombre as nombre_mesero 
        FROM orden o
        JOIN user u ON o.user_id = u.id
        WHERE o.mesa_id = ? AND o.estatus IN ('abierta', 'enviada_cocina', 'cuenta_solicitada')
        LIMIT 1
      `).get(tableId) as any

      if (order) {
        if (order.user_id !== userId) {
          return { success: false, error: `Mesa ocupada por ${order.nombre_mesero}. Acceso denegado.` }
        }
      } else {
        const reportId = getDailyReportId()
        const fechaActual = new Date().toISOString()
        const stmtInsert = db.prepare(`INSERT INTO orden (user_id, id_reporte_diario, mesa_id, estatus, total, ticket_impreso, creado_en) VALUES (?, ?, ?, 'abierta', 0, 0, ?)`)
        const info = stmtInsert.run(userId, reportId, tableId, fechaActual)
        order = { id: info.lastInsertRowid, mesa_id: tableId, estatus: 'abierta', total: 0 }
      }
      const items = getOrderItems(order.id)
      return { success: true, order, items }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  ipcMain.handle('update-order-status', (_, { orderId, status }) => {
    try {
      db.prepare('UPDATE orden SET estatus = ? WHERE id = ?').run(status, orderId)
      return { success: true }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  ipcMain.handle('generate-command', (_, { orderId }) => {
    try {
      db.prepare(`UPDATE orden_item SET comanda_impresa = 1 WHERE orden_id = ? AND comanda_impresa = 0`).run(orderId)
      db.prepare(`UPDATE orden SET estatus = 'enviada_cocina' WHERE id = ? AND estatus = 'abierta'`).run(orderId)
      const items = getOrderItems(orderId)
      return { success: true, items }
    } catch (error: any) { return { success: false, error: error.message } }
  })
  
  ipcMain.handle('add-to-cart', (_, { orderId, product }) => {
    try {
      const existing = db.prepare('SELECT id FROM orden_item WHERE orden_id = ? AND producto_id = ? AND comanda_impresa = 0').get(orderId, product.id) as any
      if (existing) { db.prepare('UPDATE orden_item SET cantidad = cantidad + 1 WHERE id = ?').run(existing.id) } 
      else { db.prepare('INSERT INTO orden_item (orden_id, producto_id, nombre, precio, cantidad) VALUES (?, ?, ?, ?, 1)').run(orderId, product.id, product.nombre, product.precio) }
      const newTotal = recalculateOrderTotal(orderId)
      const items = getOrderItems(orderId)
      return { success: true, newTotal, items }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  ipcMain.handle('remove-from-cart', (_, { orderId, productId }) => {
    try {
      db.prepare('DELETE FROM orden_item WHERE orden_id = ? AND producto_id = ? AND comanda_impresa = 0').run(orderId, productId)
      const newTotal = recalculateOrderTotal(orderId)
      const items = getOrderItems(orderId)
      return { success: true, newTotal, items }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  ipcMain.handle('update-quantity', (_, { orderId, productId, quantity }) => {
    try {
      if (quantity < 1) return { success: false, error: 'Cantidad inválida' }
      db.prepare('UPDATE orden_item SET cantidad = ? WHERE orden_id = ? AND producto_id = ? AND comanda_impresa = 0').run(quantity, orderId, productId)
      const newTotal = recalculateOrderTotal(orderId)
      const items = getOrderItems(orderId)
      return { success: true, newTotal, items }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  ipcMain.handle('pay-order', (_, { orderId, payment, total }) => {
    try {
      const orderCheck = db.prepare('SELECT total, id_reporte_diario FROM orden WHERE id = ?').get(orderId) as any
      if (!orderCheck || orderCheck.total <= 0) return { success: false, error: 'Orden vacía' }
      const payTransaction = db.transaction(() => {
        const fechaActual = new Date().toISOString()
        const cambio = payment.received - total
        db.prepare('INSERT INTO pago (orden_id, metodo, monto_recibido, cambio, creado_en) VALUES (?, ?, ?, ?, ?)').run(orderId, payment.method, payment.received, cambio, fechaActual)
        db.prepare("UPDATE orden SET estatus = 'pagada', ticket_impreso = 0 WHERE id = ?").run(orderId)
        const montoEfectivo = payment.method === 'efectivo' ? total : 0
        const montoTarjeta = payment.method === 'tarjeta' ? total : 0
        db.prepare(`UPDATE reporte_diario SET total_ventas = total_ventas + ?, total_pedidos = total_pedidos + 1, total_efectivo = total_efectivo + ?, total_tarjeta = total_tarjeta + ? WHERE id = ?`).run(total, montoEfectivo, montoTarjeta, orderCheck.id_reporte_diario)
      })
      payTransaction()
      return { success: true }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  ipcMain.handle('cancel-order', (_, { orderId, pin }) => {
    try {
      const user = db.prepare('SELECT id, rol FROM user WHERE pin = ? AND active = 1').get(pin) as any
      if (!user) return { success: false, error: 'PIN incorrecto' }
      const order = db.prepare('SELECT user_id FROM orden WHERE id = ?').get(orderId) as any
      if (!order) return { success: false, error: 'Orden no encontrada' }
      if (user.rol !== 'admin' && user.id !== order.user_id) {
        return { success: false, error: 'Permisos insuficientes. Solo el Admin o el mesero que abrió la mesa pueden cancelarla.' }
      }
      db.prepare("UPDATE orden SET estatus = 'cancelada' WHERE id = ?").run(orderId)
      return { success: true }
    } catch (error: any) { return { success: false, error: error.message } }
  })
}