import type { CartItem } from '../types/db'

interface OrderCartProps {
  cart: CartItem[];
  total: number;
  orderId: number | null; // <--- NUEVA PROP
  onPay: () => void;
  // Nuevas props recibidas
  onRemove: (id: number) => void;
  onUpdateQuantity: (id: number, qty: number) => void;
}

export function OrderCart({ cart, total, orderId, onPay, onRemove, onUpdateQuantity }: OrderCartProps) {
  return (
    <div className="ticket-section">
      <div className="ticket-header">
        Orden #{orderId ? orderId.toString().padStart(4, '0') : '...'}
      </div>
      
      <div className="ticket-items">
        {cart.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>
            Ticket vacío
          </p>
        ) : (
          cart.map((item) => (
            <div key={item.id} className="ticket-item" style={{ alignItems: 'center', gap: '10px' }}>
              
              {/* 1. Botón de Eliminar (X roja) */}
              <button 
                onClick={(e) => {
                  e.stopPropagation(); // Evita clicks fantasma
                  onRemove(item.id);
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid #e74c3c',
                  color: '#e74c3c',
                  borderRadius: '4px',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
                title="Eliminar producto"
              >
                ✕
              </button>

              {/* 2. Input de Cantidad */}
              <input 
                type="number" 
                min="1"
                value={item.quantity}
                onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '45px',
                  padding: '4px',
                  background: '#1a1a1a',
                  border: '1px solid #404040',
                  color: 'white',
                  borderRadius: '4px',
                  textAlign: 'center'
                }}
              />

              {/* Nombre y Precio */}
              <div style={{ flex: 1, marginLeft: '5px' }}>
                {item.nombre}
              </div>
              
              <div style={{ fontWeight: 'bold' }}>
                ${(item.precio * item.quantity).toFixed(2)}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="ticket-footer">
        <div className="total-row">
          <span>Total:</span>
          <span>${total.toFixed(2)}</span>
        </div>
        <button 
          className="pay-btn" 
          disabled={cart.length === 0}
          onClick={onPay}
        >
          COBRAR
        </button>
      </div>
    </div>
  )
}