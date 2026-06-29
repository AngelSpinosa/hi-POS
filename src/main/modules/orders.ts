import { ipcMain, app, BrowserWindow, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { db } from '../database'
import { descontarInventarioPorVenta } from './inventory'

export function registerOrderHandlers() {

  ipcMain.handle('get-productos-pos', () => {
    if (!db) return []
    try {
      const stmt = db.prepare(`
        SELECT p.*,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM receta_producto rp
              JOIN insumo i ON rp.insumo_id = i.id
              WHERE rp.producto_id = p.id AND i.stock_actual < rp.cantidad_requerida
            ) THEN 0
            ELSE 1
          END as disponible
        FROM producto p
      `)
      const productos = stmt.all() as any[]
      return productos.map(p => ({ ...p, disponible: p.disponible === 1 }))
    } catch (error) { 
      console.error("❌ Error en get-productos-pos:", error);
      return [] 
    }
  })

  ipcMain.handle('get-tables', () => {
    if (!db) return []
    try {
      const mesas = db.prepare('SELECT * FROM mesa WHERE activa = 1').all() as any[]
      return mesas.map(mesa => {
        const ordenActiva = db.prepare(`
          SELECT estatus, total FROM orden 
          WHERE mesa_id = ? AND estatus IN ('abierta', 'enviada_cocina', 'cuenta_solicitada') 
          ORDER BY id DESC LIMIT 1
        `).get(mesa.id) as any
        
        return { 
          ...mesa, 
          estado_orden: ordenActiva ? ordenActiva.estatus : 'libre', 
          total_actual: ordenActiva ? ordenActiva.total : 0 
        }
      })
    } catch (error) { return [] }
  })

  ipcMain.handle('open-table-order', (_, args) => {
    if (!db) return { success: false, error: 'Sin conexión BD' }
    try {
      const targetTableId = args.tableId || args.mesaId
      const targetUserId = args.userId

      if (!targetTableId) return { success: false, error: 'ID de mesa no proporcionado' }

      let order = db.prepare(`
        SELECT o.*, u.nombre as nombre_mesero FROM orden o
        LEFT JOIN user u ON o.user_id = u.id
        WHERE o.mesa_id = ? AND o.estatus IN ('abierta', 'enviada_cocina', 'cuenta_solicitada')
        ORDER BY o.id DESC LIMIT 1
      `).get(targetTableId) as any

      if (!order) {
        if (!targetUserId) return { success: false, error: 'Falta el usuario' }
        const info = db.prepare(`INSERT INTO orden (user_id, mesa_id, estatus, total, creado_en) VALUES (?, ?, 'abierta', 0, datetime('now', 'localtime'))`).run(targetUserId, targetTableId)
        order = { id: info.lastInsertRowid, estatus: 'abierta', total: 0, mesa_id: targetTableId }
      }

      const items = db.prepare('SELECT * FROM orden_item WHERE orden_id = ?').all(order.id)
      
      const pagosStmt = db.prepare('SELECT SUM(monto_recibido - cambio) as pagado FROM pago WHERE orden_id = ?').get(order.id) as any
      order.totalPagado = pagosStmt?.pagado || 0

      return { success: true, order, items }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  ipcMain.handle('add-order-item', (_, { ordenId, product }) => {
    if (!db) return { success: false }
    try {
      const tx = db.transaction(() => {
        const existing = db.prepare(`SELECT id FROM orden_item WHERE orden_id = ? AND producto_id = ? AND comanda_impresa = 0`).get(ordenId, product.id) as any
        if (existing) db.prepare('UPDATE orden_item SET cantidad = cantidad + 1 WHERE id = ?').run(existing.id)
        else db.prepare(`INSERT INTO orden_item (orden_id, producto_id, nombre, precio, cantidad, comanda_impresa) VALUES (?, ?, ?, ?, 1, 0)`).run(ordenId, product.id, product.nombre, product.precio)
        recalculateOrderTotal(ordenId)
        return { success: true }
      })
      return tx()
    } catch (e: any) { return { success: false, error: e.message } }
  })

  ipcMain.handle('update-order-item-qty', (_, { itemId, ordenId, change }) => {
    if (!db) return { success: false }
    try {
      const tx = db.transaction(() => {
        const item = db.prepare('SELECT cantidad FROM orden_item WHERE id = ?').get(itemId) as any
        if (!item) return { success: false }
        const newQty = item.cantidad + change
        if (newQty <= 0) db.prepare('DELETE FROM orden_item WHERE id = ?').run(itemId)
        else db.prepare('UPDATE orden_item SET cantidad = ? WHERE id = ?').run(newQty, itemId)
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
        return { success: false, message: 'No hay nuevos' }
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

  ipcMain.handle('pay-order', (_, { orderId, payment }) => {
    if (!db) return { success: false }
    try {
      const tx = db.transaction(() => {
        const order = db.prepare('SELECT total FROM orden WHERE id = ?').get(orderId) as any;
        if (!order) throw new Error('Orden no encontrada');

        const pagosStmt = db.prepare('SELECT SUM(monto_recibido - cambio) as pagado FROM pago WHERE orden_id = ?').get(orderId) as any;
        const totalPagadoPreviamente = pagosStmt?.pagado || 0;
        
        let cambio = 0;
        let appliedAmount = payment.amountToPay;

        if (payment.method === 'efectivo') {
          cambio = Math.max(0, payment.received - payment.amountToPay);
          appliedAmount = payment.received - cambio; 
        }

        db.prepare(`INSERT INTO pago (orden_id, metodo, monto_recibido, cambio) VALUES (?, ?, ?, ?)`).run(orderId, payment.method, payment.received, cambio);

        const tzOffset = new Date().getTimezoneOffset() * 60000;
        const today = new Date(Date.now() - tzOffset).toISOString().split('T')[0];
        let reporte = db.prepare('SELECT id FROM reporte_diario WHERE date(fecha) = ?').get(today) as any;
        if (!reporte) {
          const info = db.prepare('INSERT INTO reporte_diario (fecha) VALUES (?)').run(today);
          reporte = { id: info.lastInsertRowid };
        }

        const montoEfectivo = payment.method === 'efectivo' ? appliedAmount : 0;
        const montoTarjeta = payment.method === 'tarjeta' ? appliedAmount : 0;
        db.prepare(`UPDATE reporte_diario SET total_ventas = total_ventas + ?, total_efectivo = total_efectivo + ?, total_tarjeta = total_tarjeta + ? WHERE id = ?`).run(appliedAmount, montoEfectivo, montoTarjeta, reporte.id);

        const newTotalPagado = totalPagadoPreviamente + appliedAmount;
        const isFullyPaid = newTotalPagado >= (order.total - 0.01);
        let cajeroName = null;

        if (isFullyPaid) {
          db.prepare("UPDATE orden SET estatus = 'pagada', ticket_impreso = 0, id_reporte_diario = ? WHERE id = ?").run(reporte.id, orderId);
          db.prepare("UPDATE reporte_diario SET total_pedidos = total_pedidos + 1 WHERE id = ?").run(reporte.id);
          const items = db.prepare('SELECT producto_id, cantidad FROM orden_item WHERE orden_id = ?').all(orderId) as any[];
          descontarInventarioPorVenta(items);
          const userRow = db.prepare('SELECT u.nombre FROM orden o JOIN user u ON o.user_id = u.id WHERE o.id = ?').get(orderId) as any;
          cajeroName = userRow?.nombre;
        }

        return { success: true, isFullyPaid, remaining: Math.max(0, order.total - newTotalPagado), cajero: cajeroName }
      })
      return tx()
    } catch (e: any) { return { success: false, error: e.message } }
  })

  // ==========================================
  // REPORTES Y DETALLES (¡CORREGIDOS!)
  // ==========================================

  ipcMain.handle('get-tickets-path', () => { return path.join(app.getPath('documents'), 'hi-POS_Tickets'); });
}

function recalculateOrderTotal(ordenId: number) {
  const result = db.prepare('SELECT SUM(precio * cantidad) as total FROM orden_item WHERE orden_id = ?').get(ordenId) as any
  const total = result?.total || 0
  db.prepare('UPDATE orden SET total = ? WHERE id = ?').run(total, ordenId)
}