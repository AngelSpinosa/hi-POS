import { ipcMain } from 'electron'
import { db } from '../database'

export function registerProductHandlers() {
  ipcMain.handle('get-products', () => {
    if (!db) return []
    try {
      return db.prepare('SELECT * FROM producto WHERE active = 1').all()
    } catch (error) {
      console.error('Error obteniendo productos:', error)
      return []
    }
  })
}