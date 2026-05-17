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
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      backgroundColor: 'var(--color-bg-main, #121212)', 
      color: 'white', 
      alignItems: 'center', 
      justifyContent: 'center', 
      fontFamily: 'var(--font-heading, monospace)' 
    }}>
      
      <div style={{ 
        backgroundColor: '#161616', 
        padding: '50px 40px', 
        borderRadius: '16px', 
        width: '560px', 
        border: isTimeTampering ? '2px solid #ef4444' : '1px solid #333', 
        boxShadow: isTimeTampering ? '0 0 30px rgba(239, 68, 68, 0.4)' : '0 10px 25px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '25px',
        boxSizing: 'border-box'
      }}>
        
        {/* Header (Títulos y Razón) */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 10px 0', color: '#ffffff', fontSize: '2.5rem', fontWeight: 'bold' }}>
            Hi-POS
          </h1>
          <h2 style={{ margin: '0 0 15px 0', color: '#ffffff', fontSize: '1.2rem', fontWeight: 'normal' }}>
            Activación de licencia
          </h2>
          
          <p style={{ color: '#ef4444', margin: 0, fontWeight: 'bold', fontSize: '1rem' }}>
            {getReasonMessage()}
          </p>
          
          {isTimeTampering && (
            <p style={{ color: '#fca5a5', fontSize: '0.9rem', marginTop: '15px', backgroundColor: '#450a0a', padding: '10px', borderRadius: '5px' }}>
              El sistema se ha bloqueado por seguridad. Para recuperar el acceso, <strong>restaure la fecha y hora real</strong> de su computadora.
            </p>
          )}
        </div>

        {/* Sección 1: Instrucciones y Device ID */}
        <div style={{ 
          border: '1px solid #ffffff', 
          padding: '20px', 
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px'
        }}>
          <p style={{ margin: 0, color: '#d1d5db', fontSize: '0.85rem', textAlign: 'center', lineHeight: '1.4' }}>
            Para obtener tu código de activación, envía el siguiente ID<br/>de dispositivo a tu proveedor:
          </p>
          
          <div style={{ display: 'flex', gap: '15px', alignItems: 'stretch', justifyContent: 'center' }}>
            <div style={{ 
              flex: 1, 
              backgroundColor: '#000000', 
              padding: '12px 15px', 
              borderRadius: '6px', 
              border: '1px solid #00d044',
              color: '#ff0000', 
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis'
            }}>
              {deviceId}
            </div>
            
            <button 
              onClick={handleCopy}
              style={{ 
                padding: '0 15px', 
                backgroundColor: '#000000', 
                color: '#ffffff', 
                border: '1px solid #00d044', 
                borderRadius: '6px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.85rem',
                transition: 'background-color 0.2s'
              }}
            >
              {copied ? 'Copiado' : 'Copiar'}
              {!copied && (
                <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9.5 2H10.5C11.6046 2 12.5 2.89543 12.5 4V13C12.5 14.1046 11.6046 15 10.5 15H3.5C2.39543 15 1.5 14.1046 1.5 13V4C1.5 2.89543 2.39543 2 3.5 2H4.5M9.5 2C9.5 3.10457 8.60457 4 7.5 4C6.39543 4 5.5 3.10457 5.5 2M9.5 2C9.5 0.89543 8.60457 0 7.5 0C6.39543 0 5.5 0.89543 5.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Sección 2: Input para el Código de Activación */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ color: '#d1d5db', fontSize: '0.85rem' }}>Ingresa tu código de activación:</label>
          <input 
            type="text" 
            value={licenseCode}
            onChange={(e) => setLicenseCode(e.target.value)}
            placeholder="Ej. DEMO|00:11:22...|2024-12-31|FIRMA"
            style={{ 
              width: '100%', 
              padding: '14px 15px', 
              borderRadius: '6px', 
              border: '1px solid #555555', 
              background: '#111111', 
              color: 'white', 
              fontSize: '0.9rem', 
              fontFamily: 'inherit', 
              outline: 'none', 
              boxSizing: 'border-box' 
            }}
          />
        </div>

        {errorMsg && (
          <div style={{ color: '#ef4444', textAlign: 'center', fontSize: '0.9rem', marginTop: '-10px' }}>
            {errorMsg}
          </div>
        )}

        {/* Sección 3: Botones de Acción */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
          <button 
            onClick={handleActivate}
            disabled={isLoading || !licenseCode}
            style={{ 
              width: '100%', 
              padding: '14px', 
              backgroundColor: (isLoading || !licenseCode) ? '#1a5c32' : '#00E676', 
              color: '#ffffff', 
              border: 'none', 
              borderRadius: '6px', 
              fontSize: '1rem', 
              fontWeight: 'bold', 
              cursor: (isLoading || !licenseCode) ? 'not-allowed' : 'pointer', 
              fontFamily: 'inherit',
              transition: 'filter 0.2s',
              textTransform: 'uppercase'
            }}
          >
            {isLoading ? 'Validando...' : 'ACTIVAR SOFTWARE'}
          </button>

          {onViewReports && (
            <button 
              onClick={onViewReports}
              style={{ 
                width: '100%', 
                padding: '12px', 
                backgroundColor: 'transparent', 
                color: '#ffffff', 
                border: '1px solid #ffffff', 
                borderRadius: '6px', 
                fontSize: '0.85rem', 
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              Ver Historial de ventas (Solo Lectura)
            </button>
          )}
        </div>

      </div>
    </div>
  )
}