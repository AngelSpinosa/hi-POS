import type { CartItem } from '../types/db'

interface OrderDetailModalProps {
  orderId: number;
  items: CartItem[];
  onClose: () => void;
}

export function OrderDetailModal({ orderId, items, onClose }: OrderDetailModalProps) {
  const total = items.reduce((sum, i) => sum + i.precio * i.cantidad, 0)

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 4000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }} onClick={onClose}>
      <div style={{ 
        backgroundColor: '#262626', width: '400px', borderRadius: '10px', 
        padding: '20px', border: '1px solid #404040', color: 'white' 
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0 }}>Detalle Orden #{orderId}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        <div style={{ maxHeight: '400px', overflowY: 'auto', borderTop: '1px solid #404040', borderBottom: '1px solid #404040', padding: '10px 0' }}>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <div>{item.cantidad} x {item.nombre}</div>
              <div>${(item.precio * item.cantidad).toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '1.2rem', fontWeight: 'bold' }}>
          <span>Total</span>
          <span style={{ color: '#22c55e' }}>${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}