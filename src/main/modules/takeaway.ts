import { ipcMain } from 'electron'
import { db } from '../database'

// ==========================================
// Handlers de "Para llevar"
// ==========================================
// A diferencia de domicilio, este flujo NO necesita tabla propia: la orden ya
// soporta tipo_orden = 'llevar' con mesa_id = NULL, y orden_item nunca
// referencia mesa ni cliente. Por eso casi todo se reutiliza tal cual de
// orders.ts: 'get-productos-pos', 'add-order-item', 'update-order-item-qty',
// 'remove-order-item', 'print-command', 'request-bill', 'pay-order' y
// 'cancel-order' funcionan sin cambios porque trabajan por ordenId, sin
// importar el tipo_orden. Aquí solo se agrega lo mínimo específico: abrir la
// orden base y releer su estado.

export function registerTakeawayHandlers() {

  // 1. Abrir una orden "para llevar" nueva (equivalente a open-table-order/open-delivery-order, sin mesa ni datos de cliente)
  ipcMain.handle('open-carryout-order', (_, { userId }) => {
    if (!db) return { success: false, error: 'Sin conexión BD' }
    try {
      if (!userId) return { success: false, error: 'Falta el usuario' }

      const info = db.prepare(`
        INSERT INTO orden (user_id, mesa_id, tipo_orden, estatus, total, creado_en) 
        VALUES (?, NULL, 'llevar', 'abierta', 0, datetime('now', 'localtime'))
      `).run(userId)

      const order = { id: info.lastInsertRowid, estatus: 'abierta', total: 0, mesa_id: null, tipo_orden: 'llevar', totalPagado: 0 }
      return { success: true, order, items: [] }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 2. Releer el estado de una orden "para llevar" (carrito + total) por ordenId.
  // Misma forma que get-delivery-order-state en delivery.ts, duplicada aquí a
  // propósito para mantener cada módulo independiente.
  ipcMain.handle('get-carryout-order-state', (_, { ordenId }) => {
    if (!db) return { success: false, error: 'Sin conexión BD' }
    try {
      const order = db.prepare('SELECT * FROM orden WHERE id = ?').get(ordenId) as any
      if (!order) return { success: false, error: 'La orden no existe' }

      const items = db.prepare(`
        SELECT oi.*, p.categoria_id, pr.nombre AS promocion_nombre
        FROM orden_item oi
        LEFT JOIN producto p ON oi.producto_id = p.id
        LEFT JOIN promocion pr ON oi.promocion_id = pr.id
        WHERE oi.orden_id = ?
      `).all(ordenId)

      const pagosStmt = db.prepare('SELECT SUM(monto_recibido - cambio) as pagado FROM pago WHERE orden_id = ?').get(ordenId) as any
      order.totalPagado = pagosStmt?.pagado || 0

      return { success: true, order, items }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}