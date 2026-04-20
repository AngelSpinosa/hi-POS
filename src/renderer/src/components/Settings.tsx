import { useState, useEffect } from 'react'
import { PinPadModal } from './PinPadModal'

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  // Estado para el modal de Reset
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [resetOptions, setResetOptions] = useState({
    transactions: true,
    catalog: false,
    users: false
  })

  // Estados de Licencia y Seguridad (CU-50 y CU-51)
  const [licenseInfo, setLicenseInfo] = useState<any>(null)
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false)
  const [newLicenseCode, setNewLicenseCode] = useState('')

  // Seguridad
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)

  // Cargar datos de la licencia conectando con el backend de seguridad RSA
  const fetchLicenseInfo = async () => {
    // @ts-ignore
    const deviceId = await window.electron.ipcRenderer.invoke('license:get-device-id');
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('license:check');
    
    setLicenseInfo({
      deviceId,
      valid: res.valid,
      type: res.type || 'Ninguna',
      expires: res.expires || 'N/A',
      remainingDays: res.remainingDays,
      reason: res.reason
    });
  }

  useEffect(() => {
    fetchLicenseInfo()
  }, [])

  // Función que abre el PIN Pad al confirmar el Modal de Reset
  const executeReset = async (pin: string) => {
    // @ts-ignore
    const authRes = await window.electron.ipcRenderer.invoke('verify-pin', { pin })
    
    if (authRes.success && authRes.user.rol === 'admin') {
      setIsPinModalOpen(false);
      // @ts-ignore
      const resetRes = await window.electron.ipcRenderer.invoke('reset-database', resetOptions);
      
      if (resetRes.success) {
        setIsResetModalOpen(false);
        alert('✅ Sistema restablecido con éxito. Volviendo al menú principal.');
        onBack(); 
      } else {
        alert('❌ Ocurrió un error al restablecer: ' + resetRes.error);
      }
    } else {
      alert('⛔ PIN Incorrecto o no cuentas con permisos suficientes.');
    }
  }

  const handleConfirmResetRequest = () => {
    if (!resetOptions.transactions && !resetOptions.catalog && !resetOptions.users) {
      alert("Selecciona al menos una opción para restablecer.");
      return;
    }
    setIsPinModalOpen(true);
  }

  // --- FUNCIONES PARA RESPALDOS (CU-48) ---
  const handleExportBackup = async () => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('export-database');
    if (res.canceled) return;
    if (res.success) {
      alert('✅ Respaldo exportado correctamente. Guarda este archivo en un lugar seguro.');
    } else {
      alert('❌ Ocurrió un error al exportar: ' + res.error);
    }
  }

  const handleImportBackup = async () => {
    const confirmacion = window.confirm(
      '⚠️ ATENCIÓN: Importar un respaldo SOBRESCRIBIRÁ TODA tu información actual (ventas, menús, usuarios) y la reemplazará por la del archivo.\n\n¿Estás completamente seguro de continuar?'
    );
    if (!confirmacion) return;

    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('import-database');
    if (res.canceled) return;
    if (!res.success) {
      alert('❌ Ocurrió un error al importar: ' + res.error);
    }
    // Si es success, el backend reiniciará la app, así que no necesitamos alert()
  }

  // --- FUNCIONES DE LICENCIA (CU-51) ---
  const handleUpdateLicense = async () => {
    if (!newLicenseCode.trim()) {
      alert("Por favor ingresa un código válido.");
      return;
    }
    
    // Llamada al endpoint de tu módulo de criptografía
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('license:activate', { code: newLicenseCode });
    
    if (res.success) {
      alert("✅ Licencia validada y activada correctamente.");
      setIsLicenseModalOpen(false);
      setNewLicenseCode('');
      fetchLicenseInfo(); // Recargar los datos visuales
    } else {
      alert("❌ Error: " + res.error);
    }
  }
  // ----------------------------------------------

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#111', color: 'white', fontFamily: 'sans-serif' }}>
      {/* HEADER */}
      <div style={{ padding: '20px 30px', display: 'flex', alignItems: 'center', background: '#1a1a1a', borderBottom: '1px solid #333' }}>
        <button onClick={onBack} style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', marginRight: '30px' }}>
          ← Volver al Menú
        </button>
        <h2 style={{ margin: 0, color: '#3b82f6', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          CONFIGURACIÓN DEL SISTEMA ⚙️
        </h2>
      </div>

      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>

          {/* SECCIÓN 1: IMPRESIÓN */}
          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ color: '#f97316', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
              Impresión y Tickets
            </h3>
            <div style={{ background: '#1a1a1a', border: '1px dashed #404040', borderRadius: '10px', padding: '20px', color: '#9ca3af' }}>
              🖨️ Configuraciones de impresora térmica, logo del negocio y mensaje al pie del ticket se agregarán aquí en la versión Post-MVP.
            </div>
          </div>

          {/* SECCIÓN 2: BASE DE DATOS */}
          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ color: '#f97316', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
              Base de Datos
            </h3>
            <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '25px' }}>
              <div style={{ color: '#d1d5db', marginBottom: '20px' }}>
                💾 Opciones para respaldar la información (Backup), limpiar el historial de ventas antiguas y restablecer de fábrica.
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <button 
                  onClick={handleExportBackup}
                  style={{ padding: '10px 20px', background: '#262626', color: '#10b981', border: '1px solid #10b981', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = 'black'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#262626'; e.currentTarget.style.color = '#10b981'; }}
                >
                  Exportar Respaldo (.db)
                </button>
                <button 
                  onClick={handleImportBackup}
                  style={{ padding: '10px 20px', background: '#262626', color: '#eab308', border: '1px solid #eab308', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#eab308'; e.currentTarget.style.color = 'black'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#262626'; e.currentTarget.style.color = '#eab308'; }}
                >
                  Importar Respaldo
                </button>
                
                {/* BOTÓN REPARADO */}
                <button 
                  onClick={() => setIsResetModalOpen(true)}
                  style={{ padding: '10px 20px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginLeft: 'auto' }}
                >
                  Restablecer de Fábrica ⚠️
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: LICENCIA */}
          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ color: '#f97316', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
              Licencia y Sistema
            </h3>
            <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '25px' }}>
              
              {licenseInfo ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                  
                  {/* Tarjeta: Device ID */}
                  <div style={{ background: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #404040' }}>
                    <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '8px' }}>DEVICE ID (Identificador Físico MAC)</div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <code style={{ color: '#3b82f6', fontSize: '1rem', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={licenseInfo.deviceId}>
                        {licenseInfo.deviceId}
                      </code>
                      <button 
                        onClick={() => { navigator.clipboard.writeText(licenseInfo.deviceId); alert('¡ID Copiado al portapapeles!'); }} 
                        style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                      >
                        Copiar
                      </button>
                    </div>
                  </div>

                  {/* Tarjeta: Estado */}
                  <div style={{ 
                    background: '#111', padding: '15px', borderRadius: '8px', 
                    border: licenseInfo.valid ? (licenseInfo.remainingDays <= 5 ? '1px solid #eab308' : '1px solid #10b981') : '1px solid #ef4444' 
                  }}>
                    <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '8px' }}>ESTADO DE LICENCIA</div>
                    <div style={{ 
                      fontSize: '1.2rem', fontWeight: 'bold',
                      color: licenseInfo.valid ? (licenseInfo.remainingDays <= 5 ? '#eab308' : '#10b981') : '#ef4444'
                    }}>
                      {licenseInfo.valid ? licenseInfo.type.toUpperCase() : 'INVÁLIDA / EXPIRADA'}
                    </div>
                    <div style={{ color: '#d1d5db', fontSize: '0.9rem', marginTop: '5px' }}>
                      {licenseInfo.valid ? (
                        licenseInfo.expires === 'PERPETUAL' 
                          ? 'Expira: Nunca' 
                          : `Expira: ${licenseInfo.expires} (Quedan ${licenseInfo.remainingDays} días)`
                      ) : (
                        <span style={{color: '#ef4444'}}>Motivo: {licenseInfo.reason || 'NO_LICENSE'}</span>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div style={{ color: '#9ca3af', marginBottom: '20px' }}>Cargando información de licencia...</div>
              )}
              
              <button 
                onClick={() => setIsLicenseModalOpen(true)}
                style={{ padding: '12px 25px', background: 'transparent', color: '#f97316', border: '1px solid #f97316', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f97316'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#f97316'; }}
              >
                🔑 RENOVAR / CAMBIAR LICENCIA
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* MODAL DE LICENCIA (CU-51) */}
      {isLicenseModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a1a1a', padding: '35px', borderRadius: '15px', width: '550px', color: 'white', border: '1px solid #404040', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '1.5rem', color: '#f97316' }}>🔑 Activar Licencia</h2>
            <p style={{ color: '#d1d5db', marginBottom: '25px', lineHeight: '1.5', fontSize: '0.9rem' }}>
              Ingresa el código proporcionado por tu distribuidor. El sistema validará la firma digital criptográfica con tu dirección MAC.
            </p>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', color: '#9ca3af', marginBottom: '8px', fontWeight: 'bold' }}>Código de Activación (Base64 / RSA)</label>
              <input 
                type="text" 
                value={newLicenseCode}
                onChange={e => setNewLicenseCode(e.target.value)} 
                placeholder="TIPO|MAC|FECHA|FIRMA_BASE64..."
                style={{ width: '100%', padding: '15px', background: '#111', border: '1px solid #404040', color: '#3b82f6', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.5px' }}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => setIsLicenseModalOpen(false)} style={{ flex: 1, padding: '14px', background: '#333', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleUpdateLicense} style={{ flex: 1, padding: '14px', background: '#f97316', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Verificar y Activar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RESTABLECIMIENTO (CU-47) */}
      {isResetModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a1a1a', padding: '35px', borderRadius: '15px', width: '500px', color: 'white', border: '1px solid #404040', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '1.5rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '10px' }}>
              ⚠️ Restablecer Sistema
            </h2>
            <p style={{ color: '#d1d5db', marginBottom: '25px', lineHeight: '1.5' }}>
              Selecciona qué datos deseas eliminar de forma permanente. Esta acción <strong>NO se puede deshacer</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', background: '#262626', padding: '15px', borderRadius: '8px', border: resetOptions.transactions ? '1px solid #ef4444' : '1px solid #404040' }}>
                <input 
                  type="checkbox" 
                  checked={resetOptions.transactions} 
                  onChange={(e) => setResetOptions({...resetOptions, transactions: e.target.checked})}
                  style={{ marginTop: '4px', transform: 'scale(1.2)' }}
                />
                <div>
                  <div style={{ fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>Transacciones y Ventas (Caja en $0)</div>
                  <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Borra todas las órdenes, pagos, tickets y reportes. <strong>El stock de inventario regresará a CERO para forzar un nuevo conteo inicial.</strong></div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', background: '#262626', padding: '15px', borderRadius: '8px', border: resetOptions.catalog ? '1px solid #ef4444' : '1px solid #404040' }}>
                <input 
                  type="checkbox" 
                  checked={resetOptions.catalog} 
                  onChange={(e) => setResetOptions({...resetOptions, catalog: e.target.checked})}
                  style={{ marginTop: '4px', transform: 'scale(1.2)' }}
                />
                <div>
                  <div style={{ fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>Catálogo y Menú</div>
                  <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Borra todos los platillos, insumos y recetas guardadas.</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', background: '#262626', padding: '15px', borderRadius: '8px', border: resetOptions.users ? '1px solid #ef4444' : '1px solid #404040' }}>
                <input 
                  type="checkbox" 
                  checked={resetOptions.users} 
                  onChange={(e) => setResetOptions({...resetOptions, users: e.target.checked})}
                  style={{ marginTop: '4px', transform: 'scale(1.2)' }}
                />
                <div>
                  <div style={{ fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>Personal y Usuarios</div>
                  <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Borra a todos los meseros y cajeros (se conservará al Administrador Principal para no bloquear el sistema).</div>
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => setIsResetModalOpen(false)} style={{ flex: 1, padding: '14px', background: '#333', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleConfirmResetRequest} style={{ flex: 1, padding: '14px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Eliminar Datos Seleccionados</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SEGURIDAD (PIN) */}
      <PinPadModal 
        title="Autorizar Acción 🛡️" 
        isOpen={isPinModalOpen} 
        onClose={() => setIsPinModalOpen(false)} 
        onVerify={executeReset} 
      />
    </div>
  )
}