import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Importamos la BD y los módulos
import { runMigrations } from './database/migrate'
import { initDatabase } from './database'
import { registerProductHandlers } from './modules/products'
import { registerUserHandlers } from './modules/users'
import { registerOrderHandlers } from './modules/orders'
import { registerReportHandlers } from './modules/reports'
import { registerLicenseHandlers } from './modules/license'
import { registerInventoryHandlers } from './modules/inventory'

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

// INICIALIZACIÓN
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pospizza')

  // 1. Crear BD desde migraciones si no existe aún
  runMigrations()

  // 2. Conectar a la BD (ya garantizada por el paso anterior)
  initDatabase()

  // 3. Registrar Módulos (Handlers)
  registerProductHandlers()
  registerUserHandlers()
  registerOrderHandlers()
  registerReportHandlers()
  registerLicenseHandlers()
  registerInventoryHandlers()

  // 4. Crear Ventana
  app.on('browser-window-created', (_, window) => { optimizer.watchWindowShortcuts(window) })
  createWindow()

  app.on('activate', function () { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') { app.quit() } })