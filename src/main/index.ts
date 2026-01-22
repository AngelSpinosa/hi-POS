import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import Database from 'better-sqlite3'

// Variable para mantener la conexión a la BD
let db: Database.Database

function createWindow(): void {
  // Create the browser window.
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

  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Inicialización de la Base de Datos
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

// --- HELPER: Obtener ID del Reporte Diario ---
function getDailyReportId(): number {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  
  // 1. Buscamos si ya existe reporte hoy
  const stmt = db.prepare('SELECT id FROM reporte_diario WHERE fecha = ?')
  const report = stmt.get(today) as { id: number } | undefined

  if (report) {
    return report.id
  }

  // 2. Si no existe, lo creamos
  console.log('Creando nuevo Reporte Diario para:', today)
  const insert = db.prepare('INSERT INTO reporte_diario (fecha) VALUES (?)')
  const info = insert.run(today)
  return Number(info.lastInsertRowid)
}

// --- HELPER: Recalcular Total de Orden ---
function recalculateOrderTotal(orderId: number) {
  const result = db.prepare('SELECT SUM(precio * cantidad) as total FROM orden_item WHERE orden_id = ?').get(orderId) as { total: number }
  const newTotal = result.total || 0
  db.prepare('UPDATE orden SET total = ? WHERE id = ?').run(newTotal, orderId)
  return newTotal
}


app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pospizza')

  // 1. Inicializar BD
  initDatabase()

  // 2. Definir manejadores IPC

  // UC-10: Obtener productos activos
  ipcMain.handle('get-products', () => {
    if (!db) return []
    try {
      return db.prepare('SELECT * FROM producto WHERE active = 1').all()
    } catch (error) {
      console.error('Error obteniendo productos:', error)
      return []
    }
  })

  // NUEVO: Inicializar sesión de venta (Persistencia)
  ipcMain.handle('get-active-order', () => {
    if (!db) return { success: false, error: 'Sin conexión BD' }
    
    try {
      // A. Buscar orden pendiente
      let order = db.prepare("SELECT * FROM orden WHERE estatus = 'pendiente' LIMIT 1").get() as any

      // B. Si no existe, crear una nueva vinculada al Reporte Diario
      if (!order) {
        const reportId = getDailyReportId()
        const fechaActual = new Date().toISOString()
        
        const stmtInsert = db.prepare(`
          INSERT INTO orden (user_id, id_reporte_diario, estatus, total, ticket_impreso, creado_en)
          VALUES (1, ?, 'pendiente', 0, 0, ?)
        `)
        const info = stmtInsert.run(reportId, fechaActual)
        
        order = { id: info.lastInsertRowid, estatus: 'pendiente', total: 0 }
        console.log(`Nueva orden creada ID: ${order.id} (Reporte: ${reportId})`)
      }

      // C. Recuperar los items de esa orden (para llenar el carrito visual)
      // Nota: Hacemos alias 'quantity' para que coincida con tu frontend
      const items = db.prepare(`
        SELECT 
          id, 
          orden_id, 
          producto_id, 
          nombre, 
          precio, 
          cantidad as quantity 
        FROM orden_item 
        WHERE orden_id = ?
      `).all(order.id)

      return { success: true, order, items }

    } catch (error: any) {
      console.error('Error en get-active-order:', error)
      return { success: false, error: error.message }
    }
  })

  // NUEVO: Agregar item al carrito (Guardado inmediato)
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
      return { success: true, newTotal }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // NUEVO: Eliminar item
  ipcMain.handle('remove-from-cart', (_, { orderId, productId }) => {
    try {
      // Nota: Borramos por producto_id en esa orden
      db.prepare('DELETE FROM orden_item WHERE orden_id = ? AND producto_id = ?').run(orderId, productId)
      const newTotal = recalculateOrderTotal(orderId)
      return { success: true, newTotal }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // NUEVO: Actualizar cantidad
  ipcMain.handle('update-quantity', (_, { orderId, productId, quantity }) => {
    try {
      if (quantity < 1) return { success: false, error: 'Cantidad inválida' }
      db.prepare('UPDATE orden_item SET cantidad = ? WHERE orden_id = ? AND producto_id = ?').run(quantity, orderId, productId)
      const newTotal = recalculateOrderTotal(orderId)
      return { success: true, newTotal }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // NUEVO: Pagar orden (Finalizar transacción)
  ipcMain.handle('pay-order', (_, { orderId, payment, total }) => {
    try {
      const payTransaction = db.transaction(() => {
        const fechaActual = new Date().toISOString()
        const cambio = payment.received - total

        // 1. Registrar el pago
        db.prepare(`
          INSERT INTO pago (orden_id, metodo, monto_recibido, cambio, creado_en)
          VALUES (?, ?, ?, ?, ?)
        `).run(orderId, payment.method, payment.received, cambio, fechaActual)

        // 2. Cerrar la orden
        db.prepare(`
          UPDATE orden 
          SET estatus = 'pagada', ticket_impreso = 0 
          WHERE id = ?
        `).run(orderId)
      })

      payTransaction()
      console.log(`Orden ${orderId} pagada exitosamente.`)
      return { success: true }

    } catch (error: any) {
      console.error('Error al pagar:', error)
      return { success: false, error: error.message }
    }
  })

  // Helpers de ventana
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