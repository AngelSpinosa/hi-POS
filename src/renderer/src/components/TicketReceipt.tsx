import type { CartItem } from '../types/db'

interface TicketReceiptProps {
  orderId: number;
  items: CartItem[];
  total: number;
  pagos: { metodo: string; monto: number; cambio: number }[];
  cajero?: string;
  onClose: () => void;
  onPrint: () => void;
}

export function TicketReceipt({ orderId, items, total, pagos, cajero, onClose, onPrint }: TicketReceiptProps) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 6000, display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace' }}>
      <div style={{ backgroundColor: '#f3f4f6', color: '#000', padding: '30px', width: '320px', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        
        <h2 style={{ textAlign: 'center', margin: '0 0 10px 0', fontSize: '1.5rem' }}>MI NEGOCIO POS</h2>
        <div style={{ textAlign: 'center', marginBottom: '20px', fontSize: '0.9rem' }}>
          Ticket #{orderId}<br/>
          Mesero: {cajero || 'Admin'}<br/>
          {new Date().toLocaleString('es-MX')}
        </div>
        
        {/* Productos */}
        <div style={{ borderTop: '2px dashed #000', borderBottom: '2px dashed #000', padding: '15px 0', margin: '15px 0' }}>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.95rem' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>{item.cantidad}x</span>
                <span>{item.nombre}</span>
              </div>
              <span>${(item.precio * item.cantidad).toFixed(2)}</span>
            </div>
          ))}
        </div>
        
        <div style={{ textAlign: 'right', fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '20px' }}>
          TOTAL: ${total.toFixed(2)}
        </div>
        
        {/* Desglose de Pagos (Soporta pagos mixtos) */}
        <div style={{ borderTop: '2px dashed #000', paddingTop: '15px', marginBottom: '20px' }}>
          {pagos && pagos.map((pago, idx) => (
            <div key={idx} style={{ marginBottom: '10px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ textTransform: 'uppercase' }}>PAGO {pagos.length > 1 ? idx + 1 : ''} ({pago.metodo})</span>
                <span>${pago.monto.toFixed(2)}</span>
              </div>
              {pago.metodo === 'efectivo' && pago.cambio > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4b5563' }}>
                  <span>Cambio</span>
                  <span>${pago.cambio.toFixed(2)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Controles del Modal */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: '#111', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
            Cerrar
          </button>
          <button onClick={onPrint} style={{ flex: 1, padding: '12px', background: '#00B4D8', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
            Imprimir (PDF)
          </button>
        </div>

      </div>
    </div>
  )
}