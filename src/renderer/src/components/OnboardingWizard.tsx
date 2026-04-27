import { useState } from 'react'

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1)

  // Paso 1: Identidad
  const [businessName, setBusinessName] = useState('')
  const [colorPrimary, setColorPrimary] = useState('#f97316') // Naranja default
  const [colorSecondary, setColorSecondary] = useState('#3b82f6') // Azul default

  // Paso 2: Operación
  const [numMesas, setNumMesas] = useState<number>(8)
  const [adminPin, setAdminPin] = useState('1234')

  // Paso 3: Menú Base
  const [platillos, setPlatillos] = useState<{nombre: string, precio: number}[]>([])
  const [platilloNombre, setPlatilloNombre] = useState('')
  const [platilloPrecio, setPlatilloPrecio] = useState('')

  const handleAddPlatillo = () => {
    if (!platilloNombre.trim() || !platilloPrecio || Number(platilloPrecio) < 0) return
    setPlatillos([...platillos, { nombre: platilloNombre, precio: Number(platilloPrecio) }])
    setPlatilloNombre('')
    setPlatilloPrecio('')
  }

  const handleRemovePlatillo = (index: number) => {
    setPlatillos(platillos.filter((_, i) => i !== index))
  }

  // Finalizar u Omitir
  const handleSkip = async () => {
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('setup-skip')
    onComplete()
  }

  const handleFinish = async () => {
    if (!businessName.trim() || !adminPin.trim()) {
      alert("Por favor completa al menos el Nombre del Negocio y el PIN de Administrador.")
      return
    }

    const payload = {
      config: {
        business_name: businessName,
        color_primary: colorPrimary,
        color_secondary: colorSecondary
      },
      numMesas,
      platillos,
      adminPin
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#111', color: 'white', fontFamily: 'sans-serif' }}>
      
      {/* Header del Wizard */}
      <div style={{ padding: '20px 40px', background: '#1a1a1a', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', color: colorPrimary }}>Configuración Inicial</h1>
          <p style={{ margin: '5px 0 0 0', color: '#9ca3af' }}>Paso {step} de 3</p>
        </div>
        <button 
          onClick={handleSkip}
          style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #404040', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'white'}
          onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
        >
          Omitir Configuración ⏭️
        </button>
      </div>

      {/* Contenedor Central */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div style={{ width: '600px', background: '#1a1a1a', borderRadius: '15px', padding: '40px', border: '1px solid #333', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
          
          {/* PASO 1: Identidad de Marca */}
          {step === 1 && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>Identidad de tu Negocio</h2>
              
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '10px', color: '#d1d5db' }}>Nombre del Restaurante / Local</label>
                <input 
                  type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                  placeholder="Ej. Pizzería La Mamma"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #404040', background: '#111', color: 'white', fontSize: '1.1rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '10px', color: '#d1d5db' }}>Colores de tu Marca</label>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden', border: '2px solid #404040' }}>
                      <input type="color" value={colorPrimary} onChange={e => setColorPrimary(e.target.value)} style={{ width: '150%', height: '150%', cursor: 'pointer', border: 'none', margin: '-25%' }} />
                    </div>
                    <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Color Principal</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden', border: '2px solid #404040' }}>
                      <input type="color" value={colorSecondary} onChange={e => setColorSecondary(e.target.value)} style={{ width: '150%', height: '150%', cursor: 'pointer', border: 'none', margin: '-25%' }} />
                    </div>
                    <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Color Secundario</span>
                  </div>
                </div>
              </div>

              <button onClick={() => setStep(2)} style={{ width: '100%', padding: '15px', background: colorPrimary, color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
                Siguiente
              </button>
            </div>
          )}

          {/* PASO 2: Operación Base */}
          {step === 2 && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>Estructura Operativa</h2>
              
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '10px', color: '#d1d5db' }}>¿Cuántas mesas tiene tu local?</label>
                <input 
                  type="number" min="1" value={numMesas} onChange={e => setNumMesas(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #404040', background: '#111', color: 'white', fontSize: '1.1rem', boxSizing: 'border-box', textAlign: 'center' }}
                />
              </div>

              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '10px', color: '#d1d5db' }}>Crea tu PIN de Administrador (4 a 6 dígitos)</label>
                <input 
                  type="password" maxLength={6} value={adminPin} onChange={e => setAdminPin(e.target.value)}
                  placeholder="Ej. 1234"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #404040', background: '#111', color: 'white', fontSize: '1.5rem', boxSizing: 'border-box', textAlign: 'center', letterSpacing: '10px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, padding: '15px', background: '#262626', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>
                  Atrás
                </button>
                <button onClick={() => setStep(3)} style={{ flex: 2, padding: '15px', background: colorPrimary, color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: Menú Rápido */}
          {step === 3 && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Carga Rápida de Menú</h2>
              <p style={{ textAlign: 'center', color: '#9ca3af', marginBottom: '25px', fontSize: '0.9rem' }}>
                Añade tus primeros platillos. Podrás agregar recetas e insumos después desde la configuración.
              </p>
              
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input 
                  type="text" placeholder="Nombre" value={platilloNombre} onChange={e => setPlatilloNombre(e.target.value)}
                  style={{ flex: 2, padding: '12px', borderRadius: '8px', border: '1px solid #404040', background: '#111', color: 'white', boxSizing: 'border-box' }}
                />
                <input 
                  type="number" placeholder="Precio $" value={platilloPrecio} onChange={e => setPlatilloPrecio(e.target.value)}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #404040', background: '#111', color: 'white', boxSizing: 'border-box' }}
                />
                <button onClick={handleAddPlatillo} style={{ padding: '0 20px', background: colorSecondary, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Agregar
                </button>
              </div>

              <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#111', borderRadius: '8px', border: '1px solid #333', padding: '10px', marginBottom: '25px' }}>
                {platillos.length === 0 ? (
                  <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>Aún no hay platillos añadidos</div>
                ) : (
                  platillos.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #262626' }}>
                      <span>{p.nombre}</span>
                      <div style={{ display: 'flex', gap: '15px' }}>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>${p.precio.toFixed(2)}</span>
                        <button onClick={() => handleRemovePlatillo(i)} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer' }}>✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={() => setStep(2)} style={{ flex: 1, padding: '15px', background: '#262626', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>
                  Atrás
                </button>
                <button onClick={handleFinish} style={{ flex: 2, padding: '15px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>
                  ¡Comenzar a Vender! 🎉
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}