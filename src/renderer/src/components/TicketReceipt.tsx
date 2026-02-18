import type { CartItem } from '../types/db'

interface TicketReceiptProps {
  orderId: number;
  items: CartItem[]; 
  total: number;
  payment: {
    method: string;
    received: number;
    change: number;
  };
  onClose: () => void;
  onPrint: () => void;
}

export function TicketReceipt({ orderId, items, total, payment, onClose, onPrint }: TicketReceiptProps) {
  const date = new Date().toLocaleString('es-MX');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 3000,
      animation: 'fadeIn 0.2s'
    }}>
      <div style={{
        backgroundColor: '#fff',
        color: '#000',
        width: '300px',
        padding: '20px',
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '14px',
        boxShadow: '0 0 20px rgba(0,0,0,0.5)',
        maxHeight: '90vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* CABECERA */}
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <h2 style={{ margin: '0 0 5px 0', fontSize: '18px', textTransform: 'uppercase' }}>POS Pizza</h2>
          <div style={{ fontSize: '12px' }}>Av. Siempre Viva 123</div>
          <div style={{ fontSize: '12px' }}>Col. Centro, CP 91000</div>
          <div style={{ fontSize: '12px' }}>Tel: 555-123-4567</div>
          <br />
          <div style={{ fontWeight: 'bold' }}>ORDEN #{orderId.toString().padStart(4, '0')}</div>
          <div style={{ fontSize: '11px' }}>{date}</div>
        </div>

        {/* SEPARADOR */}
        <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }}></div>

        {/* ITEMS */}
        <div style={{ marginBottom: '10px' }}>
          {items.map((item, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ flex: 1 }}>
                {/* CORREGIDO: cantidad en lugar de quantity */}
                {item.cantidad} x {item.nombre}
              </div>
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                ${(item.precio * item.cantidad).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* SEPARADOR */}
        <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }}></div>

        {/* TOTALES */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', margin: '5px 0' }}>
          <span>TOTAL:</span>
          <span>${total.toFixed(2)}</span>
        </div>

        <div style={{ fontSize: '12px', marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Pago ({payment.method}):</span>
            <span>${payment.received.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span>Cambio:</span>
            <span>${payment.change.toFixed(2)}</span>
          </div>
        </div>

        {/* PIE DE PÁGINA */}
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px' }}>
          <p>¡Gracias por su preferencia!</p>
          <p>Este no es un comprobante fiscal</p>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', borderTop: '2px solid #000', paddingTop: '15px' }}>
          <button 
            onClick={onClose}
            style={{ flex: 1, padding: '10px', border: '1px solid #000', background: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}
          >
            CERRAR
          </button>
          <button 
            onClick={onPrint}
            style={{ flex: 1, padding: '10px', border: 'none', background: '#000', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
          >
            IMPRIMIR
          </button>
        </div>

      </div>
    </div>
  )
}