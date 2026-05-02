import { useState } from 'react'

interface PinPadModalProps {
  title?: string;
  isOpen: boolean;
  onClose: () => void;
  onVerify: (pin: string) => void;
}

export function PinPadModal({ title = "Ingrese su PIN", isOpen, onClose, onVerify }: PinPadModalProps) {
  const [pin, setPin] = useState('')

  if (!isOpen) return null;

  const handleNumClick = (num: string) => {
    if (pin.length < 4) { // Limitamos a 4 dígitos por seguridad visual
      setPin(prev => prev + num)
    }
  }

  //const handleClear = () => setPin('')
  const handleBackspace = () => setPin(prev => prev.slice(0, -1))
  
  const handleSubmit = () => {
    if (pin.length > 0) {
      onVerify(pin)
      setPin('') // Limpiar para el siguiente intento
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 5000,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      backdropFilter: 'blur(5px)'
    }} onClick={onClose}>
      <div style={{ 
        backgroundColor: '#1f1f1f', padding: '30px', borderRadius: '15px', 
        width: '320px', border: '1px solid #333', boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
      }} onClick={e => e.stopPropagation()}>
        
        <h2 style={{ textAlign: 'center', color: 'white', marginTop: 0, marginBottom: '20px' }}>
          {title} 🔒
        </h2>

        {/* Display del PIN (Oculto) */}
        <div style={{ 
          background: '#111', color: 'white', fontSize: '2.5rem', 
          textAlign: 'center', padding: '15px', borderRadius: '10px', 
          marginBottom: '20px', letterSpacing: '10px', height: '70px',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {pin.split('').map(() => '•').join('') || <span style={{opacity:0.2, fontSize: '1rem', letterSpacing: 'normal'}}>_ _ _ _</span>}
        </div>

        {/* Teclado Numérico */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumClick(num.toString())}
              style={{
                padding: '20px', fontSize: '1.5rem', fontWeight: 'bold',
                background: '#333', color: 'white', border: 'none', borderRadius: '8px',
                cursor: 'pointer', transition: 'background 0.1s'
              }}
              onMouseDown={e => e.currentTarget.style.background = '#555'}
              onMouseUp={e => e.currentTarget.style.background = '#333'}
            >
              {num}
            </button>
          ))}
          
          {/* Botones de Control */}
          <button onClick={handleBackspace} style={{ background: '#7f1d1d', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer' }}>⌫</button>
          <button onClick={() => handleNumClick('0')} style={{ background: '#333', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.5rem', fontWeight: 'bold', cursor: 'pointer' }}>0</button>
          <button onClick={handleSubmit} style={{ background: '#15803d', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer' }}>⏎</button>
        </div>

        <button 
          onClick={onClose}
          style={{ width: '100%', marginTop: '20px', padding: '15px', background: 'transparent', border: '1px solid #555', color: '#888', borderRadius: '8px', cursor: 'pointer' }}
        >
          Cancelar
        </button>

      </div>
    </div>
  )
}