import { ipcMain } from 'electron'
import { db } from '../database'
import * as crypto from 'crypto'
import * as os from 'os'

// ✅ SEGURIDAD NIVEL 2: CRIPTOGRAFÍA ASIMÉTRICA (RSA)
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsl3gFJNZs+9p7B4krtfH
OXjVA3Acptl5gAdmAV2XLipOufrWJK1l+48p2uaYjZeplI+aHukxhP0PMPwQdxE2
ulfWhwd4J7UEQL2IQybfPLCWtU/UAymgnI708Az5FOEOXxRuzEJAllNwn6wVEF7q
M6H79CgAIxJ1NxOkS1TmT2hOC5SMZGUDpE9t3Ih6ydyx6sbC+8GLo576KfNGZloD
IxIMaKm5kLKj6lqPFdcpv0PKzVQsGgKftayPlJ9tVpCgySpJaN6FQeRKy8H8w0Uy
FTr6m6qL12Tn1SV6UUIimGVmu2Ns/4M3O8eKQwa2fUYwjbYyeLIjj6Uk3EO/QjsD
XQIDAQAB
-----END PUBLIC KEY-----
`

// Función auxiliar para obtener la Dirección MAC (Device ID)
function getDeviceId(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    const ifaces = interfaces[name]
    if (!ifaces) continue

    for (const iface of ifaces) {
      if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
        return iface.mac
      }
    }
  }
  return 'UNKNOWN_DEVICE' 
}

// Función auxiliar para verificar la firma RSA
function verifySignature(type: string, deviceId: string, expiration: string, signatureBase64: string): boolean {
  try {
    const rawString = `${type}|${deviceId}|${expiration}`
    const verify = crypto.createVerify('SHA256')
    verify.update(rawString)
    verify.end()
    return verify.verify(PUBLIC_KEY, signatureBase64, 'base64')
  } catch (error) {
    console.error("Error criptográfico verificando firma:", error)
    return false
  }
}

export function registerLicenseHandlers() {

  ipcMain.handle('license:get-device-id', () => {
    return getDeviceId()
  })

  ipcMain.handle('license:check', () => {
    if (!db) return { valid: false, error: 'DB_ERROR' }

    try {
      // 🛡️ ANTI-FRAUDE PASO 1: Crear tabla oculta si no existe
      db.prepare('CREATE TABLE IF NOT EXISTS security_config (id TEXT PRIMARY KEY, value TEXT)').run()

      const lic = db.prepare('SELECT * FROM licencia WHERE activa = 1 ORDER BY id DESC LIMIT 1').get() as any
      const currentDeviceId = getDeviceId()

      if (!lic) {
        return { valid: false, reason: 'NO_LICENSE', deviceId: currentDeviceId }
      }

      // a) Validar que el Device ID coincida
      if (lic.device_id !== currentDeviceId) {
        return { valid: false, reason: 'DEVICE_MISMATCH', deviceId: currentDeviceId }
      }

      // b) Validar la firma matemática asimétrica
      const isSignatureValid = verifySignature(lic.tipo, lic.device_id, lic.expira_en, lic.firma)
      if (!isSignatureValid) {
        return { valid: false, reason: 'INVALID_SIGNATURE', deviceId: currentDeviceId }
      }

      // 🛡️ ANTI-FRAUDE PASO 2: Verificar alteración del reloj (Time Tampering)
      const now = new Date()
      const currentTimeMs = now.getTime()

      // CORRECCIÓN: Usar parámetro ? para evitar error de comillas en SQL
      const lastTimeRow = db.prepare('SELECT value FROM security_config WHERE id = ?').get('last_valid_time') as any
      if (lastTimeRow) {
        const lastTimeMs = parseInt(lastTimeRow.value, 10)
        // Si el tiempo actual es menor al último registrado (damos 5 segundos de tolerancia por sincronizaciones de Windows)
        if (currentTimeMs < (lastTimeMs - 5000)) {
          return { valid: false, reason: 'TIME_TAMPERING', deviceId: currentDeviceId }
        }
      }

      // c) Validar la fecha de expiración si no es perpetua
      let remainingDays: number | undefined = undefined;

      if (lic.expira_en !== 'PERPETUAL') {
        const expDate = new Date(lic.expira_en)
        
        // Comparamos ignorando las horas
        expDate.setHours(23, 59, 59, 999)
        
        if (now > expDate) {
          return { valid: false, reason: 'EXPIRED', deviceId: currentDeviceId }
        }

        // Calcular Días Restantes exactos
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        const expMidnight = new Date(lic.expira_en);
        expMidnight.setHours(0, 0, 0, 0);
        
        const diffTime = expMidnight.getTime() - todayMidnight.getTime();
        remainingDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      }

      // 🛡️ ANTI-FRAUDE PASO 3: El tiempo es legal, guardar este nuevo momento en la historia
      // CORRECCIÓN: Usar parámetros ? para ambos valores
      db.prepare('INSERT OR REPLACE INTO security_config (id, value) VALUES (?, ?)').run('last_valid_time', currentTimeMs.toString())

      return { 
        valid: true, 
        type: lic.tipo, 
        expires: lic.expira_en,
        remainingDays: remainingDays
      }

    } catch (e: any) {
      console.error("Error comprobando licencia:", e)
      return { valid: false, error: e.message }
    }
  })

  ipcMain.handle('license:activate', (_, { code }) => {
    if (!code) return { success: false, error: 'Por favor ingresa un código válido.' }

    const parts = code.trim().split('|')
    if (parts.length !== 4) return { success: false, error: 'El formato del código no es válido.' }

    const [tipo, deviceId, expiraEn, firma] = parts
    const currentDeviceId = getDeviceId()

    if (deviceId !== currentDeviceId) return { success: false, error: 'Este código pertenece a otro equipo.' }

    const isSignatureValid = verifySignature(tipo, deviceId, expiraEn, firma)
    if (!isSignatureValid) return { success: false, error: 'La firma de la licencia es incorrecta o ha sido alterada.' }

    if (expiraEn !== 'PERPETUAL') {
      const expDate = new Date(expiraEn)
      expDate.setHours(23, 59, 59, 999)
      if (new Date() > expDate) {
        return { success: false, error: 'Este código ya se encuentra caducado.' }
      }
    }

    try {
      const tx = db.transaction(() => {
        db.prepare('UPDATE licencia SET activa = 0').run()
        db.prepare(`
          INSERT INTO licencia (codigo, tipo, device_id, expira_en, firma, activa)
          VALUES (?, ?, ?, ?, ?, 1)
        `).run(code, tipo, deviceId, expiraEn, firma)
        
        // 🛡️ NUEVO: "Perdonar" la alteración de tiempo al activar una licencia exitosamente.
        // CORRECCIÓN: Usar parámetro ? para evitar error de comillas
        db.prepare('DELETE FROM security_config WHERE id = ?').run('last_valid_time')
      })
      tx()
      return { success: true }
    } catch (e: any) {
      if (e.message.includes('UNIQUE')) return { success: false, error: 'Este código ya está registrado.' }
      return { success: false, error: e.message }
    }
  })
}