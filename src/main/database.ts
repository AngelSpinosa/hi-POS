import { app } from 'electron'
import { join, resolve } from 'path'
import { is } from '@electron-toolkit/utils'
import Database from 'better-sqlite3'

// Exportamos la instancia para que la usen los módulos
export let db: Database.Database

export function initDatabase() {
  try {
    const dbPath = is.dev
      ? resolve(process.cwd(), '../POS DB/data/pos.db') 
      : join(app.getPath('userData'), 'pos.db')

    console.log(`Intentando conectar a la BD en: ${dbPath}`)
    
    // fileMustExist: false permite que si no existe, falle o la cree según configuración (aquí solo conectamos)
    db = new Database(dbPath, { verbose: console.log })
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON') 
    
    console.log('Conexión a SQLite exitosa')
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error)
  }
}

// --- HELPERS REUTILIZABLES ---

export function getOrderItems(orderId: number) {
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

export function getDailyReportId(dateStr?: string): number {
  const date = dateStr || new Date().toISOString().split('T')[0]
  const stmt = db.prepare('SELECT id FROM reporte_diario WHERE fecha = ?')
  const report = stmt.get(date) as { id: number } | undefined
  if (report) return report.id
  const insert = db.prepare('INSERT INTO reporte_diario (fecha) VALUES (?)')
  const info = insert.run(date)
  return Number(info.lastInsertRowid)
}

export function recalculateOrderTotal(orderId: number) {
  const result = db.prepare('SELECT SUM(precio * cantidad) as total FROM orden_item WHERE orden_id = ?').get(orderId) as { total: number }
  const newTotal = result.total || 0
  db.prepare('UPDATE orden SET total = ? WHERE id = ?').run(newTotal, orderId)
  return newTotal
}