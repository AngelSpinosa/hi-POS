import { app } from 'electron'
import { join, resolve } from 'path'
import { is } from '@electron-toolkit/utils'
import Database from 'better-sqlite3'

// Exportamos la instancia para que la usen los módulos
export let db: Database.Database
export let currentDbPath: string // Mantenemos el path accesible

export function initDatabase() {
  try {
    currentDbPath = is.dev
      ? resolve(process.cwd(), 'data/pos.db')          // desarrollo: carpeta /data en raíz del proyecto
      : join(app.getPath('userData'), 'pos.db')         // producción: AppData del usuario

    console.log(`Intentando conectar a la BD en: ${currentDbPath}`)

    db = new Database(currentDbPath, { verbose: console.log })
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    console.log('Conexión a SQLite exitosa')
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error)
  }
}

// Nueva función crítica para permitir respaldos y restauraciones
export function closeDatabase() {
  try {
    if (db) {
      db.close();
      console.log('Conexión a la base de datos cerrada de forma segura.');
    }
  } catch (error) {
    console.error('Error cerrando la base de datos:', error);
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