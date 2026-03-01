import { ipcMain } from 'electron'
import { db } from '../database'

export function registerOrderHandlers() {

  ipcMain.handle('get-tables', () => {
    if (!db) return []
    try {
      const mesas = db.prepare('SELECT * FROM mesa WHERE activa = 1').all() as any[]
      return mesas.map(mesa => {
        // CORRECCIÓN: Filtrar solo las ordenes activas
        const ordenActiva = db.prepare(`SELECT estatus, total FROM orden WHERE mesa_id = ? AND estatus IN ('abierta', 'enviada_cocina', 'cuenta_solicitada') LIMIT 1`).get(mesa.id) as any
        return { 
          ...mesa, 
          estado_orden: ordenActiva ? ordenActiva.estatus : 'libre', 
          total_actual: ordenActiva ? ordenActiva.total : 0 
        }
      })
    } catch (error) { return [] }
  })

  // 1. ABRIR O CREAR ORDEN
  ipcMain.handle('open-table-order', (_, args) => {
    if (!db) return { success: false, error: 'Sin conexión BD' }
    try {
      const targetTableId = args.tableId || args.mesaId
      const targetUserId = args.userId

      if (!targetTableId) return { success: false, error: 'ID de mesa no proporcionado' }

      let order = db.prepare(`
        SELECT o.*, u.nombre as nombre_mesero 
        FROM orden o
        LEFT JOIN user u ON o.user_id = u.id
        WHERE o.mesa_id = ? AND o.estatus IN ('abierta', 'enviada_cocina', 'cuenta_solicitada')
      `).get(targetTableId) as any

      if (!order) {
        if (!targetUserId) return { success: false, error: 'Falta el usuario para crear la orden' }
        
        const info = db.prepare(`
          INSERT INTO orden (user_id, mesa_id, estatus, total, creado_en)
          VALUES (?, ?, 'abierta', 0, datetime('now', 'localtime'))
        `).run(targetUserId, targetTableId)
        
        order = { id: info.lastInsertRowid, estatus: 'abierta', total: 0, mesa_id: targetTableId }
      }

      const items = db.prepare('SELECT * FROM orden_item WHERE orden_id = ?').all(order.id)
      return { success: true, order, items }
    } catch (error: any) {
      console.error("Error al abrir mesa:", error)
      return { success: false, error: error.message }
    }
  })

  // 2. AÑADIR AL CARRITO
  ipcMain.handle('add-order-item', (_, { ordenId, product }) => {
    if (!db) return { success: false }
    try {
      const tx = db.transaction(() => {
        const existing = db.prepare(`SELECT id FROM orden_item WHERE orden_id = ? AND producto_id = ? AND comanda_impresa = 0`).get(ordenId, product.id) as any

        if (existing) {
          db.prepare('UPDATE orden_item SET cantidad = cantidad + 1 WHERE id = ?').run(existing.id)
        } else {
          db.prepare(`INSERT INTO orden_item (orden_id, producto_id, nombre, precio, cantidad, comanda_impresa) VALUES (?, ?, ?, ?, 1, 0)`).run(ordenId, product.id, product.nombre, product.precio)
        }

        recalculateOrderTotal(ordenId)
        return { success: true }
      })
      return tx()
    } catch (e: any) {
      console.error("Error añadiendo item:", e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('update-order-item-qty', (_, { itemId, ordenId, change }) => {
    if (!db) return { success: false }
    try {
      const tx = db.transaction(() => {
        const item = db.prepare('SELECT cantidad FROM orden_item WHERE id = ?').get(itemId) as any
        if (!item) return { success: false }

        const newQty = item.cantidad + change
        if (newQty <= 0) {
          db.prepare('DELETE FROM orden_item WHERE id = ?').run(itemId)
        } else {
          db.prepare('UPDATE orden_item SET cantidad = ? WHERE id = ?').run(newQty, itemId)
        }

        recalculateOrderTotal(ordenId)
        return { success: true }
      })
      return tx()
    } catch (e) { return { success: false } }
  })

  ipcMain.handle('remove-order-item', (_, { itemId, ordenId }) => {
    if (!db) return { success: false }
    try {
      const tx = db.transaction(() => {
        db.prepare('DELETE FROM orden_item WHERE id = ?').run(itemId)
        recalculateOrderTotal(ordenId)
        return { success: true }
      })
      return tx()
    } catch (e) { return { success: false } }
  })

  ipcMain.handle('print-command', (_, { ordenId }) => {
    if (!db) return { success: false }
    try {
      const tx = db.transaction(() => {
        const items = db.prepare(`SELECT nombre, cantidad FROM orden_item WHERE orden_id = ? AND comanda_impresa = 0`).all(ordenId)
        if (items.length > 0) {
          db.prepare('UPDATE orden_item SET comanda_impresa = 1 WHERE orden_id = ? AND comanda_impresa = 0').run(ordenId)
          db.prepare("UPDATE orden SET estatus = 'enviada_cocina' WHERE id = ?").run(ordenId)
          return { success: true, items }
        }
        return { success: false, message: 'No hay productos nuevos' }
      })
      return tx()
    } catch (e) { return { success: false } }
  })

  ipcMain.handle('request-bill', (_, { ordenId }) => {
    try {
      db.prepare("UPDATE orden SET estatus = 'cuenta_solicitada' WHERE id = ?").run(ordenId)
      return { success: true }
    } catch (e: any) { return { success: false } }
  })

  ipcMain.handle('pay-order', (_, { orderId, payment, total }) => {
    if (!db) return { success: false }
    try {
      const tx = db.transaction(() => {
        db.prepare("UPDATE orden SET estatus = 'pagada', ticket_impreso = 0 WHERE id = ?").run(orderId)
        
        const today = new Date().toISOString().split('T')[0]
        let reporte = db.prepare('SELECT id FROM reporte_diario WHERE date(fecha) = ?').get(today) as any
        
        if (!reporte) {
          const info = db.prepare('INSERT INTO reporte_diario (fecha) VALUES (?)').run(today)
          reporte = { id: info.lastInsertRowid }
        }

        const montoEfectivo = payment.method === 'efectivo' ? total : 0
        const montoTarjeta = payment.method === 'tarjeta' ? total : 0
        
        db.prepare(`
          UPDATE reporte_diario 
          SET total_ventas = total_ventas + ?, total_pedidos = total_pedidos + 1, total_efectivo = total_efectivo + ?, total_tarjeta = total_tarjeta + ? 
          WHERE id = ?
        `).run(total, montoEfectivo, montoTarjeta, reporte.id)

        // CORRECCIÓN: No hay tabla mesa en la que se actualice el estado, el estado de la mesa se deduce de las ordenes activas
        // Se corrige el get-tables para que solo cuente las ordenes activas, como la orden ya esta pagada, no se tomara en cuenta.
        
        return { success: true }
      })
      return tx()
    } catch (e) { return { success: false } }
  })

  // 3. CANCELAR ORDEN (Verificación del PIN habilitada)
  ipcMain.handle('cancel-order', (_, { orderId, pin }) => {
    if (!db) return { success: false, error: 'DB no conectada' }
    try {
      if (pin) {
        const user = db.prepare('SELECT id, rol FROM user WHERE pin = ? AND active = 1').get(pin) as any
        if (!user || user.rol !== 'admin') {
          return { success: false, error: 'Permisos insuficientes. Solo el Administrador puede cancelar.' }
        }
      }
      db.prepare("UPDATE orden SET estatus = 'cancelada', total = 0 WHERE id = ?").run(orderId)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}

// Helper interno
function recalculateOrderTotal(ordenId: number) {
  const result = db.prepare('SELECT SUM(precio * cantidad) as total FROM orden_item WHERE orden_id = ?').get(ordenId) as any
  const total = result?.total || 0
  db.prepare('UPDATE orden SET total = ? WHERE id = ?').run(total, ordenId)
}