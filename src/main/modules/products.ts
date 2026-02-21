import { ipcMain } from 'electron'
import { db } from '../database'

export function registerProductHandlers() {
  
  // 1. Obtener todos los productos (Activos e inactivos, ordenados)
  ipcMain.handle('get-products', () => {
    if (!db) return []
    try {
      return db.prepare('SELECT * FROM producto ORDER BY active DESC, nombre ASC').all()
    } catch (error) {
      console.error('Error obteniendo productos:', error)
      return []
    }
  })

  // 2. Crear Producto
  ipcMain.handle('create-product', (_, { nombre, precio }) => {
    if (!db) return { success: false, error: 'Base de datos no disponible' }
    try {
      if (!nombre || precio === undefined) throw new Error('Datos inválidos')

      const stmt = db.prepare('INSERT INTO producto (nombre, precio, active) VALUES (?, ?, 1)')
      const info = stmt.run(nombre, precio)
      return { success: true, id: info.lastInsertRowid }
    } catch (error: any) {
      console.error('Error creando producto:', error)
      return { success: false, error: error.message }
    }
  })

  // 3. Editar Producto
  ipcMain.handle('update-product', (_, { id, nombre, precio }) => {
    if (!db) return { success: false, error: 'Base de datos no disponible' }
    try {
      const stmt = db.prepare('UPDATE producto SET nombre = ?, precio = ? WHERE id = ?')
      stmt.run(nombre, precio, id)
      return { success: true }
    } catch (error: any) {
      console.error('Error actualizando producto:', error)
      return { success: false, error: error.message }
    }
  })

  // 4. Activar / Desactivar Producto
  ipcMain.handle('toggle-product-status', (_, { id, active }) => {
    if (!db) return { success: false, error: 'Base de datos no disponible' }
    try {
      const stmt = db.prepare('UPDATE producto SET active = ? WHERE id = ?')
      stmt.run(active ? 1 : 0, id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}