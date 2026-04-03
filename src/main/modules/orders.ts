import { ipcMain } from 'electron'
import { db } from '../database'

export function registerOrderHandlers() {

  // ==========================================
  // NUEVOS HANDLERS PARA INVENTARIO Y POS
  // ==========================================
  
  ipcMain.handle('get-insumos', () => {
    if (!db) return []
    try {
      return db.prepare('SELECT * FROM Insumo ORDER BY nombre ASC').all()
    } catch (error) { return [] }
  })

  // Esta query verifica el stock cruzando Producto -> Receta -> Insumo
  ipcMain.handle('get-productos-pos', () => {
    if (!db) return []
    try {
      const stmt = db.prepare(`
        SELECT p.*,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM Receta_producto rp
              JOIN Insumo i ON rp.insumo_id = i.id
              WHERE rp.producto_id = p.id AND i.stock_actual < rp.cantidad_requerida
            ) THEN 0
            ELSE 1
          END as disponible
        FROM Producto p
      `)
      const productos = stmt.all() as any[]
      return productos.map(p => ({
        ...p,
        disponible: p.disponible === 1
      }))
    } catch (error) { return [] }
  })

  // ==========================================
  // HANDLERS ORIGINALES DE ÓRDENES
  // ==========================================

  ipcMain.handle('get-tables', () => {
    if (!db) return []
    try {
      const mesas = db.prepare('SELECT * FROM mesa WHERE activa = 1').all() as any[]
      return mesas.map(mesa => {
        const ordenActiva = db.prepare(`
          SELECT estatus, total 
          FROM orden 
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
        SELECT o.*, u.nombre as nombre_mesero 
        FROM orden o
        LEFT JOIN user u ON o.user_id = u.id
        WHERE o.mesa_id = ? AND o.estatus IN ('abierta', 'enviada_cocina', 'cuenta_solicitada')
        ORDER BY o.id DESC LIMIT 1
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
        
        const tzOffset = new Date().getTimezoneOffset() * 60000;
        const today = new Date(Date.now() - tzOffset).toISOString().split('T')[0];

        let reporte = db.prepare('SELECT id FROM reporte_diario WHERE date(fecha) = ?').get(today) as any
        if (!reporte) {
          const info = db.prepare('INSERT INTO reporte_diario (fecha) VALUES (?)').run(today)
          reporte = { id: info.lastInsertRowid }
        }

        const montoEfectivo = payment.method === 'efectivo' ? total : 0
        const montoTarjeta = payment.method === 'tarjeta' ? total : 0
        db.prepare(`UPDATE reporte_diario SET total_ventas = total_ventas + ?, total_pedidos = total_pedidos + 1, total_efectivo = total_efectivo + ?, total_tarjeta = total_tarjeta + ? WHERE id = ?`).run(total, montoEfectivo, montoTarjeta, reporte.id)

        db.prepare(`INSERT INTO pago (orden_id, metodo, monto_recibido) VALUES (?, ?, ?)`).run(orderId, payment.method, payment.received)
        
        // --- NUEVA LÓGICA DE INVENTARIO: DESCONTAR INSUMOS EN CASCADA ---
        const items = db.prepare('SELECT producto_id, cantidad FROM orden_item WHERE orden_id = ?').all(orderId) as any[]
        
        for (const item of items) {
          // Buscamos la receta del producto
          const receta = db.prepare('SELECT insumo_id, cantidad_requerida FROM Receta_producto WHERE producto_id = ?').all(item.producto_id) as any[]
          
          for (const ing of receta) {
            // Multiplicamos la cantidad de la receta por los platillos vendidos
            const qtyToDeduct = ing.cantidad_requerida * item.cantidad
            
            // 1. Descontamos el stock
            db.prepare('UPDATE Insumo SET stock_actual = stock_actual - ? WHERE id = ?').run(qtyToDeduct, ing.insumo_id)
            
            // 2. Registramos el movimiento para trazabilidad
            db.prepare(`INSERT INTO Movimiento_inventario (insumo_id, tipo, cantidad, motivo, fecha) VALUES (?, 'SALIDA', ?, ?, datetime('now', 'localtime'))`).run(
              ing.insumo_id, 
              qtyToDeduct, 
              `Venta Orden #${orderId} (Prod ID: ${item.producto_id})`
            )
          }
        }
        // ----------------------------------------------------------------
        
        return { success: true }
      })
      return tx()
    } catch (e: any) { return { success: false, error: e.message } }
  })

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

function recalculateOrderTotal(ordenId: number) {
  const result = db.prepare('SELECT SUM(precio * cantidad) as total FROM orden_item WHERE orden_id = ?').get(ordenId) as any
  const total = result?.total || 0
  db.prepare('UPDATE orden SET total = ? WHERE id = ?').run(total, ordenId)
}