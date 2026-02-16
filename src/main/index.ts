import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import Database from 'better-sqlite3'

let db: Database.Database

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => { mainWindow.show() })
  
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function initDatabase() {
  try {
    const dbPath = is.dev
      ? resolve(process.cwd(), '../POS DB/data/pos.db') 
      : join(app.getPath('userData'), 'pos.db')

    console.log(`Intentando conectar a la BD en: ${dbPath}`)
    db = new Database(dbPath, { verbose: console.log, fileMustExist: false })
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON') 
    console.log('Conexión a SQLite exitosa')
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error)
  }
}

function getOrderItems(orderId: number) {
  return db.prepare(`
    SELECT 
      producto_id as id, 
      nombre, 
      precio, 
      cantidad, 
      comanda_impresa
    FROM orden_item 
    WHERE orden_id = ?
  `).all(orderId)
}

function getDailyReportId(dateStr?: string): number {
  const date = dateStr || new Date().toISOString().split('T')[0]
  const stmt = db.prepare('SELECT id FROM reporte_diario WHERE fecha = ?')
  const report = stmt.get(date) as { id: number } | undefined
  if (report) return report.id
  const insert = db.prepare('INSERT INTO reporte_diario (fecha) VALUES (?)')
  const info = insert.run(date)
  return Number(info.lastInsertRowid)
}

function recalculateOrderTotal(orderId: number) {
  const result = db.prepare('SELECT SUM(precio * cantidad) as total FROM orden_item WHERE orden_id = ?').get(orderId) as { total: number }
  const newTotal = result.total || 0
  db.prepare('UPDATE orden SET total = ? WHERE id = ?').run(newTotal, orderId)
  return newTotal
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pospizza')
  initDatabase()

  ipcMain.handle('get-products', () => {
    if (!db) return []
    try { return db.prepare('SELECT * FROM producto WHERE active = 1').all() } 
    catch (error) { return [] }
  })

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
        
        const stmtInsert = db.prepare(`
          INSERT INTO orden (user_id, id_reporte_diario, mesa_id, estatus, total, ticket_impreso, creado_en)
          VALUES (?, ?, ?, 'abierta', 0, 0, ?)
        `)
        const info = stmtInsert.run(userId, reportId, tableId, fechaActual)
        
        order = { id: info.lastInsertRowid, mesa_id: tableId, estatus: 'abierta', total: 0 }
      }

      const items = getOrderItems(order.id)
      return { success: true, order, items }

    } catch (error: any) {
      return { success: false, error: error.message }
    }
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

  // --- HANDLER DE CANCELACIÓN SEGURO ---
  ipcMain.handle('cancel-order', (_, { orderId, pin }) => {
    try {
      // 1. Obtener usuario por PIN
      const user = db.prepare('SELECT id, rol FROM user WHERE pin = ? AND active = 1').get(pin) as any
      if (!user) return { success: false, error: 'PIN incorrecto' }

      // 2. Obtener orden
      const order = db.prepare('SELECT user_id FROM orden WHERE id = ?').get(orderId) as any
      if (!order) return { success: false, error: 'Orden no encontrada' }

      // 3. VALIDACIÓN DE PERMISOS: Solo Admin o el Dueño de la orden
      if (user.rol !== 'admin' && user.id !== order.user_id) {
        return { success: false, error: 'Permisos insuficientes. Solo el Admin o el mesero que abrió la mesa pueden cancelarla.' }
      }

      // 4. Ejecutar cancelación
      db.prepare("UPDATE orden SET estatus = 'cancelada' WHERE id = ?").run(orderId)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-daily-report', (_, { date }) => {
    try {
      const report = db.prepare('SELECT * FROM reporte_diario WHERE fecha = ?').get(date)
      const orders = db.prepare(`SELECT o.id, o.total, o.creado_en, p.metodo, m.numero as mesa FROM orden o LEFT JOIN pago p ON p.orden_id = o.id LEFT JOIN mesa m ON o.mesa_id = m.id WHERE date(o.creado_en) LIKE ? AND o.estatus = 'pagada' ORDER BY o.creado_en DESC`).all(`${date}%`)
      return { success: true, report, orders }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  ipcMain.handle('get-order-details', (_, { orderId }) => {
    try {
      const items = getOrderItems(orderId)
      return { success: true, items }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  // --- GESTIÓN DE USUARIOS ---

  ipcMain.handle('get-users', () => {
    try {
      return db.prepare('SELECT * FROM user ORDER BY id ASC').all()
    } catch (error: any) { 
      return { success: false, error: error.message } 
    }
  })

  ipcMain.handle('create-user', (_, { nombre, pin }) => {
    try {
      if (!nombre || !pin) return { success: false, error: 'Faltan datos' }
      if (pin.length < 4) return { success: false, error: 'PIN muy corto' }
      
      // Validación PIN Duplicado
      const existingPin = db.prepare('SELECT id FROM user WHERE pin = ?').get(pin)
      if (existingPin) return { success: false, error: 'Este PIN ya está en uso por otro empleado' }

      // NUEVO: Validación Nombre Duplicado
      const existingName = db.prepare('SELECT id FROM user WHERE nombre = ?').get(nombre)
      if (existingName) return { success: false, error: 'Ya existe un usuario con este nombre' }

      const insert = db.prepare("INSERT INTO user (nombre, rol, pin, active) VALUES (?, 'cajero', ?, 1)")
      insert.run(nombre, pin)
      
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('update-user', (_, { userId, nombre, rol, pin }) => {
    try {
      if (!nombre || !pin || !rol) return { success: false, error: 'Datos incompletos' }
      
      if (userId === 1 && rol !== 'admin') {
        return { success: false, error: 'No se puede quitar el rol de Admin al usuario principal' }
      }

      // Validación PIN Duplicado
      const existingPin = db.prepare('SELECT id FROM user WHERE pin = ? AND id != ?').get(pin, userId)
      if (existingPin) return { success: false, error: 'Este PIN ya está en uso por otro empleado' }

      // NUEVO: Validación Nombre Duplicado
      const existingName = db.prepare('SELECT id FROM user WHERE nombre = ? AND id != ?').get(nombre, userId)
      if (existingName) return { success: false, error: 'Ya existe un usuario con este nombre' }

      db.prepare('UPDATE user SET nombre = ?, rol = ?, pin = ? WHERE id = ?').run(nombre, rol, pin, userId)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('toggle-user-status', (_, { userId, active }) => {
    try {
      if (userId === 1) return { success: false, error: 'No se puede desactivar al Admin principal' }
      db.prepare('UPDATE user SET active = ? WHERE id = ?').run(active ? 1 : 0, userId)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('verify-pin', (_, { pin }) => {
    try {
      const user = db.prepare('SELECT id, nombre, rol FROM user WHERE pin = ? AND active = 1').get(pin)
      if (user) { return { success: true, user } } 
      else { return { success: false, error: 'PIN incorrecto o usuario inactivo' } }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  app.on('browser-window-created', (_, window) => { optimizer.watchWindowShortcuts(window) })
  createWindow()
  app.on('activate', function () { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') { app.quit() } })