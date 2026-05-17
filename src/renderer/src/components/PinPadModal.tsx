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
      backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 5000,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      backdropFilter: 'blur(5px)',
      fontFamily: 'var(--font-heading, monospace)'
    }} onClick={onClose}>
      
      {/* Contenedor principal estilizado como tarjeta vertical flotante */}
      <div style={{ 
        backgroundColor: '#111111', padding: '40px 35px', borderRadius: '16px', 
        width: '340px', boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        animation: 'fadeIn 0.2s ease-out'
      }} onClick={e => e.stopPropagation()}>
        
        <h2 style={{ 
          textAlign: 'center', color: 'white', marginTop: 0, marginBottom: '30px', 
          fontSize: '2rem', fontWeight: 'bold', whiteSpace: 'pre-wrap', lineHeight: '1.2' 
        }}>
          {title}
        </h2>

        {/* Display del PIN (Recuadro vacío con animación) */}
        <div style={{ 
          border: '1px solid #ffffff', borderRadius: '12px', height: '70px', 
          marginBottom: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '3rem', color: 'white', letterSpacing: '15px'
        }}>
          {pin.split('').map((char, i) => (
            <span 
              key={`${i}-${char}`} 
              style={{ 
                animation: 'popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards', 
                display: 'inline-block' 
              }}
            >
              •
            </span>
          ))}
        </div>

        {/* Teclado Numérico con Cuadrícula (Grid) interactiva */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '35px' }}>
          {[
            { id: '1', val: '1' }, { id: '2', val: '2' }, { id: '3', val: '3' },
            { id: '4', val: '4' }, { id: '5', val: '5' }, { id: '6', val: '6' },
            { id: '7', val: '7' }, { id: '8', val: '8' }, { id: '9', val: '9' },
            { id: 'back', val: 'X' }, { id: '0', val: '0' }, { id: 'enter', val: 'V' }
          ].map((btn, index) => {
            
            // Calculamos qué bordes mostrar para crear la cuadrícula interna sutil
            const isRightCol = index % 3 === 2;
            const isBottomRow = index >= 9;

            return (
              <button
                key={btn.id}
                onClick={() => {
                  if (btn.id === 'back') handleBackspace();
                  else if (btn.id === 'enter') handleSubmit();
                  else handleNumClick(btn.val);
                }}
                style={{
                  padding: '20px 0', background: 'transparent', border: 'none',
                  borderRight: isRightCol ? 'none' : '1px solid #333',
                  borderBottom: isBottomRow ? 'none' : '1px solid #333',
                  color: 'white', fontSize: '1.8rem', fontWeight: 'bold',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'inherit', transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                onMouseDown={e => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.transform = 'scale(0.85)'; // Animación de presionado
                }}
                onMouseUp={e => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.transform = 'scale(1)'; // Restaura tamaño
                }}
              >
                {btn.id === 'back' ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                ) : btn.id === 'enter' ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                ) : (
                  btn.val
                )}
              </button>
            )
          })}
        </div>

        {/* Botón de Cancelar estilo "Píldora" con animación */}
        <button 
          onClick={onClose}
          style={{ 
            width: '100%', padding: '12px', background: 'transparent', 
            border: '1px solid #ffffff', color: '#ffffff', borderRadius: '30px', 
            cursor: 'pointer', fontSize: '1.1rem', fontFamily: 'inherit',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={e => { 
            e.currentTarget.style.backgroundColor = 'white'; 
            e.currentTarget.style.color = 'black'; 
          }}
          onMouseLeave={e => { 
            e.currentTarget.style.backgroundColor = 'transparent'; 
            e.currentTarget.style.color = 'white'; 
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          Cancelar
        </button>

      </div>

      {/* Estilos globales para las animaciones del modal */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.3); }
          70% { transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>

    </div>
  )
}