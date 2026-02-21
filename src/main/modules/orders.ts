import { ipcMain } from 'electron'
import { db } from '../database'

export function registerOrderHandlers() {

  // 1. Obtener Mesas (Dashboard) - Mantenido de tu versión
  ipcMain.handle('get-tables', () => {
    if (!db) return []
    try {
      const mesas = db.prepare('SELECT * FROM mesa WHERE activa = 1').all() as any[]
      const mesasConEstado = mesas.map(mesa => {
        const ordenActiva = db.prepare(`SELECT estatus, total FROM orden WHERE mesa_id = ? AND estatus IN ('abierta', 'enviada_cocina', 'cuenta_solicitada') LIMIT 1`).get(mesa.id) as any
        return { 
          ...mesa, 
          estado_orden: ordenActiva ? ordenActiva.estatus : 'libre', 
          total_actual: ordenActiva ? ordenActiva.total : 0 
        }
      })
      return mesasConEstado
    } catch (error) { return [] }
  })

  // 2. Abrir/Recuperar Orden (Al entrar a la mesa) - Mantenido y reforzado
  ipcMain.handle('open-table-order', (_, { mesaId, userId }) => {
    if (!db) return { success: false, error: 'Sin conexión BD' }
    try {
      // Buscar orden activa
      let orden = db.prepare(`
        SELECT * FROM orden 
        WHERE mesa_id = ? AND estatus IN ('abierta', 'enviada_cocina', 'cuenta_solicitada')
      `).get(mesaId) as any

      // Si no existe, crearla (Solo si se pasa userId, lo cual indica intención de crear)
      if (!orden && userId) {
        const info = db.prepare(`
          INSERT INTO orden (user_id, mesa_id, estatus, total, creado_en)
          VALUES (?, ?, 'abierta', 0, datetime('now', 'localtime'))
        `).run(userId, mesaId)
        orden = { id: info.lastInsertRowid, estatus: 'abierta', total: 0, mesa_id: mesaId }
      } else if (!orden) {
        return { success: false, error: 'No hay orden activa' }
      }

      // Obtener items
      const items = db.prepare(`SELECT * FROM orden_item WHERE orden_id = ?`).all(orden.id)
      
      return { success: true, order: orden, items }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 3. Agregar Producto (NUEVO - Requerido por POSView)
  ipcMain.handle('add-order-item', (_, { ordenId, product }) => {
    if (!db) return { success: false }
    const tx = db.transaction(() => {
      // Verificar si ya existe para agrupar (si no se ha impreso comanda)
      const existing = db.prepare(`
        SELECT id FROM orden_item 
        WHERE orden_id = ? AND producto_id = ? AND comanda_impresa = 0
      `).get(ordenId, product.id) as any

      if (existing) {
        db.prepare('UPDATE orden_item SET cantidad = cantidad + 1 WHERE id = ?').run(existing.id)
      } else {
        db.prepare(`
          INSERT INTO orden_item (orden_id, producto_id, nombre, precio, cantidad, comanda_impresa)
          VALUES (?, ?, ?, ?, 1, 0)
        `).run(ordenId, product.id, product.nombre, product.precio)
      }

      // Recalcular total
      recalculateOrderTotal(ordenId)
      return { success: true }
    })
    return tx()
  })

  // 4. Modificar Cantidad (NUEVO - Requerido por POSView)
  ipcMain.handle('update-order-item-qty', (_, { itemId, ordenId, change }) => {
    if (!db) return { success: false }
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
  })

  // 5. Eliminar Item (NUEVO - Requerido por POSView)
  ipcMain.handle('remove-order-item', (_, { itemId, ordenId }) => {
    if (!db) return { success: false }
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM orden_item WHERE id = ?').run(itemId)
      recalculateOrderTotal(ordenId)
      return { success: true }
    })
    return tx()
  })

  // 6. Generar Comanda (NUEVO - Requerido por POSView)
  ipcMain.handle('print-command', (_, { ordenId }) => {
    if (!db) return { success: false }
    const tx = db.transaction(() => {
      const items = db.prepare(`SELECT nombre, cantidad FROM orden_item WHERE orden_id = ? AND comanda_impresa = 0`).all(ordenId)
      
      if (items.length > 0) {
        db.prepare('UPDATE orden_item SET comanda_impresa = 1 WHERE orden_id = ? AND comanda_impresa = 0').run(ordenId)
        db.prepare("UPDATE orden SET estatus = 'enviada_cocina' WHERE id = ?").run(ordenId)
        return { success: true, items }
      }
      return { success: false, message: 'Nada nuevo para imprimir' }
    })
    return tx()
  })

  // 7. Solicitar Cuenta (NUEVO - Requerido por POSView)
  ipcMain.handle('request-bill', (_, { ordenId }) => {
    try {
      db.prepare("UPDATE orden SET estatus = 'cuenta_solicitada' WHERE id = ?").run(ordenId)
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message } }
  })

  // 8. Pagar Orden (Mantenido de tu versión y ajustado)
  ipcMain.handle('pay-order', (_, { orderId, payment, total }) => {
    if (!db) return { success: false }
    const tx = db.transaction(() => {
      // 1. Cerrar orden
      db.prepare("UPDATE orden SET estatus = 'pagada', ticket_impreso = 0 WHERE id = ?").run(orderId)
      
      // 2. Actualizar reporte diario (Lógica simple para MVP)
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
        SET total_ventas = total_ventas + ?, 
            total_pedidos = total_pedidos + 1, 
            total_efectivo = total_efectivo + ?, 
            total_tarjeta = total_tarjeta + ? 
        WHERE id = ?
      `).run(total, montoEfectivo, montoTarjeta, reporte.id)

      return { success: true }
    })
    return tx()
  })

  // 9. Cancelar Orden (Mantenido)
  ipcMain.handle('cancel-order', (_, { orderId, pin }) => {
    try {
      // Verificar PIN Admin
      const user = db.prepare('SELECT id, rol FROM user WHERE pin = ? AND active = 1').get(pin) as any
      if (!user) return { success: false, error: 'PIN incorrecto' }
      
      // Solo admin o el dueño de la orden (aquí simplificado a admin)
      if (user.rol !== 'admin') {
         // Opcional: permitir al dueño cancelar si es su orden, pero tu regla dice que Admin cancela
         return { success: false, error: 'Solo administradores pueden cancelar' }
      }

      db.prepare("UPDATE orden SET estatus = 'cancelada', total = 0 WHERE id = ?").run(orderId)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}

// Helper para recalcular total
function recalculateOrderTotal(ordenId: number) {
  const result = db.prepare('SELECT SUM(precio * cantidad) as total FROM orden_item WHERE orden_id = ?').get(ordenId) as any
  const total = result.total || 0
  db.prepare('UPDATE orden SET total = ? WHERE id = ?').run(total, ordenId)
}