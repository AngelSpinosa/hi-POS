import { useState, useEffect } from 'react'

interface LicenseScreenProps {
  onLicenseActivated: () => void;
  reason?: string;
  onViewReports?: () => void;
}

export function LicenseScreen({ onLicenseActivated, reason, onViewReports }: LicenseScreenProps) {
  const [deviceId, setDeviceId] = useState<string>('Cargando...')
  const [licenseCode, setLicenseCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)

  // Detectamos si el usuario intentó hacer trampa con el reloj
  const isTimeTampering = reason === 'TIME_TAMPERING'

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
        onLicenseActivated() 
      } else {
        setErrorMsg(result.error || 'Código de licencia inválido.')
      }
    } catch (err) {
      setErrorMsg('Error de conexión al activar licencia.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = () => {
    if (deviceId && deviceId !== 'Cargando...' && deviceId !== 'ERROR_CONEXION') {
      navigator.clipboard.writeText(deviceId).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000) 
      }).catch(err => {
        console.error('Error al copiar:', err)
      })
    }
  }

  const getReasonMessage = () => {
    if (reason === 'NO_LICENSE') return 'No se detectó una licencia activa en este sistema.'
    if (reason === 'EXPIRED') return 'Tu licencia o periodo de prueba ha expirado.'
    if (reason === 'DEVICE_MISMATCH') return 'Esta licencia pertenece a otro equipo.'
    if (reason === 'INVALID_SIGNATURE') return 'La firma de la licencia es inválida o ha sido alterada.'
    
    // NUEVO: Mensaje de castigo para los que modifican la fecha
    if (isTimeTampering) return '⏳ ALTERACIÓN DE RELOJ DETECTADA ⏳'
    
    return 'Activación de Software Requerida'
  }

  return (
    <div style={{ height: '100vh', display: 'flex', backgroundColor: '#111', color: 'white', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      
      <div style={{ 
        backgroundColor: '#1a1a1a', 
        padding: '40px', 
        borderRadius: '15px', 
        width: '550px', 
        // EFECTO VISUAL DE CASTIGO: Borde y sombra roja si hizo trampa
        border: isTimeTampering ? '2px solid #ef4444' : '1px solid #333', 
        boxShadow: isTimeTampering ? '0 0 30px rgba(239, 68, 68, 0.4)' : '0 10px 25px rgba(0,0,0,0.5)',
        transition: 'all 0.3s ease'
      }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ margin: '0 0 10px 0', color: '#f97316', fontSize: '2rem' }}>POS PIZZA 🍕</h1>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>Activación de Licencia</h2>
          
          <p style={{ color: '#ef4444', marginTop: '10px', fontWeight: 'bold', fontSize: isTimeTampering ? '1.1rem' : '1rem' }}>
            {getReasonMessage()}
          </p>
          
          {/* Subtítulo explicativo del castigo */}
          {isTimeTampering && (
            <p style={{ color: '#fca5a5', fontSize: '0.9rem', marginTop: '5px', backgroundColor: '#450a0a', padding: '10px', borderRadius: '5px' }}>
              El sistema se ha bloqueado por seguridad. Para recuperar el acceso, <strong>restaure la fecha y hora real</strong> de su computadora.
            </p>
          )}
        </div>

        {/* Instrucciones y Device ID */}
        <div style={{ backgroundColor: '#262626', padding: '20px', borderRadius: '10px', marginBottom: '25px', border: '1px solid #404040' }}>
          <p style={{ margin: '0 0 10px 0', color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center' }}>
            Para obtener tu código de activación, envía el siguiente <strong>ID de Dispositivo</strong> a tu proveedor:
          </p>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ flex: 1, backgroundColor: '#000', padding: '15px', borderRadius: '8px', textAlign: 'center', fontSize: '1.5rem', fontFamily: 'monospace', color: '#22c55e', letterSpacing: '2px', userSelect: 'all' }}>
              {deviceId}
            </div>
            
            <button 
              onClick={handleCopy}
              style={{ padding: '15px', backgroundColor: copied ? '#3b82f6' : '#4b5563', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'background-color 0.2s', minWidth: '100px' }}
            >
              {copied ? '¡Copiado! ✓' : 'Copiar 📋'}
            </button>
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

        {errorMsg && (
          <div style={{ color: '#ef4444', backgroundColor: '#450a0a', padding: '10px', borderRadius: '5px', marginBottom: '20px', textAlign: 'center', fontSize: '0.9rem', border: '1px solid #991b1b' }}>
            {errorMsg}
          </div>
        )}

        <button 
          onClick={handleActivate}
          disabled={isLoading || !licenseCode}
          style={{ width: '100%', padding: '15px', backgroundColor: (isLoading || !licenseCode) ? '#404040' : '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: (isLoading || !licenseCode) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}
        >
          {isLoading ? 'Validando...' : 'ACTIVAR SOFTWARE'}
        </button>

        {/* Botón para ver reportes en solo lectura */}
        {onViewReports && (
          <button 
            onClick={onViewReports}
            style={{ width: '100%', padding: '12px', marginTop: '15px', backgroundColor: 'transparent', color: '#9ca3af', border: '1px solid #404040', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Ver Historial de Ventas (Solo Lectura) 📊
          </button>
        )}

      </div>
    </div>
  )
}