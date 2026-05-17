import { useState } from 'react'

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1)

  // Paso 1: Identidad
  const [businessName, setBusinessName] = useState('')
  const [colorPrimary, setColorPrimary] = useState('#f97316')
  const [colorSecondary, setColorSecondary] = useState('#3b82f6')
  const [logoBase64, setLogoBase64] = useState<string | null>(null)

  // Paso 2: Operación y Personal
  const [numMesas, setNumMesas] = useState<number>(8)
  const [adminPin, setAdminPin] = useState('1234')
  
  // NUEVO: Estado para empleados adicionales
  const [empleados, setEmpleados] = useState<{nombre: string, rol: string, pin: string}[]>([])
  const [empNombre, setEmpNombre] = useState('')
  const [empRol, setEmpRol] = useState('cajero')
  const [empPin, setEmpPin] = useState('')

  // Paso 3: Menú Base
  const [platillos, setPlatillos] = useState<{nombre: string, precio: number}[]>([])
  const [platilloNombre, setPlatilloNombre] = useState('')
  const [platilloPrecio, setPlatilloPrecio] = useState('')

  // Funciones de Identidad
  const handleSelectLogo = async () => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('select-logo');
    if (res.success) {
      setLogoBase64(res.logoData);
    } else if (!res.canceled) {
      alert('Error al cargar logo: ' + res.error);
    }
  }

  // Funciones de Personal
  const handleAddEmpleado = () => {
    if (!empNombre.trim() || !empPin.trim() || empPin.length < 4) {
      alert('Ingresa el nombre y un PIN válido (min. 4 dígitos).')
      return
    }
    setEmpleados([...empleados, { nombre: empNombre, rol: empRol, pin: empPin }])
    setEmpNombre('')
    setEmpPin('')
  }

  const handleRemoveEmpleado = (index: number) => {
    setEmpleados(empleados.filter((_, i) => i !== index))
  }

  // Funciones de Menú
  const handleAddPlatillo = () => {
    if (!platilloNombre.trim() || !platilloPrecio || Number(platilloPrecio) < 0) return
    setPlatillos([...platillos, { nombre: platilloNombre, precio: Number(platilloPrecio) }])
    setPlatilloNombre('')
    setPlatilloPrecio('')
  }

  const handleRemovePlatillo = (index: number) => {
    setPlatillos(platillos.filter((_, i) => i !== index))
  }

  const handleSkip = async () => {
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('setup-skip')
    onComplete()
  }

  const handleFinish = async () => {
    if (!businessName.trim() || !adminPin.trim()) {
      alert("Por favor completa al menos el Nombre del Negocio y el PIN del Administrador Principal.")
      return
    }

    const payload = {
      config: {
        business_name: businessName,
        color_primary: colorPrimary,
        color_secondary: colorSecondary,
        logo_path: logoBase64
      },
      numMesas,
      platillos,
      adminPin,
      empleados // Enviamos la lista de empleados al backend
    }

    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('setup-initial-data', payload)
    if (res.success) {
      onComplete()
    } else {
      alert("Error al guardar la configuración: " + res.error)
    }
  }

 return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      backgroundColor: 'var(--color-bg-main, #121212)', 
      color: 'white', 
      fontFamily: 'var(--font-heading, monospace)' 
    }}>
      
      {/* Header Fijo */}
      <div style={{ 
        padding: '20px 40px', 
        borderBottom: '1px solid #333', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 'bold' }}>
          Configuración inicial
        </h1>
        <button 
          onClick={handleSkip}
          style={{ 
            background: 'transparent', 
            color: 'white', 
            border: '1px solid white', 
            padding: '10px 20px', 
            borderRadius: '25px', 
            cursor: 'pointer', 
            fontFamily: 'inherit',
            fontSize: '0.9rem',
            transition: 'all 0.2s' 
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = 'black'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'white'; }}
        >
          Omitir configuración
        </button>
      </div>

      {/* Contenedor Principal Centrado */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        
        <div style={{ 
          width: '650px', 
          backgroundColor: '#161616', 
          borderRadius: '16px', 
          padding: '40px 50px', 
          border: '1px solid #333', 
          boxSizing: 'border-box'
        }}>
          
          {/* ================= PASO 1: Identidad ================= */}
          {step === 1 && (
            <div style={{ animation: 'fadeIn 0.3s', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              
              <h2 style={{ margin: '0 0 15px 0', fontSize: '1.5rem', fontWeight: 'normal' }}>Nombre del negocio</h2>
              <input 
                type="text" 
                value={businessName} 
                onChange={e => setBusinessName(e.target.value)}
                placeholder="Nombre"
                style={{ 
                  width: '350px', padding: '12px 15px', borderRadius: '8px', 
                  border: '1px solid #555', background: '#111', color: 'white', 
                  fontFamily: 'inherit', fontSize: '1rem', textAlign: 'left', marginBottom: '30px'
                }}
              />

              <h2 style={{ margin: '0 0 15px 0', fontSize: '1.5rem', fontWeight: 'normal' }}>Logo o símbolos</h2>
              <button 
                onClick={handleSelectLogo} 
                style={{ 
                  width: '350px', padding: '15px', background: 'transparent', 
                  color: 'white', border: '1px solid #555', borderRadius: '8px', 
                  cursor: 'pointer', fontSize: '1.1rem', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px',
                  marginBottom: '30px', transition: 'background-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#222'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {logoBase64 ? (
                  <img src={logoBase64} alt="Logo" style={{ maxHeight: '30px', objectFit: 'contain' }} />
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                )}
                <span>{logoBase64 ? 'Cambiar logo' : 'Subir logo'}</span>
              </button>

              <h2 style={{ margin: '0 0 20px 0', fontSize: '1.5rem', fontWeight: 'normal' }}>Selecciona al menos 2 colores</h2>
              <div style={{ display: 'flex', gap: '40px', marginBottom: '40px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '16px', overflow: 'hidden', border: '2px solid #555', cursor: 'pointer' }}>
                    <input type="color" value={colorPrimary} onChange={e => setColorPrimary(e.target.value)} style={{ width: '150%', height: '150%', cursor: 'pointer', border: 'none', margin: '-25%', padding: 0 }} />
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#d1d5db' }}>Color 1</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '16px', overflow: 'hidden', border: '2px solid #555', cursor: 'pointer' }}>
                    <input type="color" value={colorSecondary} onChange={e => setColorSecondary(e.target.value)} style={{ width: '150%', height: '150%', cursor: 'pointer', border: 'none', margin: '-25%', padding: 0 }} />
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#d1d5db' }}>Color 2</span>
                </div>
              </div>

              <button 
                onClick={() => setStep(2)} 
                style={{ 
                  width: '200px', padding: '14px', background: 'white', color: 'black', 
                  border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', 
                  cursor: 'pointer', fontFamily: 'inherit'
                }}
              >
                SIGUIENTE
              </button>
            </div>
          )}

          {/* ================= PASO 2: Estructura ================= */}
          {step === 2 && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <h2 style={{ textAlign: 'center', margin: '0 0 30px 0', fontSize: '1.8rem', fontWeight: 'bold' }}>Estructura operativa</h2>
              
              <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <label style={{ display: 'block', marginBottom: '10px', fontSize: '1rem' }}>Mesas</label>
                  <input 
                    type="number" min="1" value={numMesas} onChange={e => setNumMesas(parseInt(e.target.value) || 0)}
                    placeholder="Selecciona la cantidad de mesas"
                    style={{ width: '100%', height: '48px', padding: '0 15px', borderRadius: '6px', border: '1px solid #555', background: 'transparent', color: 'white', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <label style={{ display: 'block', marginBottom: '10px', fontSize: '1rem' }}>PIN Admin (de 1 a 6 dígitos)</label>
                  <input 
                    type="password" maxLength={6} value={adminPin} onChange={e => setAdminPin(e.target.value)}
                    placeholder="----"
                    style={{ width: '100%', height: '48px', padding: '0 15px', borderRadius: '6px', border: '1px solid #555', background: 'transparent', color: 'white', fontFamily: 'inherit', boxSizing: 'border-box', textAlign: 'center', letterSpacing: '3px', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ border: '1px solid #444', borderRadius: '12px', padding: '25px', marginBottom: '40px' }}>
                <h3 style={{ textAlign: 'center', margin: '0 0 20px 0', fontSize: '1.3rem', fontWeight: 'normal' }}>Personal adicional (opcional)</h3>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px' }}>
                  <input 
                    type="text" placeholder="Nombre" value={empNombre} onChange={e => setEmpNombre(e.target.value)}
                    style={{ flex: 1.5, height: '42px', padding: '0 12px', borderRadius: '6px', border: '1px solid #555', background: 'transparent', color: 'white', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                  />
                  <select 
                    value={empRol} onChange={e => setEmpRol(e.target.value)}
                    style={{ flex: 1.5, height: '42px', padding: '0 12px', borderRadius: '6px', border: '1px solid #555', background: 'transparent', color: 'white', fontFamily: 'inherit', appearance: 'none', boxSizing: 'border-box', outline: 'none' }}
                  >
                    <option value="cajero" style={{ background: '#1a1a1a' }}>Mesero/Cajero</option>
                    <option value="admin" style={{ background: '#1a1a1a' }}>Administrador</option>
                  </select>
                  <input 
                    type="password" placeholder="PIN" maxLength={6} value={empPin} onChange={e => setEmpPin(e.target.value)}
                    style={{ flex: 1, height: '42px', padding: '0 12px', borderRadius: '6px', border: '1px solid #555', background: 'transparent', color: 'white', fontFamily: 'inherit', textAlign: 'center', boxSizing: 'border-box', outline: 'none' }}
                  />
                  <button 
                    onClick={handleAddEmpleado} 
                    style={{ 
                      width: '42px', height: '42px', borderRadius: '50%', background: '#00E676', 
                      color: 'white', border: 'none', cursor: 'pointer', display: 'flex', 
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  </button>
                </div>

                {empleados.length > 0 && (
                  <div style={{ maxHeight: '100px', overflowY: 'auto', marginBottom: '15px' }}>
                    {empleados.map((emp, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #333', fontSize: '0.9rem' }}>
                        <span>{emp.nombre}</span>
                        <div style={{ display: 'flex', gap: '15px' }}>
                          <span style={{ color: '#aaa' }}>{emp.rol}</span>
                          <span style={{ color: '#aaa' }}>***{emp.pin.slice(-1)}</span>
                          <button onClick={() => handleRemoveEmpleado(i)} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer' }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p style={{ textAlign: 'center', margin: 0, color: '#9ca3af', fontSize: '0.85rem' }}>
                  Puedes agregar a tu equipo de trabajo aquí o dejarlo para más tarde
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
                <button 
                  onClick={() => setStep(1)} 
                  style={{ width: '150px', padding: '14px', background: 'transparent', color: 'white', border: '1px solid white', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Atrás
                </button>
                <button 
                  onClick={() => setStep(3)} 
                  style={{ width: '150px', padding: '14px', background: 'white', color: 'black', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  SIGUIENTE
                </button>
              </div>
            </div>
          )}

          {/* ================= PASO 3: Menú Base ================= */}
          {step === 3 && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <h2 style={{ textAlign: 'center', margin: '0 0 30px 0', fontSize: '1.8rem', fontWeight: 'bold' }}>Carga rápida del menú</h2>
              
              <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', justifyContent: 'center', alignItems: 'center' }}>
                <input 
                  type="text" placeholder="Nombre" value={platilloNombre} onChange={e => setPlatilloNombre(e.target.value)}
                  style={{ width: '200px', height: '45px', padding: '0 15px', borderRadius: '6px', border: '1px solid #555', background: 'transparent', color: 'white', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                />
                <input 
                  type="number" placeholder="Precio $" value={platilloPrecio} onChange={e => setPlatilloPrecio(e.target.value)}
                  style={{ width: '120px', height: '45px', padding: '0 15px', borderRadius: '6px', border: '1px solid #555', background: 'transparent', color: 'white', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                />
                <button 
                  onClick={handleAddPlatillo} 
                  style={{ height: '45px', padding: '0 20px', background: '#00E676', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Agregar
                </button>
              </div>

              <div style={{ 
                minHeight: '120px', maxHeight: '180px', overflowY: 'auto', background: 'transparent', 
                borderRadius: '8px', border: '1px solid #444', padding: '15px', marginBottom: '40px',
                display: 'flex', flexDirection: 'column'
              }}>
                {platillos.length === 0 ? (
                  <div style={{ color: '#d1d5db', margin: 'auto', fontSize: '0.9rem' }}>Aún no hay platillos añadidos</div>
                ) : (
                  platillos.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #333' }}>
                      <span>{p.nombre}</span>
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <span style={{ color: 'white' }}>${p.precio.toFixed(2)}</span>
                        <button onClick={() => handleRemovePlatillo(i)} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
                <button 
                  onClick={() => setStep(2)} 
                  style={{ width: '160px', padding: '14px', background: 'transparent', color: 'white', border: '1px solid white', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Atrás
                </button>
                <button 
                  onClick={handleFinish} 
                  style={{ width: '220px', padding: '14px', background: 'white', color: 'black', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ¡Comienza a vender!
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Mensaje inferior flotante solo para el Paso 3 */}
        {step === 3 && (
          <p style={{ marginTop: '20px', color: 'white', fontSize: '0.9rem', textAlign: 'center', animation: 'fadeIn 0.3s' }}>
            Los insumos se pueden añadir después de la configuración incial*
          </p>
        )}

      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        /* Ocultar flechas del input number para que se vea más limpio como en Figma */
        input[type="number"]::-webkit-inner-spin-button, 
        input[type="number"]::-webkit-outer-spin-button { 
          -webkit-appearance: none; margin: 0; 
        }
      `}</style>
    </div>
  )
}