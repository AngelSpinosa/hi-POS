import { ipcMain } from 'electron'
import { db } from '../database'

export function registerUserHandlers() {
  
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
      
      const existingPin = db.prepare('SELECT id FROM user WHERE pin = ?').get(pin)
      if (existingPin) return { success: false, error: 'Este PIN ya está en uso' }

      const existingName = db.prepare('SELECT id FROM user WHERE nombre = ?').get(nombre)
      if (existingName) return { success: false, error: 'Ya existe un usuario con este nombre' }

      const insert = db.prepare("INSERT INTO user (nombre, rol, pin, active) VALUES (?, 'cajero', ?, 1)")
      insert.run(nombre, pin)
      
      return { success: true }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  ipcMain.handle('update-user', (_, { userId, nombre, rol, pin }) => {
    try {
      if (!nombre || !pin || !rol) return { success: false, error: 'Datos incompletos' }
      
      if (userId === 1 && rol !== 'admin') {
        return { success: false, error: 'No se puede quitar el rol de Admin al usuario principal' }
      }

      const existingPin = db.prepare('SELECT id FROM user WHERE pin = ? AND id != ?').get(pin, userId)
      if (existingPin) return { success: false, error: 'Este PIN ya está en uso' }

      const existingName = db.prepare('SELECT id FROM user WHERE nombre = ? AND id != ?').get(nombre, userId)
      if (existingName) return { success: false, error: 'Ya existe un usuario con este nombre' }

      db.prepare('UPDATE user SET nombre = ?, rol = ?, pin = ? WHERE id = ?').run(nombre, rol, pin, userId)
      return { success: true }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  ipcMain.handle('toggle-user-status', (_, { userId, active }) => {
    try {
      if (userId === 1) return { success: false, error: 'No se puede desactivar al Admin principal' }
      db.prepare('UPDATE user SET active = ? WHERE id = ?').run(active ? 1 : 0, userId)
      return { success: true }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  ipcMain.handle('verify-pin', (_, { pin }) => {
    try {
      const user = db.prepare('SELECT id, nombre, rol FROM user WHERE pin = ? AND active = 1').get(pin)
      if (user) { return { success: true, user } } 
      else { return { success: false, error: 'PIN incorrecto o usuario inactivo' } }
    } catch (error: any) { return { success: false, error: error.message } }
  })
}