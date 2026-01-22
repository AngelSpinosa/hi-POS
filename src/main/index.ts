import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import Database from 'better-sqlite3'

let db: Database.Database

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

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
    
    db = new Database(dbPath, { verbose: console.log })
    db.pragma('journal_mode = WAL')
    
    console.log('Conexión a SQLite exitosa')
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error)
  }
}

// --- HELPER CRÍTICO: Obtener items de una orden ---
// Esta función es la que estaba faltando usarse en los handlers
function getOrderItems(orderId: number) {
  return db.prepare(`
    SELECT 
      producto_id as id, 
      nombre, 
      precio, 
      cantidad as quantity 
    FROM orden_item 
    WHERE orden_id = ?
  `).all(orderId)
}

function getDailyReportId(): number {
  const today = new Date().toISOString().split('T')[0]
  const stmt = db.prepare('SELECT id FROM reporte_diario WHERE fecha = ?')
  const report = stmt.get(today) as { id: number } | undefined

  if (report) return report.id

  console.log('Creando nuevo Reporte Diario para:', today)
  const insert = db.prepare('INSERT INTO reporte_diario (fecha) VALUES (?)')
  const info = insert.run(today)
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
    try {
      return db.prepare('SELECT * FROM producto WHERE active = 1').all()
    } catch (error) {
      console.error('Error obteniendo productos:', error)
      return []
    }
  })

  ipcMain.handle('get-active-order', () => {
    if (!db) return { success: false, error: 'Sin conexión BD' }
    
    try {
      let order = db.prepare("SELECT * FROM orden WHERE estatus = 'pendiente' LIMIT 1").get() as any

      if (!order) {
        const reportId = getDailyReportId()
        const fechaActual = new Date().toISOString()
        
        const stmtInsert = db.prepare(`
          INSERT INTO orden (user_id, id_reporte_diario, estatus, total, ticket_impreso, creado_en)
          VALUES (1, ?, 'pendiente', 0, 0, ?)
        `)
        const info = stmtInsert.run(reportId, fechaActual)
        
        order = { id: info.lastInsertRowid, estatus: 'pendiente', total: 0 }
        console.log(`Nueva orden creada ID: ${order.id}`)
      }

      const items = getOrderItems(order.id)
      return { success: true, order, items }

    } catch (error: any) {
      console.error('Error en get-active-order:', error)
      return { success: false, error: error.message }
    }
  })

  // --- AQUÍ ESTÁ LA CORRECCIÓN CLAVE ---
  
  ipcMain.handle('add-to-cart', (_, { orderId, product }) => {
    try {
      const existing = db.prepare('SELECT id FROM orden_item WHERE orden_id = ? AND producto_id = ?').get(orderId, product.id) as any

      if (existing) {
        db.prepare('UPDATE orden_item SET cantidad = cantidad + 1 WHERE id = ?').run(existing.id)
      } else {
        db.prepare(`
          INSERT INTO orden_item (orden_id, producto_id, nombre, precio, cantidad)
          VALUES (?, ?, ?, ?, 1)
        `).run(orderId, product.id, product.nombre, product.precio)
      }
      
      const newTotal = recalculateOrderTotal(orderId)
      const items = getOrderItems(orderId) // <-- ESTO FALTABA: Devolver la lista actualizada
      return { success: true, newTotal, items }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('remove-from-cart', (_, { orderId, productId }) => {
    try {
      db.prepare('DELETE FROM orden_item WHERE orden_id = ? AND producto_id = ?').run(orderId, productId)
      
      const newTotal = recalculateOrderTotal(orderId)
      const items = getOrderItems(orderId) // <-- Devolver lista actualizada
      return { success: true, newTotal, items }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('update-quantity', (_, { orderId, productId, quantity }) => {
    try {
      if (quantity < 1) return { success: false, error: 'Cantidad inválida' }
      db.prepare('UPDATE orden_item SET cantidad = ? WHERE orden_id = ? AND producto_id = ?').run(quantity, orderId, productId)
      
      const newTotal = recalculateOrderTotal(orderId)
      const items = getOrderItems(orderId) // <-- Devolver lista actualizada
      return { success: true, newTotal, items }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('pay-order', (_, { orderId, payment, total }) => {
    try {
      const check = db.prepare('SELECT total FROM orden WHERE id = ?').get(orderId) as any
      if (!check || check.total <= 0) {
        return { success: false, error: 'Orden vacía' }
      }

      const payTransaction = db.transaction(() => {
        const fechaActual = new Date().toISOString()
        const cambio = payment.received - total

        db.prepare(`
          INSERT INTO pago (orden_id, metodo, monto_recibido, cambio, creado_en)
          VALUES (?, ?, ?, ?, ?)
        `).run(orderId, payment.method, payment.received, cambio, fechaActual)

        db.prepare(`
          UPDATE orden 
          SET estatus = 'pagada', ticket_impreso = 0 
          WHERE id = ?
        `).run(orderId)
      })

      payTransaction()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})