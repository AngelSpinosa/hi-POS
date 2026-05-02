import { useEffect, useState } from 'react'

interface TicketReceiptProps {
  orderId: number;
  items: any[];
  total: number;
  payment?: {
    method: string;
    amount: number;
    change: number;
  };
  onClose: () => void;
  onPrint: () => void;
}

export function TicketReceipt({ orderId, items, total, payment, onClose, onPrint }: TicketReceiptProps) {
  // Estado para guardar el nombre real del negocio
  const [businessName, setBusinessName] = useState('POS PIZZERÍA');

  useEffect(() => {
    // Apenas se abre el ticket, vamos a buscar el nombre que el usuario configuró
    // @ts-ignore
    window.electron.ipcRenderer.invoke('get-app-config')
      .then(res => {
        if (res.success && res.data && res.data.business_name) {
          setBusinessName(res.data.business_name);
        }
      })
      .catch(err => console.error("Error cargando nombre del negocio:", err));
  }, []);

  // Protección 1: Si items llega vacío por algún error de renderizado, usamos un array vacío
  const safeItems = items || [];

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 4000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: '#fff', color: '#000', padding: '30px', width: '320px', fontFamily: 'monospace', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        
        {/* NOMBRE DEL NEGOCIO DINÁMICO */}
        <h2 style={{ textAlign: 'center', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '1.4rem' }}>
          {businessName}
        </h2>
        <div style={{ textAlign: 'center', marginBottom: '20px', fontSize: '0.9rem', color: '#555' }}>
          Ticket #{orderId} <br/>
          {new Date().toLocaleString('es-MX')}
        </div>
        
        <div style={{ borderTop: '2px dashed #000', borderBottom: '2px dashed #000', padding: '10px 0', margin: '10px 0' }}>
          <table style={{ width: '100%', fontSize: '0.95rem' }}>
            <tbody>
              {safeItems.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ paddingBottom: '8px', verticalAlign: 'top', width: '30px' }}>{item.cantidad}x</td>
                  <td style={{ paddingBottom: '8px' }}>{item.nombre}</td>
                  <td style={{ textAlign: 'right', paddingBottom: '8px', verticalAlign: 'top' }}>${(item.precio * item.cantidad).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div style={{ fontSize: '1.3rem', fontWeight: 'bold', textAlign: 'right', margin: '15px 0' }}>
          TOTAL: ${total.toFixed(2)}
        </div>

        {/* PROTECCIÓN 2: Si es un ticket pagado, muestra el desglose. Si es solo "solicitar cuenta", no explota */}
        {payment && payment.amount !== undefined ? (
          <div style={{ fontSize: '1rem', marginBottom: '20px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Método:</span>
              <span style={{ textTransform: 'capitalize' }}>{payment.method}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Recibido:</span>
              <span>${Number(payment.amount).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>Cambio:</span>
              <span>${Number(payment.change).toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', margin: '20px 0', fontWeight: 'bold', fontSize: '1.1rem', padding: '10px', background: '#f3f4f6', borderRadius: '5px' }}>
            *** CUENTA SOLICITADA ***
          </div>
        )}

        <div style={{ textAlign: 'center', color: '#555', fontSize: '0.8rem', marginTop: '20px', marginBottom: '20px' }}>
          ¡Gracias por su preferencia!
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>Cerrar</button>
          <button onClick={onPrint} style={{ flex: 1, padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>🖨️ Imprimir</button>
        </div>
      </div>
    </div>
  )
}