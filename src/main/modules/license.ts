import { ipcMain } from 'electron'
import { db } from '../database'
import * as crypto from 'crypto'
import * as os from 'os'

// ⚠️ MISMA CLAVE SECRETA QUE EN TU SCRIPT DE PYTHON
const SECRET_KEY = "PL72367SSK"

// Función auxiliar para obtener la Dirección MAC (Device ID)
function getDeviceId(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    const ifaces = interfaces[name]
    if (!ifaces) continue

    for (const iface of ifaces) {
      // Descartar interfaces internas (localhost) y MACs vacías
      if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
        // Retornamos la primera MAC real encontrada
        return iface.mac
      }
    }
  }
  return 'UNKNOWN_DEVICE' // Fallback por si no hay tarjeta de red
}

// Función auxiliar para replicar la firma del Python
function generateSignature(type: string, deviceId: string, expiration: string): string {
  const rawString = `${type}|${deviceId}|${expiration}|${SECRET_KEY}`
  // Hash SHA256, tomar los primeros 12 caracteres en mayúsculas
  return crypto.createHash('sha256').update(rawString).digest('hex').substring(0, 12).toUpperCase()
}

export function registerLicenseHandlers() {

  // 1. Obtener el Device ID para mostrarlo en pantalla
  ipcMain.handle('license:get-device-id', () => {
    return getDeviceId()
  })

  // 2. Comprobar el estado actual de la licencia
  ipcMain.handle('license:check', () => {
    if (!db) return { valid: false, error: 'DB_ERROR' }

    try {
      // Buscar la licencia activa más reciente
      const lic = db.prepare('SELECT * FROM licencia WHERE activa = 1 ORDER BY id DESC LIMIT 1').get() as any

      const currentDeviceId = getDeviceId()

      if (!lic) {
        return { valid: false, reason: 'NO_LICENSE', deviceId: currentDeviceId }
      }

      // a) Validar que el Device ID coincida
      if (lic.device_id !== currentDeviceId) {
        return { valid: false, reason: 'DEVICE_MISMATCH', deviceId: currentDeviceId }
      }

      // b) Validar la firma matemática (evita alteraciones manuales en SQLite)
      const expectedSignature = generateSignature(lic.tipo, lic.device_id, lic.expira_en)
      if (expectedSignature !== lic.firma) {
        return { valid: false, reason: 'INVALID_SIGNATURE', deviceId: currentDeviceId }
      }

      // c) Validar la fecha de expiración si no es perpetua
      if (lic.expira_en !== 'PERPETUAL') {
        const expDate = new Date(lic.expira_en)
        const now = new Date()
        
        // Comparamos solo las fechas (ignorando las horas)
        expDate.setHours(23, 59, 59, 999)
        
        if (now > expDate) {
          return { valid: false, reason: 'EXPIRED', deviceId: currentDeviceId }
        }
      }

      // Si pasa todo, la licencia es legítima
      return { 
        valid: true, 
        type: lic.tipo, 
        expires: lic.expira_en 
      }

    } catch (e: any) {
      console.error("Error comprobando licencia:", e)
      return { valid: false, error: e.message }
    }
  })

  // 3. Activar una nueva licencia (Guardar el código del cliente)
  ipcMain.handle('license:activate', (_, { code }) => {
    if (!code) return { success: false, error: 'Por favor ingresa un código válido.' }

    // El formato esperado es TIPO|DEVICE_ID|FECHA|FIRMA
    const parts = code.trim().split('|')
    if (parts.length !== 4) {
      return { success: false, error: 'El formato del código no es válido.' }
    }

    const [tipo, deviceId, expiraEn, firma] = parts
    const currentDeviceId = getDeviceId()

    // Comprobar que el código sea para esta máquina
    if (deviceId !== currentDeviceId) {
      return { success: false, error: 'Este código pertenece a otro equipo.' }
    }

    // Comprobar la criptografía
    const expectedSignature = generateSignature(tipo, deviceId, expiraEn)
    if (expectedSignature !== firma) {
      return { success: false, error: 'La firma del código es incorrecta.' }
    }

    // Si es demo, verificar que no estemos intentando activar un demo que ya caducó en el tiempo
    if (expiraEn !== 'PERPETUAL') {
      const expDate = new Date(expiraEn)
      expDate.setHours(23, 59, 59, 999)
      if (new Date() > expDate) {
        return { success: false, error: 'Este código ya se encuentra caducado.' }
      }
    }

    // Guardar en la base de datos
    try {
      const tx = db.transaction(() => {
        // Desactivar licencias anteriores
        db.prepare('UPDATE licencia SET activa = 0').run()

        // Insertar la nueva
        db.prepare(`
          INSERT INTO licencia (codigo, tipo, device_id, expira_en, firma, activa)
          VALUES (?, ?, ?, ?, ?, 1)
        `).run(code, tipo, deviceId, expiraEn, firma)
      })
      
      tx()
      return { success: true }
    } catch (e: any) {
      // Si tira error de UNIQUE, el código ya fue usado
      if (e.message.includes('UNIQUE')) {
         return { success: false, error: 'Este código de licencia ya está registrado en la base de datos.' }
      }
      return { success: false, error: e.message }
    }
  })

}