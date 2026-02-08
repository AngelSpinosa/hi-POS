import type { CartItem } from '../types/db'

interface OrderCartProps {
  cart: CartItem[];
  total: number;
  orderId: number | null;
  onPay: () => void; 
  onRemove: (id: number) => void;
  onUpdateQuantity: (id: number, qty: number) => void;
  onGenerateCommand: () => void;
  onRequestBill: () => void;
  onFinalizePayment: () => void;
  onCancelOrder: () => void; // <--- NUEVA PROP
  orderStatus: string;
}

export function OrderCart({ 
  cart, total, orderId, 
  onRemove, onUpdateQuantity, 
  onGenerateCommand, onRequestBill, onFinalizePayment, onCancelOrder,
  orderStatus
}: OrderCartProps) {

  const newItems = cart.filter(item => item.comanda_impresa === 0);
  const historyItems = cart.filter(item => item.comanda_impresa === 1);

  return (
    <div className="ticket-section" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="ticket-header" style={{ flexShrink: 0 }}>
        Orden #{orderId ? orderId.toString().padStart(4, '0') : '...'}
        <div style={{ fontSize: '0.8rem', fontWeight: 'normal', opacity: 0.8 }}>
          {orderStatus.toUpperCase().replace('_', ' ')}
        </div>
      </div>
      
      <div className="ticket-items" style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {historyItems.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #4b5563', marginBottom: '5px' }}>
              Enviado a Cocina
            </div>
            {historyItems.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', color: '#9ca3af' }}>
                <div><strong>{item.cantidad}x</strong> {item.nombre}</div>
                <div>${(item.precio * item.cantidad).toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}

        {newItems.length > 0 && (
          <div>
            <div style={{ fontSize: '0.8rem', color: '#fbbf24', textTransform: 'uppercase', borderBottom: '1px solid #fbbf24', marginBottom: '5px' }}>
              Por Enviar
            </div>
            {newItems.map((item) => (
              <div key={item.id} className="ticket-item" style={{ alignItems: 'center', gap: '10px' }}>
                <button onClick={(e) => { e.stopPropagation(); onRemove(item.id); }} className="delete-btn" style={{ background: 'transparent', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                <input type="number" min="1" value={item.cantidad} onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value) || 1)} onClick={(e) => e.stopPropagation()} style={{ width: '40px', padding: '4px', background: '#1a1a1a', border: '1px solid #404040', color: 'white', borderRadius: '4px', textAlign: 'center' }} />
                <div style={{ flex: 1, marginLeft: '5px' }}>{item.nombre}</div>
                <div style={{ fontWeight: 'bold' }}>${(item.precio * item.cantidad).toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
        {cart.length === 0 && <div style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>Ticket vacío</div>}
      </div>

      <div className="ticket-footer" style={{ flexShrink: 0 }}>
        <div className="total-row">
          <span>Total:</span><span>${total.toFixed(2)}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {newItems.length > 0 && (
            <button onClick={onGenerateCommand} style={{ width: '100%', padding: '15px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>GENERAR COMANDA 👨‍🍳</button>
          )}
          {newItems.length === 0 && historyItems.length > 0 && orderStatus !== 'cuenta_solicitada' && (
            <button onClick={onRequestBill} style={{ width: '100%', padding: '15px', background: '#eab308', color: 'black', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>SOLICITAR CUENTA 📄</button>
          )}
          {(orderStatus === 'cuenta_solicitada') && (
            <button onClick={onFinalizePayment} style={{ width: '100%', padding: '15px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>COBRAR Y CERRAR MESA 💰</button>
          )}
          
          {/* BOTÓN DE CANCELAR - SIEMPRE VISIBLE SI HAY ORDEN */}
          <button 
            onClick={() => {
              if(confirm('¿Estás seguro de CANCELAR esta mesa? Se perderá el pedido y se liberará la mesa.')) {
                onCancelOrder()
              }
            }}
            style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '5px', fontSize: '0.8rem', cursor: 'pointer', marginTop: '5px' }}
          >
            CANCELAR MESA Y LIBERAR 🗑️
          </button>
        </div>
      </div>
    </div>
  )
}