import { app, dialog } from 'electron'
import { join, resolve, dirname } from 'path'
import { is } from '@electron-toolkit/utils'
import fs from 'fs'
import Database from 'better-sqlite3'
import { INIT_SCHEMA } from './schema' // Importamos tu genial solución de schema.ts

export function runMigrations() {
  const dbPath = is.dev
    ? resolve(process.cwd(), 'data/pos.db')
    : join(app.getPath('userData'), 'pos.db')

  // 1. Asegurar que el directorio exista (crucial en producción)
  const dbDir = dirname(dbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  console.log('🔄 Iniciando verificación del esquema de la base de datos...')

  let db;

  try {
    // 2. Abrimos conexión inicial
    db = new Database(dbPath)

    // 3. Verificación ROBUSTA
    const checkTable = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='licencia';
    `).get()

    if (checkTable) {
      console.log('✅ Base de datos detectada y operativa (Tablas existentes).')
      db.close()
      return // Salimos, no es necesario recrear
    }

    // 4. Si llegamos aquí, la BD está vacía o es nueva.
    console.log('⚠️ Base de datos vacía. Inyectando esquema inicial...')
    
    // Validar que el string de schema.ts realmente haya llegado
    if (!INIT_SCHEMA || INIT_SCHEMA.trim() === '') {
      throw new Error('La variable INIT_SCHEMA está vacía. Verifica tu archivo schema.ts.')
    }

    // Ejecutamos todo el string de schema.ts de golpe
    db.exec(INIT_SCHEMA)

    // Verificamos que la inyección realmente haya surtido efecto
    const verifyPostExec = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='licencia';`).get()
    if (!verifyPostExec) {
      throw new Error('La ejecución terminó, pero la tabla "licencia" no se creó. Revisa tu SQL.')
    }

    console.log('🎉 Esquema inicializado correctamente con todas sus tablas.')

  } catch (error: any) {
    console.error('❌ Error crítico al inicializar la base de datos:', error)
    
    // 🔥 ESTO ES LO MÁS IMPORTANTE 🔥
    // Si algo falla en producción, te forzará una ventana emergente mostrándote el error exacto.
    dialog.showErrorBox(
      'Error Crítico de Base de Datos',
      `No se pudo inicializar la base de datos de hi-POSApp.\n\nDetalle del error:\n${error.message}\n\nPor favor, verifica que tu archivo schema.ts no tenga errores de sintaxis (comas o paréntesis faltantes).`
    )
  } finally {
    // 5. Cerramos la conexión sin importar si hubo error o éxito
    if (db) {
      try {
        db.close()
      } catch (e) {
        console.error('Error al cerrar DB temporal', e)
      }
    }
  }
}