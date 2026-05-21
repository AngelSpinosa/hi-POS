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

const handlePrintPdf = async () => {
  // @ts-ignore
  const res = await window.electron.ipcRenderer.invoke('generate-ticket-pdf', {
    orderId,
    items: safeItems,
    total,
    payment,
    businessName
  });
  
  if (res.success) {
    onPrint(); // Llamamos a la función original que asumo cierra el modal o finaliza el flujo
  } else {
    console.error("Error al generar PDF:", res.error);
    alert("Hubo un error al crear el PDF del ticket.");
  }
};

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 6000,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      backdropFilter: 'blur(5px)',
      fontFamily: 'var(--font-heading, monospace)'
    }} onClick={onClose}>
      
      {/* Contenedor simulando Papel de Ticket */}
      <div style={{ 
        backgroundColor: '#E5E7EB', // Color gris claro/papel
        padding: '35px', 
        borderRadius: '16px', 
        width: '380px', 
        color: '#000000', // Texto negro oscuro simulando tinta
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        animation: 'fadeIn 0.2s ease-out'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Encabezado del Ticket */}
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '5px', textTransform: 'uppercase' }}>
            {businessName}
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>
            Ticket #{orderId}
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>
            {new Date().toLocaleString('es-MX')}
          </div>
        </div>

        {/* Línea Divisoria */}
        <div style={{ width: '100%', borderBottom: '2px dashed #000000', margin: '15px 0', opacity: 0.6 }}></div>

        {/* Lista de Productos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '5px 0', maxHeight: '250px', overflowY: 'auto', paddingRight: '5px' }}>
          {safeItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 'bold' }}>
              <div style={{ display: 'flex', gap: '15px' }}>
                <span style={{ minWidth: '25px' }}>{item.cantidad}x</span>
                <span>{item.nombre}</span>
              </div>
              <span>${(item.precio * item.cantidad).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Línea Divisoria */}
        <div style={{ width: '100%', borderBottom: '2px dashed #000000', margin: '15px 0', opacity: 0.6 }}></div>

        {/* TOTAL */}
        <div style={{ textAlign: 'right', fontSize: '1.3rem', fontWeight: 'bold', margin: '5px 0' }}>
          TOTAL: ${total.toFixed(2)}
        </div>

        {/* Línea Divisoria */}
        <div style={{ width: '100%', borderBottom: '2px dashed #000000', margin: '15px 0', opacity: 0.6 }}></div>

        {/* Detalles de Pago o Cuenta Solicitada */}
        {payment && payment.amount !== undefined ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.95rem', fontWeight: 'bold', margin: '5px 0 25px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Método</span>
              <span style={{ textTransform: 'capitalize' }}>{payment.method}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Recibido</span>
              <span>${Number(payment.amount).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Cambio</span>
              <span>${Number(payment.change).toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', margin: '10px 0 25px 0', fontWeight: 'bold', fontSize: '1.1rem', padding: '10px', background: '#d1d5db', borderRadius: '8px' }}>
            *** CUENTA SOLICITADA ***
          </div>
        )}

        {/* Botones de Acción */}
        <div style={{ display: 'flex', gap: '15px' }}>
          <button 
            onClick={onClose} 
            style={{ 
              flex: 1, padding: '14px', background: '#111111', color: 'white', 
              border: 'none', borderRadius: '10px', fontWeight: 'bold', 
              cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem',
              transition: 'transform 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(0.97)'}
          >
            Cerrar
          </button>
          <button 
              onClick={handlePrintPdf} // <- Reemplaza onPrint por handlePrintPdf aquí
              style={{ 
                flex: 1, padding: '14px', background: '#00B4D8', color: 'black', 
                border: 'none', borderRadius: '10px', fontWeight: 'bold', 
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem',
                transition: 'transform 0.15s ease'
              }}>
              Imprimir (PDF)
          </button>
        </div>

      </div>

      {/* Animación global del modal */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}