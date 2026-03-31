import { app } from 'electron'
import { join, resolve } from 'path'
import { is } from '@electron-toolkit/utils'
import fs from 'fs'
import Database from 'better-sqlite3'

export function runMigrations() {
  const dbPath = is.dev
    ? resolve(process.cwd(), 'data/pos.db')            // misma lógica que database.ts
    : join(app.getPath('userData'), 'pos.db')

  // Si la BD ya existe, no hacemos nada (datos de demo/producción intactos)
  if (fs.existsSync(dbPath)) {
    console.log('BD ya existe, omitiendo migraciones.')
    return
  }

  console.log('🔄 Iniciando sistema de migraciones...')

  const db = new Database(dbPath)

  // Las migraciones viven dentro del proyecto, junto a este archivo
  const migrationsDir = is.dev
    ? resolve(process.cwd(), 'src/main/database/migrations')
    : join(__dirname, 'migrations')                     // en build, Electron copia la carpeta aquí

  // 1. Verificar si la tabla de control ya existe
  const checkTable = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='migrations';
  `).get()

  if (!checkTable) {
    console.log('⚠️ Tabla de migraciones no detectada. Se creará con el primer script.')
  }

  // 2. Leer y ordenar archivos .sql
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort()

  // 3. Ejecutar migraciones pendientes
  files.forEach(file => {
    let migrated = false

    if (checkTable) {
      const row = db.prepare('SELECT id FROM migrations WHERE filename = ?').get(file)
      if (row) migrated = true
    }

    if (!migrated) {
      console.log(`🚀 Ejecutando migración: ${file}`)

      const sql = fs.readFileSync(join(migrationsDir, file), 'utf-8')

      const runTransaction = db.transaction(() => {
        db.exec(sql)
        db.prepare('INSERT INTO migrations (filename) VALUES (?)').run(file)
      })

      try {
        runTransaction()
        console.log(`✅ ${file} completado con éxito.`)
      } catch (error: any) {
        console.error(`❌ Error en ${file}:`, error.message)
        process.exit(1)
      }
    } else {
      console.log(`⏭️  Saltando ${file} (ya aplicado).`)
    }
  })

  console.log('🏁 Todas las migraciones están al día.')
  db.close()
}