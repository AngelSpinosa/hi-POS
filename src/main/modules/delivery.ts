import { ipcMain } from 'electron'
import { db } from '../database'
import { descontarInventarioPorVenta } from './inventory'

// ==========================================
// Handlers de Pedidos a Domicilio
// ==========================================
// Reutiliza los handlers genéricos que YA existen en orders.ts porque trabajan
// por ordenId, no por mesa: 'get-productos-pos', 'add-order-item',
// 'update-order-item-qty', 'remove-order-item' y 'print-command' funcionan
// igual para una orden de domicilio. Aquí solo se agrega lo que es específico
// de domicilio: crear la orden base sin mesa, capturar los datos de envío +
// cobrar (prepago), y el tablero de "Pedidos".

export function registerDeliveryHandlers() {

  // 1. Canales de delivery activos (para el <select> del modal de envío)
  ipcMain.handle('get-canales-delivery', () => {
    if (!db) return []
    try {
      return db.prepare('SELECT * FROM canal_delivery WHERE activo = 1 ORDER BY nombre ASC').all()
    } catch (error) {
      console.error('Error obteniendo canales de delivery:', error)
      return []
    }
  })

  // 2. Abrir una orden de domicilio nueva (equivalente a open-table-order, pero sin mesa)
  ipcMain.handle('open-delivery-order', (_, { userId }) => {
    if (!db) return { success: false, error: 'Sin conexión BD' }
    try {
      if (!userId) return { success: false, error: 'Falta el usuario' }

      const info = db.prepare(`
        INSERT INTO orden (user_id, mesa_id, tipo_orden, estatus, total, creado_en) 
        VALUES (?, NULL, 'domicilio', 'abierta', 0, datetime('now', 'localtime'))
      `).run(userId)

      const order = { id: info.lastInsertRowid, estatus: 'abierta', total: 0, mesa_id: null, tipo_orden: 'domicilio', totalPagado: 0 }
      return { success: true, order, items: [] }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 3. Confirmar datos de envío + cobrar (prepago) en una sola transacción.
  // Se llama DESPUÉS de "Generar comanda" (que ya se manda con el handler
  // print-command existente) y después de que el cajero llena el modal de envío.
  ipcMain.handle('create-delivery-info', (_, payload) => {
    if (!db) return { success: false, error: 'Sin conexión BD' }
    try {
      const {
        ordenId,
        clienteNombre,
        clienteTelefono,
        direccionEnvio,
        canalDeliveryId,
        costoEnvio,
        payment // { method: 'efectivo' | 'tarjeta', received: number }
      } = payload

      if (!ordenId) throw new Error('Falta la orden')
      if (!clienteNombre || clienteNombre.trim() === '') throw new Error('El nombre del cliente es obligatorio')
      if (!direccionEnvio || direccionEnvio.trim() === '') throw new Error('La dirección de envío es obligatoria')
      if (!canalDeliveryId) throw new Error('Selecciona el canal de delivery')

      const canal = db.prepare('SELECT * FROM canal_delivery WHERE id = ?').get(canalDeliveryId) as any
      if (!canal) throw new Error('Canal de delivery no válido')

      const costoEnvioNum = Number(costoEnvio) || 0

      const tx = db.transaction(() => {
        const orden = db.prepare('SELECT total FROM orden WHERE id = ?').get(ordenId) as any
        if (!orden) throw new Error('La orden no existe')

        // Lo que se le cobra al cliente incluye el costo de envío
        const totalACobrar = orden.total + costoEnvioNum

        let cambio = 0
        let montoRecibido = payment.received
        if (payment.method === 'efectivo') {
          if (payment.received < totalACobrar) throw new Error('El monto recibido es menor al total a cobrar')
          cambio = payment.received - totalACobrar
        } else {
          montoRecibido = totalACobrar
        }

        // 1. Cliente "desechable": solo para esta entrega, no se reutiliza.
        // La dirección va en cliente.direccion_defecto — como este cliente es nuevo
        // en cada pedido, no hace falta una columna aparte en orden_domicilio para esto.
        const clienteInfo = db.prepare('INSERT INTO cliente (nombre, telefono, direccion_defecto) VALUES (?, ?, ?)').run(
          clienteNombre.trim(),
          clienteTelefono ? clienteTelefono.trim() : '',
          direccionEnvio.trim()
        )
        const clienteId = clienteInfo.lastInsertRowid

        // 2. Comisión e ingreso neto, calculados con los defaults del canal elegido
        const montoComision = orden.total * ((canal.comision_porcentaje_default || 0) / 100)
        const montoRetenido = orden.total * ((canal.impuesto_retenido_default || 0) / 100)
        const ingresoNeto = orden.total - montoComision - montoRetenido

        // 3. orden_domicilio
        db.prepare(`
          INSERT INTO orden_domicilio 
            (orden_id, cliente_id, canal_delivery_id, costo_envio, monto_comision, ingreso_neto, estado_envio)
          VALUES (?, ?, ?, ?, ?, ?, 'en_cocina')
        `).run(ordenId, clienteId, canalDeliveryId, costoEnvioNum, montoComision, ingresoNeto)

        // 4. Registrar el pago (prepago, de una sola vez, sin parcialidades)
        db.prepare('INSERT INTO pago (orden_id, metodo, monto_recibido, cambio) VALUES (?, ?, ?, ?)').run(
          ordenId, payment.method, montoRecibido, cambio
        )

        // 5. Reporte diario
        const tzOffset = new Date().getTimezoneOffset() * 60000
        const today = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
        let reporte = db.prepare('SELECT id FROM reporte_diario WHERE date(fecha) = ?').get(today) as any
        if (!reporte) {
          const info = db.prepare('INSERT INTO reporte_diario (fecha) VALUES (?)').run(today)
          reporte = { id: info.lastInsertRowid }
        }
        const montoEfectivo = payment.method === 'efectivo' ? totalACobrar : 0
        const montoTarjeta = payment.method === 'tarjeta' ? totalACobrar : 0
        db.prepare(`
          UPDATE reporte_diario 
          SET total_ventas = total_ventas + ?, total_efectivo = total_efectivo + ?, total_tarjeta = total_tarjeta + ?, total_pedidos = total_pedidos + 1 
          WHERE id = ?
        `).run(totalACobrar, montoEfectivo, montoTarjeta, reporte.id)

        // 6. Cerrar la orden y descontar inventario (ya está pagada de una vez)
        db.prepare("UPDATE orden SET estatus = 'pagada', ticket_impreso = 0, id_reporte_diario = ? WHERE id = ?").run(reporte.id, ordenId)
        const items = db.prepare('SELECT producto_id, cantidad FROM orden_item WHERE orden_id = ?').all(ordenId) as any[]
        descontarInventarioPorVenta(items)

        return { totalACobrar, cambio }
      })

      const resultado = tx()
      return { success: true, ...resultado }
    } catch (error: any) {
      console.error('Error creando pedido de domicilio:', error)
      return { success: false, error: error.message }
    }
  })

  // 4. Tablero de Pedidos (las 3 columnas: en_cocina / en_camino / entregado)
  ipcMain.handle('get-delivery-orders', () => {
    if (!db) return []
    try {
      return db.prepare(`
        SELECT od.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, 
               c.direccion_defecto AS cliente_direccion,
               o.estatus AS orden_estatus, o.total AS orden_total
        FROM orden_domicilio od
        JOIN cliente c ON od.cliente_id = c.id
        JOIN orden o ON od.orden_id = o.id
        WHERE o.estatus != 'cancelada'
        ORDER BY od.id DESC
      `).all()
    } catch (error) {
      console.error('Error obteniendo pedidos de domicilio:', error)
      return []
    }
  })

  // 5. Mover un pedido de columna (drag & drop en el tablero)
  ipcMain.handle('update-delivery-status', (_, { orderDomicilioId, estadoEnvio }) => {
    if (!db) return { success: false, error: 'Sin conexión BD' }
    try {
      const estadosValidos = ['en_cocina', 'en_camino', 'entregado']
      if (!estadosValidos.includes(estadoEnvio)) throw new Error('Estado de envío no válido')

      db.prepare('UPDATE orden_domicilio SET estado_envio = ? WHERE id = ?').run(estadoEnvio, orderDomicilioId)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 6. Releer el estado de una orden de domicilio (carrito + total) por ordenId.
  // Se usa para refrescar el carrito después de add/remove/update-qty, igual que
  // fetchOrder() hace en useActiveOrder.ts, pero sin la lógica de mesas.
  ipcMain.handle('get-delivery-order-state', (_, { ordenId }) => {
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

      return { success: true, order, items }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}