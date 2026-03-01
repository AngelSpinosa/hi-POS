import { ipcMain } from 'electron'
import { db } from '../database'

export function registerProductHandlers() {
  
  // 1. Obtener TODOS los productos (Para el panel de administración)
  ipcMain.handle('get-products', () => {
    if (!db) return []
    try {
      // Ordenamos: Primero activos, luego alfabéticamente
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
      if (!nombre || nombre.trim() === '') throw new Error('El nombre es obligatorio')
      
      const precioNum = Number(precio)
      if (isNaN(precioNum) || precioNum < 0) throw new Error('El precio no puede ser negativo ni estar vacío')

      // Convertir a mayúsculas
      const nombreMayus = nombre.trim().toUpperCase()

      // Validar duplicidad
      const existe = db.prepare('SELECT id FROM producto WHERE nombre = ?').get(nombreMayus)
      if (existe) throw new Error(`Ya existe un producto llamado "${nombreMayus}"`)

      const stmt = db.prepare('INSERT INTO producto (nombre, precio, active) VALUES (?, ?, 1)')
      const info = stmt.run(nombreMayus, precioNum)
      return { success: true, id: info.lastInsertRowid }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 3. Editar Producto
  ipcMain.handle('update-product', (_, { id, nombre, precio }) => {
    if (!db) return { success: false, error: 'Base de datos no disponible' }
    try {
      if (!nombre || nombre.trim() === '') throw new Error('El nombre es obligatorio')
      
      const precioNum = Number(precio)
      if (isNaN(precioNum) || precioNum < 0) throw new Error('El precio no puede ser negativo ni estar vacío')

      const nombreMayus = nombre.trim().toUpperCase()

      // Validar duplicidad (excluyendo el que estamos editando)
      const existe = db.prepare('SELECT id FROM producto WHERE nombre = ? AND id != ?').get(nombreMayus, id)
      if (existe) throw new Error(`Ya existe otro producto llamado "${nombreMayus}"`)

      const stmt = db.prepare('UPDATE producto SET nombre = ?, precio = ? WHERE id = ?')
      stmt.run(nombreMayus, precioNum, id)
      return { success: true }
    } catch (error: any) {
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