import type { CartItem } from '../types/db'

interface OrderDetailModalProps {
  orderId: number;
  items: CartItem[];
  pagos?: { metodo: string; monto_recibido: number; cambio: number }[];
  onClose: () => void;
}

export function OrderDetailModal({ orderId, items, pagos, onClose }: OrderDetailModalProps) {
  const total = items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

  return (
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 6000,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        fontFamily: 'monospace'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#111', color: 'white', padding: '30px', 
          borderRadius: '12px', width: '350px', border: '1px solid #333',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Detalle Orden #{orderId}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>
        
        <div style={{ borderTop: '2px dashed #444', borderBottom: '2px dashed #444', padding: '15px 0', margin: '15px 0' }}>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '1rem' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>{item.cantidad}x</span>
                <span>{item.nombre}</span>
              </div>
              <span>${(item.precio * item.cantidad).toFixed(2)}</span>
            </div>
          ))}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', color: '#00E676', marginBottom: '20px' }}>
          <span>TOTAL</span>
          <span>${total.toFixed(2)}</span>
        </div>

        {/* SECCIÓN DE PAGOS QUE DESGLOSA LA DIVISIÓN */}
        {pagos && pagos.length > 0 && (
          <div style={{ background: '#1a1a1a', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#9ca3af', fontSize: '0.9rem', textTransform: 'uppercase' }}>Pagos Registrados:</h4>
            {pagos.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.95rem' }}>
                <span style={{ textTransform: 'capitalize' }}>✅ {p.metodo}</span>
                <span>${p.monto_recibido.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}