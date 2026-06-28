import { ipcMain, app, BrowserWindow, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { db } from '../database'
import { descontarInventarioPorVenta } from './inventory'

export function registerOrderHandlers() {

  // ==========================================
  // HANDLERS PARA POS
  // ==========================================
  
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
      return productos.map(p => ({
        ...p,
        disponible: p.disponible === 1
      }))
    } catch (error) { 
      console.error("❌ Error en get-productos-pos:", error);
      return [] 
    }
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
    } catch (error) { 
      console.error("❌ Error en get-tables:", error);
      return [] 
    }
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
      
      // Calcular cuánto se ha pagado hasta ahora en esta orden
      const pagosStmt = db.prepare('SELECT SUM(monto_recibido - cambio) as pagado FROM pago WHERE orden_id = ?').get(order.id) as any
      order.totalPagado = pagosStmt?.pagado || 0

      return { success: true, order, items }
    } catch (error: any) {
      console.error("❌ Error al abrir mesa:", error)
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

  // ==========================================
  // PAGO PARCIAL O TOTAL
  // ==========================================
  ipcMain.handle('pay-order', (_, { orderId, payment }) => {
    if (!db) return { success: false }
    try {
      const tx = db.transaction(() => {
        // 1. Obtener información de la orden y pagos previos
        const order = db.prepare('SELECT total, estatus FROM orden WHERE id = ?').get(orderId) as any;
        if (!order) throw new Error('Orden no encontrada');

        const pagosStmt = db.prepare('SELECT SUM(monto_recibido - cambio) as pagado FROM pago WHERE orden_id = ?').get(orderId) as any;
        const totalPagadoPreviamente = pagosStmt?.pagado || 0;
        const remainingBalance = order.total - totalPagadoPreviamente;

        // 2. Definir cuánto se está aplicando en este pago
        const targetAmountToPay = payment.amountToPay || remainingBalance;
        let cambio = 0;
        let appliedAmount = targetAmountToPay;

        if (payment.method === 'efectivo') {
          cambio = Math.max(0, payment.received - targetAmountToPay);
          appliedAmount = payment.received - cambio; 
        } else {
          appliedAmount = targetAmountToPay; // Tarjeta es exacto
        }

        // 3. Registrar este pago en la BD
        db.prepare(`INSERT INTO pago (orden_id, metodo, monto_recibido, cambio) VALUES (?, ?, ?, ?)`).run(
          orderId, payment.method, payment.received, cambio
        );

        // 4. Obtener/Crear Reporte Diario para ir sumando los ingresos parciales
        const tzOffset = new Date().getTimezoneOffset() * 60000;
        const today = new Date(Date.now() - tzOffset).toISOString().split('T')[0];
        let reporte = db.prepare('SELECT id FROM reporte_diario WHERE date(fecha) = ?').get(today) as any;
        
        if (!reporte) {
          const info = db.prepare('INSERT INTO reporte_diario (fecha) VALUES (?)').run(today);
          reporte = { id: info.lastInsertRowid };
        }

        const montoEfectivo = payment.method === 'efectivo' ? appliedAmount : 0;
        const montoTarjeta = payment.method === 'tarjeta' ? appliedAmount : 0;
        
        // Sumamos dinero al reporte diario inmediatamente
        db.prepare(`
          UPDATE reporte_diario 
          SET total_ventas = total_ventas + ?, total_efectivo = total_efectivo + ?, total_tarjeta = total_tarjeta + ? 
          WHERE id = ?
        `).run(appliedAmount, montoEfectivo, montoTarjeta, reporte.id);

        // 5. Verificar si la cuenta ya se liquidó por completo
        const newTotalPagado = totalPagadoPreviamente + appliedAmount;
        const isFullyPaid = newTotalPagado >= (order.total - 0.01); // Tolerancia para floats
        
        let cajeroName = null;

        if (isFullyPaid) {
          // Si ya se pagó todo, cerramos la orden, vinculamos reporte e incrementamos 'total_pedidos'
          db.prepare("UPDATE orden SET estatus = 'pagada', ticket_impreso = 0, id_reporte_diario = ? WHERE id = ?").run(reporte.id, orderId);
          db.prepare("UPDATE reporte_diario SET total_pedidos = total_pedidos + 1 WHERE id = ?").run(reporte.id);

          // Descontar Inventario solo 1 vez al cerrar la cuenta completa
          const items = db.prepare('SELECT producto_id, cantidad FROM orden_item WHERE orden_id = ?').all(orderId) as any[];
          descontarInventarioPorVenta(items);

          const userRow = db.prepare('SELECT u.nombre FROM orden o JOIN user u ON o.user_id = u.id WHERE o.id = ?').get(orderId) as any;
          cajeroName = userRow?.nombre;
        }

        return { 
          success: true, 
          isFullyPaid, 
          remaining: Math.max(0, order.total - newTotalPagado),
          cajero: cajeroName
        }
      })
      return tx()
    } catch (e: any) { 
      console.error("❌ Error en pay-order:", e);
      return { success: false, error: e.message } 
    }
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

  // ==========================================
  // HANDLERS PARA HISTORIAL Y PDF
  // ==========================================

  ipcMain.handle('get-tickets-path', () => {
    return path.join(app.getPath('documents'), 'hi-POS_Tickets');
  });

  ipcMain.handle('get-tickets-by-date', (_, { date }) => {
    if (!db) return { success: false, error: 'DB no conectada' }
    try {
      const orders = db.prepare(`
        SELECT o.id, o.total, o.estatus, o.creado_en, u.nombre as cajero
        FROM orden o
        LEFT JOIN user u ON o.user_id = u.id
        WHERE date(o.creado_en) = ? AND o.estatus IN ('pagada', 'cancelada')
        ORDER BY o.id DESC
      `).all(date) as any[]

      const tickets = orders.map(order => {
        const items = db.prepare('SELECT nombre, cantidad, precio FROM orden_item WHERE orden_id = ?').all(order.id)
        // Anidamos los pagos como un arreglo dentro del ticket
        const pagos = db.prepare('SELECT metodo, monto_recibido, cambio FROM pago WHERE orden_id = ?').all(order.id)
        return { ...order, items, pagos }
      })

      return { success: true, tickets }
    } catch (error: any) {
      console.error("❌ Error al obtener historial:", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('generate-ticket-pdf', async (_, { orderId, items, total, payment, businessName, date, cajero }) => {
    try {
      const ticketsDir = path.join(app.getPath('documents'), 'hi-POS_Tickets');
      if (!fs.existsSync(ticketsDir)) {
        fs.mkdirSync(ticketsDir, { recursive: true });
      }

      const pdfPath = path.join(ticketsDir, `Ticket_${orderId}.pdf`);
      const tempHtmlPath = path.join(app.getPath('temp'), `temp_ticket_${orderId}.html`);
      
      const win = new BrowserWindow({ 
        show: false, 
        width: 400, 
        height: 600,
        backgroundColor: '#ffffff',
        webPreferences: { nodeIntegration: false }
      })
      
      const itemsHtml = items.map(item => `
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-bottom: 5px;">
          <div style="display: flex; gap: 8px;">
            <span>${item.cantidad}x</span> 
            <span>${item.nombre}</span>
          </div>
          <span>$${(item.precio * item.cantidad).toFixed(2)}</span>
        </div>
      `).join('')

      const paymentHtml = payment && payment.monto_recibido !== undefined && payment.monto_recibido !== null ? `
        <div style="display: flex; justify-content: space-between;"><span>Método:</span> <span style="text-transform: capitalize;">${payment.metodo}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Recibido:</span> <span>$${Number(payment.monto_recibido).toFixed(2)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Cambio:</span> <span>$${Number(payment.cambio || 0).toFixed(2)}</span></div>
      ` : '';

      const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <style>
            @page { margin: 0; size: 80mm 200mm; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              color: black; 
              background: white; 
              margin: 0;
              padding: 15px; 
              width: 80mm;
              box-sizing: border-box;
            }
            .ticket-wrapper {
              width: 260px;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          <div class="ticket-wrapper">
            <div style="text-align: center; margin-bottom: 15px;">
              <h2 style="margin: 0; text-transform: uppercase; font-size: 18px;">${businessName || 'POS PIZZERÍA'}</h2>
              <p style="margin: 5px 0; font-size: 14px;">Ticket #${orderId}</p>
              <p style="margin: 5px 0; font-size: 14px;">Mesero: ${cajero || 'N/A'}</p>
              <p style="margin: 5px 0; font-size: 14px;">${date || new Date().toLocaleString('es-MX')}</p>
            </div>
            <hr style="border-top: 1px dashed black; margin: 15px 0;">
            ${itemsHtml}
            <hr style="border-top: 1px dashed black; margin: 15px 0;">
            <div style="text-align: right; font-size: 16px; font-weight: bold; margin-bottom: 15px;">
              TOTAL: $${Number(total).toFixed(2)}
            </div>
            <div style="font-size: 14px; font-weight: bold;">
              ${paymentHtml}
            </div>
            <hr style="border-top: 1px dashed black; margin: 15px 0;">
            <div style="text-align: center; font-size: 12px;">¡Gracias por su preferencia!</div>
          </div>
        </body>
        </html>
      `

      fs.writeFileSync(tempHtmlPath, html, 'utf-8');
      await win.loadFile(tempHtmlPath);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const pdfData = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: { width: 80000, height: 200000 },
        margins: { marginType: 'none' }
      })

      fs.writeFileSync(pdfPath, pdfData)
      fs.unlinkSync(tempHtmlPath)
      win.destroy()

      shell.openPath(pdfPath)

      return { success: true, path: pdfPath }
    } catch (e: any) {
      console.error("❌ Error generando PDF:", e)
      return { success: false, error: e.message }
    }
  })
}

// Función auxiliar fuera de los handlers
function recalculateOrderTotal(ordenId: number) {
  const result = db.prepare('SELECT SUM(precio * cantidad) as total FROM orden_item WHERE orden_id = ?').get(ordenId) as any
  const total = result?.total || 0
  db.prepare('UPDATE orden SET total = ? WHERE id = ?').run(total, ordenId)
}