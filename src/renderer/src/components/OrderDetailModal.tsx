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
      backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 5000,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      backdropFilter: 'blur(5px)',
      fontFamily: 'var(--font-heading, monospace)'
    }} onClick={onClose}>
      
      <div style={{ 
        backgroundColor: '#111111', width: '450px', borderRadius: '16px', 
        padding: '30px', border: '1px solid #ffffff', color: 'white',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column',
        animation: 'fadeIn 0.2s ease-out', position: 'relative'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Botón de Cerrar (Rojo en esquina superior derecha) */}
        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute', top: '20px', right: '20px',
            background: '#ff0000', color: 'white', border: 'none', 
            borderRadius: '50%', width: '28px', height: '28px', 
            cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center',
            boxShadow: '0 2px 8px rgba(255, 0, 0, 0.4)', transition: 'transform 0.15s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        {/* Header y Línea Separadora */}
        <h2 style={{ margin: '0 0 20px 0', fontSize: '1.8rem', fontWeight: 'bold' }}>
          Detalle Orden #{orderId}
        </h2>
        <div style={{ width: '100%', height: '2px', backgroundColor: 'white', marginBottom: '15px' }}></div>

        {/* Lista de Productos */}
        <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                X {item.cantidad} {item.nombre}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                ${(item.precio * item.cantidad).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Footer y Línea Separadora (Total) */}
        <div style={{ width: '100%', height: '2px', backgroundColor: 'white', margin: '15px 0' }}></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Total</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#00E676' }}>
            ${total.toFixed(2)}
          </span>
        </div>

      </div>

      {/* Animación de entrada */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}