import { app, dialog } from 'electron'
import { join, resolve, dirname } from 'path'
import { is } from '@electron-toolkit/utils'
import fs from 'fs'
import Database from 'better-sqlite3'

export function runMigrations() {
  // 1. Definición de rutas (Base de Datos)
  const dbPath = is.dev
    ? resolve(process.cwd(), 'data/pos.db')
    : join(app.getPath('userData'), 'pos.db')

  // 2. Definición de rutas (Directorio de Migraciones)
  const migrationsDir = is.dev
    ? resolve(process.cwd(), 'src/main/database/migrations')
    : join(process.resourcesPath, 'migrations') // <- ¡Importante para producción!

  // Asegurar que el directorio de la BD exista
  const dbDir = dirname(dbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  console.log('Iniciando sistema dinámico de migraciones...')
  let db;

  try {
    db = new Database(dbPath)

    // 3. Asegurarnos de que la tabla de control de migraciones exista siempre
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        ejecutado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // 4. Validar existencia del directorio de scripts SQL
    if (!fs.existsSync(migrationsDir)) {
      console.warn(`Directorio de migraciones no encontrado en: ${migrationsDir}`)
      return;
    }

    // 5. Leer y ordenar los archivos .sql (001_, 002_, etc.)
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    // 6. Obtener las migraciones que ya fueron ejecutadas previamente
    const executedStmt = db.prepare('SELECT filename FROM migrations').all() as { filename: string }[]
    const executedSet = new Set(executedStmt.map(m => m.filename))

    let migrationsRun = 0;

    // 7. Ejecutar solo las migraciones faltantes
    for (const file of files) {
      if (!executedSet.has(file)) {
        console.log(`Ejecutando migración pendiente: ${file}...`)
        
        const filePath = join(migrationsDir, file)
        const sql = fs.readFileSync(filePath, 'utf-8')

        try {
          // Ejecutamos el archivo SQL completo
          db.exec(sql)
          
          // Registramos en la BD que este archivo ya se corrió exitosamente
          const insertStmt = db.prepare('INSERT INTO migrations (filename) VALUES (?)')
          insertStmt.run(file)
          
          migrationsRun++;
          console.log(` Migración ${file} aplicada con éxito.`)
        } catch (migError: any) {
           // Si un script falla, detenemos todo para proteger la integridad
           throw new Error(`Fallo en la sintaxis de ${file}: ${migError.message}`)
        }
      }
    }

    if (migrationsRun === 0) {
      console.log(' La base de datos ya está actualizada. No hay migraciones nuevas.')
    } else {
      console.log(` Se ejecutaron ${migrationsRun} archivo(s) de migración correctamente.`)
    }

  } catch (error: any) {
    console.error('Error crítico en el sistema de migraciones:', error)
    
    dialog.showErrorBox(
      'Error de Actualización de Base de Datos',
      `No se pudo actualizar la base de datos de hi-POSApp.\n\nDetalle del error:\n${error.message}\n\nRevisa el archivo de migración reciente.`
    )
  } finally {
    // 8. Cerrar conexión para que database.ts pueda abrir la suya
    if (db) {
      try {
        db.close()
      } catch (e) {
        console.error('Error al cerrar DB temporal de migraciones', e)
      }
    }
  }
}