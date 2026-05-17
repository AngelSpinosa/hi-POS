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
    <div style={{ 
      height: '100vh', display: 'flex', flexDirection: 'column', 
      backgroundColor: 'var(--color-bg-main, #121212)', color: 'white', 
      fontFamily: 'var(--font-heading, monospace)' 
    }}>
      
      <div style={{ flex: 1, padding: '40px 60px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          
          <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '40px', color: 'white' }}>
            Configuración del sistema
          </h2>

          {/* SECCIÓN 1: TICKETS E IMPRESIONES */}
          <div style={{ marginBottom: '50px' }}>
            <h3 style={{ color: '#FCA311', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px', fontSize: '1.2rem' }}>
              Tickets e impresiones
            </h3>
            
            <div style={{ border: '1px solid #333', borderRadius: '12px', padding: '30px', background: 'transparent' }}>
              <div style={{ color: '#9ca3af', fontSize: '1rem', lineHeight: '1.5' }}>
                🖨️ Configuraciones de impresora térmica, logo del negocio y mensaje al pie del ticket se agregarán aquí en la versión Post-MVP.
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: BASE DE DATOS */}
          <div style={{ marginBottom: '50px' }}>
            <h3 style={{ color: '#FCA311', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px', fontSize: '1.2rem' }}>
              Base de datos
            </h3>
            
            <div style={{ border: '1px solid #333', borderRadius: '12px', padding: '30px', background: 'transparent' }}>
              <div style={{ marginBottom: '25px' }}>
                <h4 style={{ color: 'white', fontSize: '1.1rem', margin: '0 0 10px 0' }}>Respaldos y mantenimiento</h4>
                <p style={{ color: '#9ca3af', fontSize: '0.95rem', margin: 0, lineHeight: '1.5' }}>
                  Opciones para respaldar información, limpiar el historial de eventos y restablecer de fábrica.
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <button 
                  onClick={handleExportBackup} 
                  style={{ padding: '12px 25px', background: 'transparent', color: '#00E676', border: '1px solid #00E676', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit', fontSize: '0.95rem' }}
                >
                  Exportar respaldo
                </button>
                <button 
                  onClick={handleImportBackup} 
                  style={{ padding: '12px 25px', background: 'transparent', color: '#FCA311', border: '1px solid #FCA311', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit', fontSize: '0.95rem' }}
                >
                  Importar respaldo
                </button>
                <button 
                  onClick={() => setIsResetModalOpen(true)} 
                  style={{ padding: '12px 25px', background: 'transparent', color: '#FF0000', border: '1px solid #FF0000', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit', fontSize: '0.95rem' }}
                >
                  Restablecer datos
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: LICENCIA Y SISTEMA */}
          <div style={{ marginBottom: '50px' }}>
            <h3 style={{ color: '#FCA311', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px', fontSize: '1.2rem' }}>
              Licencia y sistema
            </h3>
            
            <div style={{ border: '1px solid #333', borderRadius: '12px', padding: '30px', background: 'transparent' }}>
              <div style={{ display: 'flex', gap: '25px', marginBottom: '35px' }}>
                {/* Tarjeta Device ID */}
                <div style={{ flex: 1, background: '#1a1a1a', padding: '25px', borderRadius: '12px', border: '1px solid #444', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ color: 'white', fontSize: '1.2rem', fontWeight: 'bold' }}>DEVICE ID</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
                    <code style={{ color: '#9ca3af', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {licenseInfo?.deviceId || 'Cargando...'}
                    </code>
                    <button 
                      onClick={() => { navigator.clipboard.writeText(licenseInfo?.deviceId || ''); alert('¡ID Copiado al portapapeles!'); }} 
                      style={{ background: '#00B4D8', color: 'black', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold', fontFamily: 'inherit' }}
                    >
                      Copiar
                    </button>
                  </div>
                </div>
                
                {/* Tarjeta Estado Licencia */}
                <div style={{ flex: 1, background: '#1a1a1a', padding: '25px', borderRadius: '12px', border: licenseInfo?.valid ? '1px solid #FCA311' : '1px solid #FF0000', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ color: 'white', fontSize: '1rem', fontWeight: 'normal' }}>Estado de licencia</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: licenseInfo?.valid ? '#FCA311' : '#FF0000' }}>
                    {licenseInfo?.valid ? licenseInfo.type.toUpperCase() : 'INVÁLIDA'}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                    {licenseInfo?.valid ? (licenseInfo.expires === 'PERPETUAL' ? 'Expira: Nunca' : `Quedan ${licenseInfo.remainingDays} días`) : 'Activación Requerida'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button 
                  onClick={() => setIsLicenseModalOpen(true)} 
                  style={{ padding: '14px 25px', background: 'transparent', color: '#FCA311', border: '1px solid #FCA311', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit', fontSize: '1rem', width: '100%', maxWidth: '400px' }}
                >
                  Renovar / Cambiar licencia
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: IDENTIDAD VISUAL */}
          <div style={{ marginBottom: '50px' }}>
            <h3 style={{ color: '#FCA311', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px', fontSize: '1.2rem' }}>
              Identidad visual
            </h3>
            
            <div style={{ border: '1px solid #333', borderRadius: '12px', padding: '30px', background: 'transparent' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '35px' }}>
                {/* Columna Izquierda */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '10px', color: 'white', fontWeight: 'bold', fontSize: '0.95rem' }}>Nombre del negocio</label>
                    <input 
                      type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} 
                      style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #555', background: 'transparent', color: 'white', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '10px', color: 'white', fontWeight: 'bold', fontSize: '0.95rem' }}>Color principal</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'transparent', padding: '8px 15px', borderRadius: '8px', border: '1px solid #555' }}>
                      <input type="color" value={colorPrimary} onChange={e => setColorPrimary(e.target.value)} style={{ width: '25px', height: '25px', cursor: 'pointer', border: 'none', background: 'transparent', padding: 0 }} />
                      <span style={{ color: 'white', fontFamily: 'inherit' }}>{colorPrimary.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
                
                {/* Columna Derecha */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '10px', color: 'white', fontWeight: 'bold', fontSize: '0.95rem' }}>Logo</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ width: '45px', height: '45px', borderRadius: '8px', background: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                        {logoBase64 ? (<img src={logoBase64} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />) : null}
                      </div>
                      <button 
                        onClick={handleSelectLogo} 
                        style={{ padding: '10px 20px', background: 'transparent', color: 'white', border: '1px solid #555', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit' }}
                      >
                        {logoBase64 ? 'Cambiar' : 'Subir'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '10px', color: 'white', fontWeight: 'bold', fontSize: '0.95rem' }}>Color secundario</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'transparent', padding: '8px 15px', borderRadius: '8px', border: '1px solid #555' }}>
                      <input type="color" value={colorSecondary} onChange={e => setColorSecondary(e.target.value)} style={{ width: '25px', height: '25px', cursor: 'pointer', border: 'none', background: 'transparent', padding: 0 }} />
                      <span style={{ color: 'white', fontFamily: 'inherit' }}>{colorSecondary.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button 
                  onClick={handleSaveIdentity} 
                  style={{ padding: '14px 25px', background: '#00E676', color: 'black', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit', fontSize: '1rem', width: '100%', maxWidth: '400px' }}
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN 5: GESTIÓN DE MESAS */}
          <div style={{ marginBottom: '60px' }}>
            <h3 style={{ color: '#FCA311', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px', fontSize: '1.2rem' }}>
              Gestión de mesas
            </h3>
            
            <div style={{ border: '1px solid #333', borderRadius: '12px', padding: '30px', background: 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'white', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '5px' }}>Mesas activas en el mapa</div>
                <div style={{ fontSize: '0.95rem', color: '#9ca3af' }}>Añade o elimina mesas físicas en tu local</div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
                <button 
                  onClick={handleRemoveTable}
                  style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'transparent', color: '#FF0000', border: '1px solid #FF0000', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}
                >
                  -
                </button>
                
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'white', minWidth: '40px', textAlign: 'center' }}>
                  {activeTablesCount}
                </div>
                
                <button 
                  onClick={handleAddTable}
                  style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'transparent', color: '#00E676', border: '1px solid #00E676', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ================= MODALES ================= */}
      
      {/* MODAL LICENCIA */}
      {isLicenseModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 5000, backdropFilter: 'blur(5px)' }}>
          <div style={{ background: '#111111', padding: '35px', borderRadius: '16px', width: '500px', color: 'white', border: '1px solid #ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '1.8rem', color: 'white' }}>Activar licencia</h2>
            <p style={{ color: '#9ca3af', marginBottom: '25px', lineHeight: '1.5', fontSize: '0.95rem' }}>Ingresa el código proporcionado por tu distribuidor para validar el sistema.</p>
            <div style={{ marginBottom: '30px' }}>
              <input type="text" value={newLicenseCode} onChange={e => setNewLicenseCode(e.target.value)} placeholder="TIPO|MAC|FECHA|FIRMA..." style={{ width: '100%', padding: '15px', background: 'transparent', border: '1px solid #555', color: '#00B4D8', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => setIsLicenseModalOpen(false)} style={{ flex: 1, padding: '14px', background: 'transparent', color: 'white', border: '1px solid white', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={handleUpdateLicense} style={{ flex: 1, padding: '14px', background: '#FCA311', color: 'black', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>Verificar y activar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESTABLECER */}
      {isResetModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 5000, backdropFilter: 'blur(5px)' }}>
          <div style={{ background: '#111111', padding: '35px', borderRadius: '16px', width: '500px', color: 'white', border: '1px solid #ffffff', boxShadow: '0 20px 50px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '1.8rem', color: '#FF0000' }}>Restablecer sistema</h2>
            <p style={{ color: '#9ca3af', marginBottom: '25px', lineHeight: '1.5', fontSize: '0.95rem' }}>Selecciona qué datos deseas eliminar de forma permanente. Esta acción <strong>NO se puede deshacer</strong>.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', cursor: 'pointer', background: 'transparent', padding: '15px', borderRadius: '8px', border: resetOptions.transactions ? '1px solid #FF0000' : '1px solid #555' }}>
                <input type="checkbox" checked={resetOptions.transactions} onChange={(e) => setResetOptions({...resetOptions, transactions: e.target.checked})} style={{ marginTop: '5px', transform: 'scale(1.3)' }}/>
                <div>
                  <div style={{ fontWeight: 'bold', color: 'white', marginBottom: '5px', fontSize: '1.05rem' }}>Transacciones y ventas</div>
                  <div style={{ fontSize: '0.85rem', color: '#9ca3af', lineHeight: '1.4' }}>Borra todas las órdenes y tickets. El stock de inventario regresará a cero.</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', cursor: 'pointer', background: 'transparent', padding: '15px', borderRadius: '8px', border: resetOptions.catalog ? '1px solid #FF0000' : '1px solid #555' }}>
                <input type="checkbox" checked={resetOptions.catalog} onChange={(e) => setResetOptions({...resetOptions, catalog: e.target.checked})} style={{ marginTop: '5px', transform: 'scale(1.3)' }}/>
                <div>
                  <div style={{ fontWeight: 'bold', color: 'white', marginBottom: '5px', fontSize: '1.05rem' }}>Catálogo y menú</div>
                  <div style={{ fontSize: '0.85rem', color: '#9ca3af', lineHeight: '1.4' }}>Borra todos los platillos, insumos y recetas guardadas.</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', cursor: 'pointer', background: 'transparent', padding: '15px', borderRadius: '8px', border: resetOptions.users ? '1px solid #FF0000' : '1px solid #555' }}>
                <input type="checkbox" checked={resetOptions.users} onChange={(e) => setResetOptions({...resetOptions, users: e.target.checked})} style={{ marginTop: '5px', transform: 'scale(1.3)' }}/>
                <div>
                  <div style={{ fontWeight: 'bold', color: 'white', marginBottom: '5px', fontSize: '1.05rem' }}>Personal y usuarios</div>
                  <div style={{ fontSize: '0.85rem', color: '#9ca3af', lineHeight: '1.4' }}>Borra a todos los empleados (se conservará al Administrador Principal).</div>
                </div>
              </label>
            </div>
            
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => setIsResetModalOpen(false)} style={{ flex: 1, padding: '14px', background: 'transparent', color: 'white', border: '1px solid white', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={handleConfirmResetRequest} style={{ flex: 1, padding: '14px', background: '#FF0000', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>Eliminar datos</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PIN DE AUTORIZACIÓN */}
      <PinPadModal title="Autorizar Acción 🛡️" isOpen={isPinModalOpen} onClose={() => setIsPinModalOpen(false)} onVerify={executeReset} />
    </div>
  )
}