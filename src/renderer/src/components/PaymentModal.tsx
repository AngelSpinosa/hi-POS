import { useState, useEffect, useRef } from 'react'

interface PaymentModalProps {
  total: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirmPayment: (method: 'efectivo' | 'tarjeta', received: number) => void;
}

export function PaymentModal({ total, isOpen, onClose, onConfirmPayment }: PaymentModalProps) {
  const [method, setMethod] = useState<'efectivo' | 'tarjeta'>('efectivo')
  const [received, setReceived] = useState<string>('')
  
  // 1. Creamos una referencia directa al input HTML
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setMethod('efectivo')
      setReceived('')
      
      // 2. Forzamos el foco con un pequeño retraso para asegurar que la ventana esté lista
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select() // Opcional: selecciona el texto si hubiera
        }
      }, 50)
    }
  }, [isOpen])

  if (!isOpen) return null;

  const numericReceived = parseFloat(received) || 0
  const change = numericReceived - total

  // ... (Tus estilos se mantienen igual) ...
  const overlayStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
  }
  const modalStyle: React.CSSProperties = {
    backgroundColor: '#2d2d2d', padding: '30px', borderRadius: '8px', width: '400px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)', border: '1px solid #404040'
  }

  const handleConfirm = () => {
    if (method === 'efectivo' && numericReceived < total) return;
    const finalReceived = method === 'efectivo' ? numericReceived : total;
    onConfirmPayment(method, finalReceived)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    if (newValue === '') {
      setReceived('')
      return
    }
    const parsed = parseFloat(newValue)
    if (!isNaN(parsed) && parsed >= 0) {
      setReceived(newValue)
    }
  }

  const preventInvalidChars = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault()
    // Permitir cerrar con Escape
    if (e.key === 'Escape') onClose()
    // Permitir confirmar con Enter
    if (e.key === 'Enter') {
        if (!(method === 'efectivo' && numericReceived < total)) {
            handleConfirm()
        }
    }
  }

return (
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)', 
        display: 'flex', justifyContent: 'center', alignItems: 'center', 
        zIndex: 5000,
        fontFamily: 'var(--font-heading, monospace)'
      }} 
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        style={{
          backgroundColor: '#161616', 
          padding: '35px 40px', 
          borderRadius: '16px', 
          width: '450px',
          border: '1px solid #333',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxSizing: 'border-box',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        <h2 style={{ margin: '0 0 5px 0', color: 'white', fontSize: '1.8rem', fontWeight: 'bold' }}>
          Cobrar ${total.toFixed(2)}
        </h2>
        
        {/* Selector de Método de Pago */}
        <div style={{ display: 'flex', border: '1px solid #555', borderRadius: '8px', overflow: 'hidden', marginTop: '10px' }}>
          <button 
            style={{ 
              flex: 1, padding: '12px', 
              background: method === 'efectivo' ? '#222' : 'transparent', 
              color: 'white', border: 'none', borderRight: '1px solid #555', 
              cursor: 'pointer', fontSize: '1rem', 
              fontWeight: method === 'efectivo' ? 'bold' : 'normal',
              fontFamily: 'inherit',
              transition: 'background 0.2s'
            }}
            onClick={() => { setMethod('efectivo'); inputRef.current?.focus(); }}
          >
            Efectivo
          </button>
          <button 
             style={{ 
               flex: 1, padding: '12px', 
               background: method === 'tarjeta' ? '#222' : 'transparent', 
               color: 'white', border: 'none', 
               cursor: 'pointer', fontSize: '1rem', 
               fontWeight: method === 'tarjeta' ? 'bold' : 'normal',
               fontFamily: 'inherit',
               transition: 'background 0.2s'
             }}
             onClick={() => setMethod('tarjeta')}
          >
            Tarjeta
          </button>
        </div>

        {/* Contenedor dinámico (Evita que el modal salte de tamaño) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '110px' }}>
          {method === 'efectivo' ? (
            <>
              <label style={{ color: '#d1d5db', fontSize: '0.9rem' }}>Monto recibido</label>
              <input 
                ref={inputRef}
                type="number" 
                min="0"
                value={received}
                onKeyDown={preventInvalidChars}
                onChange={handleInputChange}
                style={{ 
                  width: '100%', padding: '12px 15px', fontSize: '1.2rem', 
                  background: 'transparent', border: '1px solid #555', 
                  color: 'white', borderRadius: '6px', boxSizing: 'border-box',
                  outline: 'none', fontFamily: 'inherit'
                }}
              />
              <div style={{ marginTop: '10px', fontSize: '1.1rem', fontWeight: 'bold', color: change >= 0 ? '#a3e635' : '#ef4444' }}>
                Cambio: ${change >= 0 ? change.toFixed(2) : '0.00'}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#9ca3af', textAlign: 'center', margin: 0, fontSize: '0.95rem' }}>
                Procesa el pago en tu terminal bancaria y confirma.
              </p>
            </div>
          )}
        </div>

        {/* Botones de Acción */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
          <button 
            onClick={onClose} 
            style={{ 
              width: '140px', padding: '12px', background: 'white', 
              border: 'none', borderRadius: '8px', color: 'black', 
              fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem' 
            }}
          >
            Cancelar
          </button>
          <button 
            onClick={handleConfirm}
            disabled={method === 'efectivo' && numericReceived < total}
            style={{ 
              width: '140px', padding: '12px', background: '#00E676', 
              border: 'none', borderRadius: '8px', color: 'black', 
              fontWeight: 'bold', cursor: (method === 'efectivo' && numericReceived < total) ? 'not-allowed' : 'pointer', 
              opacity: (method === 'efectivo' && numericReceived < total) ? 0.5 : 1,
              fontFamily: 'inherit', fontSize: '1rem',
              transition: 'opacity 0.2s'
            }}
          >
            Confirmar
          </button>
        </div>
      </div>

      <style>{`
        /* Animación de entrada suave para el Modal */
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        /* Ocultar flechas del input number nativo */
        input[type="number"]::-webkit-inner-spin-button, 
        input[type="number"]::-webkit-outer-spin-button { 
          -webkit-appearance: none; margin: 0; 
        }
      `}</style>
    </div>
  )
}