import { useState, useEffect } from 'react'

interface LicenseScreenProps {
  onLicenseActivated: () => void;
  reason?: string;
}

export function LicenseScreen({ onLicenseActivated, reason }: LicenseScreenProps) {
  const [deviceId, setDeviceId] = useState<string>('Cargando...')
  const [licenseCode, setLicenseCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // 1. Obtener el Device ID al montar la pantalla
  useEffect(() => {
    const fetchDeviceId = async () => {
      try {
        // @ts-ignore
        const id = await window.electron.ipcRenderer.invoke('license:get-device-id')
        setDeviceId(id || 'ERROR_OBTENIENDO_ID')
      } catch (err) {
        setDeviceId('ERROR_CONEXION')
      }
    }
    fetchDeviceId()
  }, [])

  // 2. Manejar el botón de activar
  const handleActivate = async () => {
    if (!licenseCode.trim()) {
      setErrorMsg('Por favor ingresa un código de licencia.')
      return
    }

    setIsLoading(true)
    setErrorMsg('')

    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('license:activate', { code: licenseCode.trim() })
      
      if (result.success) {
        alert('✅ ¡Licencia activada con éxito!')
        onLicenseActivated() // Le avisa a App.tsx que ya puede entrar
      } else {
        setErrorMsg(result.error || 'Código de licencia inválido.')
      }
    } catch (err) {
      setErrorMsg('Error de conexión al activar licencia.')
    } finally {
      setIsLoading(false)
    }
  }

  // Traducción amigable del motivo de bloqueo
  const getReasonMessage = () => {
    if (reason === 'NO_LICENSE') return 'No se detectó una licencia activa en este sistema.'
    if (reason === 'EXPIRED') return 'Tu licencia o periodo de prueba ha expirado.'
    if (reason === 'DEVICE_MISMATCH') return 'Esta licencia pertenece a otro equipo.'
    if (reason === 'INVALID_SIGNATURE') return 'La firma de la licencia es inválida o ha sido alterada.'
    return 'Activación de Software Requerida'
  }

  return (
    <div style={{ height: '100vh', display: 'flex', backgroundColor: '#111', color: 'white', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      
      <div style={{ backgroundColor: '#1a1a1a', padding: '40px', borderRadius: '15px', width: '500px', border: '1px solid #333', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ margin: '0 0 10px 0', color: '#f97316', fontSize: '2rem' }}>POS PIZZA 🍕</h1>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>Activación de Licencia</h2>
          <p style={{ color: '#ef4444', marginTop: '10px', fontWeight: 'bold' }}>{getReasonMessage()}</p>
        </div>

        {/* Instrucciones y Device ID */}
        <div style={{ backgroundColor: '#262626', padding: '20px', borderRadius: '10px', marginBottom: '25px', border: '1px solid #404040' }}>
          <p style={{ margin: '0 0 10px 0', color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center' }}>
            Para obtener tu código de activación, por favor envía el siguiente <strong>ID de Dispositivo</strong> a tu proveedor:
          </p>
          <div style={{ backgroundColor: '#000', padding: '15px', borderRadius: '8px', textAlign: 'center', fontSize: '1.5rem', fontFamily: 'monospace', color: '#22c55e', letterSpacing: '2px', userSelect: 'all' }}>
            {deviceId}
          </div>
        </div>

        {/* Input para el Código */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold' }}>Ingresa tu Código de Activación:</label>
          <input 
            type="text" 
            value={licenseCode}
            onChange={(e) => setLicenseCode(e.target.value)}
            placeholder="Ej. DEMO|00:11:22...|2024-12-31|FIRMA"
            style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #404040', background: '#111', color: 'white', fontSize: '1rem', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Mensaje de Error */}
        {errorMsg && (
          <div style={{ color: '#ef4444', backgroundColor: '#450a0a', padding: '10px', borderRadius: '5px', marginBottom: '20px', textAlign: 'center', fontSize: '0.9rem', border: '1px solid #991b1b' }}>
            {errorMsg}
          </div>
        )}

        {/* Botón de Activación */}
        <button 
          onClick={handleActivate}
          disabled={isLoading || !licenseCode}
          style={{ width: '100%', padding: '15px', backgroundColor: (isLoading || !licenseCode) ? '#404040' : '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: (isLoading || !licenseCode) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}
        >
          {isLoading ? 'Validando...' : 'ACTIVAR SOFTWARE'}
        </button>

      </div>

    </div>
  )
}