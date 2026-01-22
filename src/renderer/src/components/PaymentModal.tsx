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
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <h2 style={{ marginTop: 0, color: 'white' }}>Cobrar ${total.toFixed(2)}</h2>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button 
            style={{ flex: 1, padding: '10px', background: method === 'efectivo' ? '#e74c3c' : '#404040', color: 'white', border: 'none', cursor: 'pointer' }}
            onClick={() => { setMethod('efectivo'); inputRef.current?.focus(); }}
          >
            Efectivo
          </button>
          <button 
             style={{ flex: 1, padding: '10px', background: method === 'tarjeta' ? '#e74c3c' : '#404040', color: 'white', border: 'none', cursor: 'pointer' }}
             onClick={() => setMethod('tarjeta')}
          >
            Tarjeta
          </button>
        </div>

        {method === 'efectivo' && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', color: '#a3a3a3' }}>Monto Recibido</label>
            <input 
              ref={inputRef} // 3. Conectamos la referencia aquí
              type="number" 
              min="0"
              value={received}
              onKeyDown={preventInvalidChars}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '10px', fontSize: '1.5em', background: '#1a1a1a', border: '1px solid #404040', color: 'white' }}
            />
            <div style={{ marginTop: '10px', fontSize: '1.2em', color: change >= 0 ? '#22c55e' : '#e74c3c' }}>
              Cambio: ${change >= 0 ? change.toFixed(2) : '0.00'}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #666', color: 'white', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button 
            onClick={handleConfirm}
            disabled={method === 'efectivo' && numericReceived < total}
            style={{ padding: '10px 20px', background: '#22c55e', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer', opacity: (method === 'efectivo' && numericReceived < total) ? 0.5 : 1 }}
          >
            CONFIRMAR PAGO
          </button>
        </div>
      </div>
    </div>
  )
}