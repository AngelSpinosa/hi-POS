import { ipcMain, app } from 'electron'
import path from 'path'
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

      // Recalculamos descuentos/promociones vigentes cada vez que se abre/recarga la orden,
      // así se autocorrige si una promo se creó, editó o venció mientras la mesa ya estaba abierta.
      recalculateOrderTotal(order.id)

      // Releemos el total ya actualizado por recalculateOrderTotal
      const ordenActualizada = db.prepare('SELECT total, descuento_total FROM orden WHERE id = ?').get(order.id) as any
      order.total = ordenActualizada?.total ?? order.total
      order.descuento_total = ordenActualizada?.descuento_total ?? 0

      // Antes: SELECT * FROM orden_item (sin categoria_id).
      // Sin ese dato, las promociones aplicadas por categoría (ej. 2x1 en "Bebidas")
      // nunca podían coincidir en el motor matemático del carrito.
      // Ahora también se trae promocion_nombre para mostrarle al cajero de dónde viene el descuento.
      const items = db.prepare(`
        SELECT oi.*, p.categoria_id, pr.nombre AS promocion_nombre
        FROM orden_item oi
        LEFT JOIN producto p ON oi.producto_id = p.id
        LEFT JOIN promocion pr ON oi.promocion_id = pr.id
        WHERE oi.orden_id = ?
      `).all(order.id)
      
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
        let montoRecibidoRegistrado = payment.received;

        if (payment.isCourtesy) {
          // Cortesía: se cierra la cuenta en $0 sin importar el total real de la orden.
          // Antes esto se comparaba contra order.total (el total real) y por eso
          // siempre salía como "pago parcial" en vez de cerrar la mesa.
          cambio = 0;
          appliedAmount = 0;
          montoRecibidoRegistrado = 0;
        } else if (payment.method === 'efectivo') {
          cambio = Math.max(0, payment.received - payment.amountToPay);
          appliedAmount = payment.received - cambio; 
        }

        db.prepare(`INSERT INTO pago (orden_id, metodo, monto_recibido, cambio) VALUES (?, ?, ?, ?)`).run(orderId, payment.method, montoRecibidoRegistrado, cambio);

        const tzOffset = new Date().getTimezoneOffset() * 60000;
        const today = new Date(Date.now() - tzOffset).toISOString().split('T')[0];
        let reporte = db.prepare('SELECT id FROM reporte_diario WHERE date(fecha) = ?').get(today) as any;
        if (!reporte) {
          const info = db.prepare('INSERT INTO reporte_diario (fecha) VALUES (?)').run(today);
          reporte = { id: info.lastInsertRowid };
        }

        const montoEfectivo = (!payment.isCourtesy && payment.method === 'efectivo') ? appliedAmount : 0;
        const montoTarjeta = (!payment.isCourtesy && payment.method === 'tarjeta') ? appliedAmount : 0;
        db.prepare(`UPDATE reporte_diario SET total_ventas = total_ventas + ?, total_efectivo = total_efectivo + ?, total_tarjeta = total_tarjeta + ? WHERE id = ?`).run(appliedAmount, montoEfectivo, montoTarjeta, reporte.id);

        const newTotalPagado = totalPagadoPreviamente + appliedAmount;
        const isFullyPaid = payment.isCourtesy ? true : newTotalPagado >= (order.total - 0.01);
        let cajeroName = null;

        if (isFullyPaid) {
          db.prepare("UPDATE orden SET estatus = 'pagada', ticket_impreso = 0, id_reporte_diario = ? WHERE id = ?").run(reporte.id, orderId);
          db.prepare("UPDATE reporte_diario SET total_pedidos = total_pedidos + 1 WHERE id = ?").run(reporte.id);
          const items = db.prepare('SELECT producto_id, cantidad FROM orden_item WHERE orden_id = ?').all(orderId) as any[];
          descontarInventarioPorVenta(items);
          const userRow = db.prepare('SELECT u.nombre FROM orden o JOIN user u ON o.user_id = u.id WHERE o.id = ?').get(orderId) as any;
          cajeroName = userRow?.nombre;
        }

        return { success: true, isFullyPaid, remaining: payment.isCourtesy ? 0 : Math.max(0, order.total - newTotalPagado), cajero: cajeroName }
      })
      return tx()
    } catch (e: any) { return { success: false, error: e.message } }
  })

  // ==========================================
  // REPORTES Y DETALLES (¡CORREGIDOS!)
  // ==========================================

  // Handler que faltaba por completo — useActiveOrder.ts ya lo invocaba, pero nunca
  // se había registrado en el backend (por eso el error "No handler registered").
  ipcMain.handle('cancel-order', (_, { orderId, pin }) => {
    if (!db) return { success: false, error: 'Sin conexión BD' }
    try {
      if (!orderId || !pin) return { success: false, error: 'Faltan datos para cancelar' }

      const admin = db.prepare(`SELECT id FROM user WHERE pin = ? AND rol = 'admin' AND active = 1`).get(pin) as any
      if (!admin) return { success: false, error: 'PIN incorrecto o sin permisos de administrador' }

      const order = db.prepare('SELECT id FROM orden WHERE id = ?').get(orderId) as any
      if (!order) return { success: false, error: 'La orden ya no existe' }

      const tx = db.transaction(() => {
        // Si la orden tenía pagos parciales registrados, se borran también (decisión de negocio).
        // NOTA: esto NO revierte los montos que ya se sumaron a reporte_diario cuando se
        // registró ese pago (total_ventas, total_efectivo, etc.). Si se necesita que el
        // reporte diario también se corrija al cancelar, es un cambio aparte.
        db.prepare('DELETE FROM pago WHERE orden_id = ?').run(orderId)
        db.prepare('DELETE FROM orden_item WHERE orden_id = ?').run(orderId)
        db.prepare('DELETE FROM orden WHERE id = ?').run(orderId)
      })
      tx()

      return { success: true }
    } catch (e: any) {
      console.error('Error cancelando orden:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('get-tickets-path', () => { return path.join(app.getPath('documents'), 'hi-POS_Tickets'); });
}

function recalculateOrderTotal(ordenId: number) {
  // ==========================================
  // MOTOR MATEMÁTICO DE PROMOCIONES (lado backend)
  // Antes esta función solo sumaba precio * cantidad, sin aplicar
  // descuentos. Eso hacía que orden.total (BD) y reporte_diario nunca
  // coincidieran con lo que el frontend mostraba en pantalla.
  // Ahora replica las mismas reglas que useActiveOrder.ts:
  //  - "% de producto", "2x1" y "Precio Fijo" se calculan por item,
  //    sobre precio original, y se guardan en orden_item.
  //  - "% TOTAL" se calcula sobre el subtotal original completo
  //    (no se apila sobre los descuentos ya aplicados).
  // ==========================================

  // 1. Apagar promociones vencidas antes de calcular (misma regla que products.ts)
  db.prepare(`
    UPDATE promocion 
    SET activa = 0 
    WHERE activa = 1 
      AND hora_fin IS NOT NULL 
      AND date('now', 'localtime') > date(hora_fin)
  `).run()

  // 2. Cargar promociones activas con sus reglas de categoría/producto
  const promos = db.prepare('SELECT * FROM promocion WHERE activa = 1').all() as any[]
  const getCategorias = db.prepare('SELECT categoria_id FROM promocion_categoria WHERE promocion_id = ?')
  const getProductos = db.prepare('SELECT producto_id FROM promocion_producto WHERE promocion_id = ?')
  const promosConReglas = promos.map((p) => ({
    id: p.id,
    tipo: p.tipo,
    valor: p.valor as number | null,
    valorPago: p.valor_pago as number | null, // <-- Nuevo: para '2x1' generalizado
    categorias: (getCategorias.all(p.id) as any[]).map((r) => r.categoria_id),
    productos: (getProductos.all(p.id) as any[]).map((r) => r.producto_id)
  }))

  // 3. Cargar los items de la orden con su categoria_id (igual que en open-table-order)
  const items = db.prepare(`
    SELECT oi.*, p.categoria_id
    FROM orden_item oi
    LEFT JOIN producto p ON oi.producto_id = p.id
    WHERE oi.orden_id = ?
  `).all(ordenId) as any[]

  let subtotal = 0
  let descuentoTotal = 0
  const itemUpdates: { id: number; descuento: number; promocionId: number | null }[] = []

  items.forEach((item) => {
    const itemSubtotal = item.precio * item.cantidad
    subtotal += itemSubtotal

    let itemDescuento = 0
    let itemPromoId: number | null = null

    for (const promo of promosConReglas) {
      if (promo.tipo === '% TOTAL') continue // esta se aplica al final, sobre el total, no por item

      const matchProducto = promo.productos.includes(item.producto_id)
      const matchCategoria = item.categoria_id ? promo.categorias.includes(item.categoria_id) : false
      if (!matchProducto && !matchCategoria) continue

      if (promo.tipo === '% de producto') {
        itemDescuento += itemSubtotal * ((promo.valor || 0) / 100)
        itemPromoId = promo.id
      } else if (promo.tipo === '2x1') {
        // Generalizado: "X productos por el precio de Y" (el clásico 2x1 es X=2, Y=1).
        // Se defiende con valores por defecto por si alguna promo antigua no tiene valor_pago.
        const cantidadRequerida = promo.valor && promo.valor > 0 ? promo.valor : 2
        const cantidadPagada = promo.valorPago && promo.valorPago > 0 ? promo.valorPago : 1
        if (cantidadPagada < cantidadRequerida) {
          const grupos = Math.floor(item.cantidad / cantidadRequerida)
          const itemsGratis = grupos * (cantidadRequerida - cantidadPagada)
          itemDescuento += itemsGratis * item.precio
          itemPromoId = promo.id
        }
      } else if (promo.tipo === 'Precio Fijo') {
        itemDescuento += (promo.valor || 0)
        itemPromoId = promo.id
      }
    }

    itemUpdates.push({ id: item.id, descuento: itemDescuento, promocionId: itemPromoId })
    descuentoTotal += itemDescuento
  })

  // % TOTAL: sobre el subtotal original completo
  promosConReglas.forEach((promo) => {
    if (promo.tipo === '% TOTAL') {
      descuentoTotal += subtotal * ((promo.valor || 0) / 100)
    }
  })

  const totalFinal = Math.max(0, subtotal - descuentoTotal)

  const updateItemStmt = db.prepare('UPDATE orden_item SET descuento_aplicado = ?, promocion_id = ? WHERE id = ?')
  itemUpdates.forEach((u) => updateItemStmt.run(u.descuento, u.promocionId, u.id))

  db.prepare('UPDATE orden SET total = ?, descuento_total = ? WHERE id = ?').run(totalFinal, descuentoTotal, ordenId)
}