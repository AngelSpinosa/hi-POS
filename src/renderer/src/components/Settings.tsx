import { useState, useEffect } from 'react'
import { PinPadModal } from './PinPadModal'

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [resetOptions, setResetOptions] = useState({
    transactions: true,
    catalog: false,
    users: false
  })

  // Licencia
  const [licenseInfo, setLicenseInfo] = useState<any>(null)
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false)
  const [newLicenseCode, setNewLicenseCode] = useState('')

  // Identidad Visual
  const [businessName, setBusinessName] = useState('')
  const [colorPrimary, setColorPrimary] = useState('#f97316')
  const [colorSecondary, setColorSecondary] = useState('#3b82f6')
  const [logoBase64, setLogoBase64] = useState<string | null>(null)

  // Mesas
  const [activeTablesCount, setActiveTablesCount] = useState(0)

  // Seguridad
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)

  const fetchLicenseInfo = async () => {
    // @ts-ignore
    const deviceId = await window.electron.ipcRenderer.invoke('license:get-device-id');
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('license:check');
    setLicenseInfo({
      deviceId, valid: res.valid, type: res.type || 'Ninguna', expires: res.expires || 'N/A', remainingDays: res.remainingDays, reason: res.reason
    });
  }

  const fetchConfig = async () => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('get-app-config');
    if (res.success && res.data) {
      setBusinessName(res.data.business_name || ''); setColorPrimary(res.data.color_primary || '#f97316'); setColorSecondary(res.data.color_secondary || '#3b82f6'); setLogoBase64(res.data.logo_path || null);
    }
  }

  const fetchTablesCount = async () => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('get-tables');
    if (Array.isArray(res)) setActiveTablesCount(res.length);
  }

  useEffect(() => {
    fetchLicenseInfo()
    fetchConfig() 
    fetchTablesCount()
  }, [])

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
      } else { alert('❌ Ocurrió un error al restablecer: ' + resetRes.error); }
    } else { alert('⛔ PIN Incorrecto o no cuentas con permisos suficientes.'); }
  }

  const handleConfirmResetRequest = () => {
    if (!resetOptions.transactions && !resetOptions.catalog && !resetOptions.users) {
      alert("Selecciona al menos una opción para restablecer."); return;
    }
    setIsPinModalOpen(true);
  }

  const handleExportBackup = async () => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('export-database');
    if (res.canceled) return;
    if (res.success) alert('✅ Respaldo exportado correctamente. Guarda este archivo en un lugar seguro.');
    else alert('❌ Ocurrió un error al exportar: ' + res.error);
  }

  const handleImportBackup = async () => {
    const confirmacion = window.confirm('⚠️ ATENCIÓN: Importar un respaldo SOBRESCRIBIRÁ TODA tu información actual.\n\n¿Estás completamente seguro de continuar?');
    if (!confirmacion) return;
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('import-database');
    if (res.canceled) return;
    if (!res.success) alert('❌ Ocurrió un error al importar: ' + res.error);
  }

  const handleUpdateLicense = async () => {
    if (!newLicenseCode.trim()) { alert("Por favor ingresa un código válido."); return; }
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('license:activate', { code: newLicenseCode });
    if (res.success) {
      alert("✅ Licencia validada y activada correctamente."); setIsLicenseModalOpen(false); setNewLicenseCode(''); fetchLicenseInfo(); 
    } else { alert("❌ Error: " + res.error); }
  }

  const handleSelectLogo = async () => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('select-logo');
    if (res.success) setLogoBase64(res.logoData);
    else if (!res.canceled) alert('Error al cargar logo: ' + res.error);
  }

  const handleSaveIdentity = async () => {
    const payload = { business_name: businessName, color_primary: colorPrimary, color_secondary: colorSecondary, logo_path: logoBase64 }
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('update-app-config', payload);
    if (res.success) {
      document.documentElement.style.setProperty('--color-primary', colorPrimary);
      document.documentElement.style.setProperty('--color-secondary', colorSecondary);
      alert('✅ Identidad visual actualizada. Los cambios ya se reflejaron en el sistema.');
    } else { alert('❌ Error al guardar la configuración: ' + res.error); }
  }

  // --- FUNCIONES DE MESAS ---
  const handleAddTable = async () => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('add-table');
    if (res.success) setActiveTablesCount(prev => prev + 1);
    else alert('❌ Error: ' + res.error);
  }

  const handleRemoveTable = async () => {
    if (activeTablesCount <= 1) {
      alert('⚠️ No puedes eliminar todas las mesas. Debes tener al menos 1.'); return;
    }
    if (confirm('¿Estás seguro de eliminar la última mesa del sistema?')) {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('remove-last-table');
      if (res.success) setActiveTablesCount(prev => prev - 1);
      else alert('❌ No se pudo eliminar: ' + res.error);
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#111', color: 'white', fontFamily: 'sans-serif' }}>
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

          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ color: '#f97316', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
              Impresión y Tickets
            </h3>
            <div style={{ background: '#1a1a1a', border: '1px dashed #404040', borderRadius: '10px', padding: '20px', color: '#9ca3af' }}>
              🖨️ Configuraciones de impresora térmica, logo del negocio y mensaje al pie del ticket se agregarán aquí en la versión Post-MVP.
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ color: '#f97316', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
              Base de Datos
            </h3>
            <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '25px' }}>
              <div style={{ color: '#d1d5db', marginBottom: '20px' }}>💾 Opciones para respaldar la información (Backup), limpiar el historial de ventas y restablecer de fábrica.</div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={handleExportBackup} style={{ padding: '10px 20px', background: '#262626', color: '#10b981', border: '1px solid #10b981', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Exportar Respaldo (.db)</button>
                <button onClick={handleImportBackup} style={{ padding: '10px 20px', background: '#262626', color: '#eab308', border: '1px solid #eab308', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Importar Respaldo</button>
                <button onClick={() => setIsResetModalOpen(true)} style={{ padding: '10px 20px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginLeft: 'auto' }}>Restablecer de Fábrica ⚠️</button>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ color: '#f97316', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
              Licencia y Sistema
            </h3>
            <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '25px' }}>
              {licenseInfo ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                  <div style={{ background: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #404040' }}>
                    <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '8px' }}>DEVICE ID (Identificador Físico MAC)</div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <code style={{ color: '#3b82f6', fontSize: '1rem', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={licenseInfo.deviceId}>{licenseInfo.deviceId}</code>
                      <button onClick={() => { navigator.clipboard.writeText(licenseInfo.deviceId); alert('¡ID Copiado al portapapeles!'); }} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Copiar</button>
                    </div>
                  </div>
                  <div style={{ background: '#111', padding: '15px', borderRadius: '8px', border: licenseInfo.valid ? (licenseInfo.remainingDays <= 5 ? '1px solid #eab308' : '1px solid #10b981') : '1px solid #ef4444' }}>
                    <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '8px' }}>ESTADO DE LICENCIA</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: licenseInfo.valid ? (licenseInfo.remainingDays <= 5 ? '#eab308' : '#10b981') : '#ef4444' }}>{licenseInfo.valid ? licenseInfo.type.toUpperCase() : 'INVÁLIDA / EXPIRADA'}</div>
                    <div style={{ color: '#d1d5db', fontSize: '0.9rem', marginTop: '5px' }}>{licenseInfo.valid ? (licenseInfo.expires === 'PERPETUAL' ? 'Expira: Nunca' : `Expira: ${licenseInfo.expires} (Quedan ${licenseInfo.remainingDays} días)`) : (<span style={{color: '#ef4444'}}>Motivo: {licenseInfo.reason || 'NO_LICENSE'}</span>)}</div>
                  </div>
                </div>
              ) : (<div style={{ color: '#9ca3af', marginBottom: '20px' }}>Cargando información de licencia...</div>)}
              <button onClick={() => setIsLicenseModalOpen(true)} style={{ padding: '12px 25px', background: 'transparent', color: '#f97316', border: '1px solid #f97316', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%', transition: 'all 0.2s' }}>🔑 RENOVAR / CAMBIAR LICENCIA</button>
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ color: '#f97316', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>Identidad Visual</h3>
            <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '25px' }}>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '25px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '10px', color: '#d1d5db', fontWeight: 'bold', fontSize: '0.9rem' }}>Nombre del Negocio</label>
                  <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #404040', background: '#111', color: 'white', boxSizing: 'border-box' }}/>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '10px', color: '#d1d5db', fontWeight: 'bold', fontSize: '0.9rem' }}>Logo</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '8px', background: '#111', border: '1px dashed #404040', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>{logoBase64 ? (<img src={logoBase64} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />) : (<span style={{ fontSize: '1.2rem', opacity: 0.5 }}>📸</span>)}</div>
                    <button onClick={handleSelectLogo} style={{ padding: '10px 15px', background: '#262626', color: 'white', border: '1px solid #404040', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>{logoBase64 ? 'Cambiar Logo' : 'Subir Imagen'}</button>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '10px', color: '#d1d5db', fontWeight: 'bold', fontSize: '0.9rem' }}>Color Principal</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: '#111', padding: '10px', borderRadius: '8px', border: '1px solid #404040' }}><input type="color" value={colorPrimary} onChange={e => setColorPrimary(e.target.value)} style={{ width: '35px', height: '35px', cursor: 'pointer', border: 'none', background: 'transparent' }} /><span style={{ color: '#9ca3af', fontFamily: 'monospace' }}>{colorPrimary.toUpperCase()}</span></div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '10px', color: '#d1d5db', fontWeight: 'bold', fontSize: '0.9rem' }}>Color Secundario</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: '#111', padding: '10px', borderRadius: '8px', border: '1px solid #404040' }}><input type="color" value={colorSecondary} onChange={e => setColorSecondary(e.target.value)} style={{ width: '35px', height: '35px', cursor: 'pointer', border: 'none', background: 'transparent' }} /><span style={{ color: '#9ca3af', fontFamily: 'monospace' }}>{colorSecondary.toUpperCase()}</span></div>
                </div>
              </div>
              <button onClick={handleSaveIdentity} style={{ padding: '12px 25px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%', transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>💾 GUARDAR IDENTIDAD VISUAL</button>
            </div>
          </div>

          {/* SECCIÓN 5: GESTIÓN DE MESAS */}
          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ color: '#f97316', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
              Gestión de Mesas
            </h3>
            <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#d1d5db', fontSize: '1.1rem', fontWeight: 'bold' }}>Mesas Activas en el Mapa</div>
                <div style={{ fontSize: '0.9rem', color: '#9ca3af', marginTop: '5px' }}>Añade o elimina mesas físicas de tu local.</div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <button 
                  onClick={handleRemoveTable}
                  style={{ width: '45px', height: '45px', borderRadius: '50%', background: '#450a0a', color: '#ef4444', border: '1px solid #ef4444', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}
                  title="Eliminar última mesa"
                >
                  -
                </button>
                
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white', minWidth: '50px', textAlign: 'center' }}>
                  {activeTablesCount}
                </div>
                
                <button 
                  onClick={handleAddTable}
                  style={{ width: '45px', height: '45px', borderRadius: '50%', background: '#064e3b', color: '#10b981', border: '1px solid #10b981', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}
                  title="Añadir una mesa"
                >
                  +
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {isLicenseModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a1a1a', padding: '35px', borderRadius: '15px', width: '550px', color: 'white', border: '1px solid #404040', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '1.5rem', color: '#f97316' }}>🔑 Activar Licencia</h2>
            <p style={{ color: '#d1d5db', marginBottom: '25px', lineHeight: '1.5', fontSize: '0.9rem' }}>Ingresa el código proporcionado por tu distribuidor. El sistema validará la firma digital criptográfica con tu dirección MAC.</p>
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', color: '#9ca3af', marginBottom: '8px', fontWeight: 'bold' }}>Código de Activación (Base64 / RSA)</label>
              <input type="text" value={newLicenseCode} onChange={e => setNewLicenseCode(e.target.value)} placeholder="TIPO|MAC|FECHA|FIRMA_BASE64..." style={{ width: '100%', padding: '15px', background: '#111', border: '1px solid #404040', color: '#3b82f6', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.5px' }} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => setIsLicenseModalOpen(false)} style={{ flex: 1, padding: '14px', background: '#333', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleUpdateLicense} style={{ flex: 1, padding: '14px', background: '#f97316', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Verificar y Activar</button>
            </div>
          </div>
        </div>
      )}

      {isResetModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a1a1a', padding: '35px', borderRadius: '15px', width: '500px', color: 'white', border: '1px solid #404040', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '1.5rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '10px' }}>⚠️ Restablecer Sistema</h2>
            <p style={{ color: '#d1d5db', marginBottom: '25px', lineHeight: '1.5' }}>Selecciona qué datos deseas eliminar de forma permanente. Esta acción <strong>NO se puede deshacer</strong>.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', background: '#262626', padding: '15px', borderRadius: '8px', border: resetOptions.transactions ? '1px solid #ef4444' : '1px solid #404040' }}><input type="checkbox" checked={resetOptions.transactions} onChange={(e) => setResetOptions({...resetOptions, transactions: e.target.checked})} style={{ marginTop: '4px', transform: 'scale(1.2)' }}/><div><div style={{ fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>Transacciones y Ventas (Caja en $0)</div><div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Borra todas las órdenes, pagos, tickets y reportes. <strong>El stock de inventario regresará a CERO para forzar un nuevo conteo inicial.</strong></div></div></label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', background: '#262626', padding: '15px', borderRadius: '8px', border: resetOptions.catalog ? '1px solid #ef4444' : '1px solid #404040' }}><input type="checkbox" checked={resetOptions.catalog} onChange={(e) => setResetOptions({...resetOptions, catalog: e.target.checked})} style={{ marginTop: '4px', transform: 'scale(1.2)' }}/><div><div style={{ fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>Catálogo y Menú</div><div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Borra todos los platillos, insumos y recetas guardadas.</div></div></label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', background: '#262626', padding: '15px', borderRadius: '8px', border: resetOptions.users ? '1px solid #ef4444' : '1px solid #404040' }}><input type="checkbox" checked={resetOptions.users} onChange={(e) => setResetOptions({...resetOptions, users: e.target.checked})} style={{ marginTop: '4px', transform: 'scale(1.2)' }}/><div><div style={{ fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>Personal y Usuarios</div><div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Borra a todos los meseros y cajeros (se conservará al Administrador Principal para no bloquear el sistema).</div></div></label>
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => setIsResetModalOpen(false)} style={{ flex: 1, padding: '14px', background: '#333', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleConfirmResetRequest} style={{ flex: 1, padding: '14px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Eliminar Datos Seleccionados</button>
            </div>
          </div>
        </div>
      )}

      <PinPadModal title="Autorizar Acción 🛡️" isOpen={isPinModalOpen} onClose={() => setIsPinModalOpen(false)} onVerify={executeReset} />
    </div>
  )
}