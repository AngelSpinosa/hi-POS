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
    <div className="ticket-section" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', backgroundColor: 'transparent', borderLeft: 'none', boxShadow: 'none', fontFamily: 'var(--font-heading, monospace)' }}>
      
      {/* Contenedor tipo "Tarjeta" basado en Figma */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #444', borderRadius: '16px', backgroundColor: '#111111', overflow: 'hidden' }}>
        
        {/* Header de la Orden */}
        <div style={{ padding: '25px 20px', textAlign: 'center', borderBottom: '1px solid #333' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '2.2rem', color: 'white', fontWeight: 'bold' }}>
            Orden #{orderId ? orderId.toString().padStart(4, '0') : '...'}
          </h2>
          <div style={{ fontSize: '1rem', color: '#00B4D8', fontWeight: 'bold' }}>
            {orderStatus === 'abierta' ? 'Abierta' : orderStatus.toUpperCase().replace('_', ' ')}
          </div>
        </div>
        
        {/* Lista de Artículos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          
          {/* Historial (Ya enviados) */}
          {historyItems.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ flex: 1, height: '1px', background: '#333' }}></div>
                <span style={{ padding: '0 15px', fontSize: '0.8rem', color: '#9ca3af', textTransform: 'uppercase' }}>Enviado a cocina</span>
                <div style={{ flex: 1, height: '1px', background: '#333' }}></div>
              </div>
              {historyItems.map((item, index) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: index === historyItems.length - 1 ? 'none' : '1px dashed #333', color: '#9ca3af', alignItems: 'center', animation: 'slideIn 0.2s ease' }}>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', minWidth: '30px' }}>{item.cantidad}x</span>
                    <span style={{ fontSize: '1rem' }}>{item.nombre}</span>
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>${(item.precio * item.cantidad).toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Por Enviar (Nuevos) */}
          {newItems.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ flex: 1, height: '1px', background: '#a3e635' }}></div>
                <span style={{ padding: '0 15px', fontSize: '0.8rem', color: '#a3e635', textTransform: 'none' }}>Por enviar</span>
                <div style={{ flex: 1, height: '1px', background: '#a3e635' }}></div>
              </div>
              
              {newItems.map((item, index) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px 0', borderBottom: index === newItems.length - 1 ? 'none' : '1px dashed #444', animation: 'slideIn 0.2s ease' }}>
                  
                  {/* Botón Eliminar Rojo */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRemove(item.id); }} 
                    style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#ff0000', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                  
                  {/* Controlador de Cantidad Personalizado (Resuelve el bug del scroll y flechas) */}
                  <div style={{ display: 'flex', alignItems: 'center', background: 'transparent', border: '1px solid #555', borderRadius: '6px', overflow: 'hidden', height: '32px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item.id, Math.max(1, item.cantidad - 1)); }}
                      style={{ width: '28px', height: '100%', background: '#222', color: 'white', border: 'none', borderRight: '1px solid #555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem' }}
                    >-</button>
                    <div style={{ width: '36px', textAlign: 'center', color: 'white', fontSize: '0.95rem', fontWeight: 'bold' }}>
                      {item.cantidad}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item.id, item.cantidad + 1); }}
                      style={{ width: '28px', height: '100%', background: '#222', color: 'white', border: 'none', borderLeft: '1px solid #555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem' }}
                    >+</button>
                  </div>
                  
                  {/* Detalles Platillo */}
                  <div style={{ flex: 1, fontSize: '1rem', color: 'white', lineHeight: '1.2' }}>{item.nombre}</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'white' }}>${(item.precio * item.cantidad).toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}

          {cart.length === 0 && (
            <div style={{ textAlign: 'center', color: '#6b7280', margin: '40px 0', fontSize: '0.9rem' }}>La orden está vacía</div>
          )}
        </div>

        {/* Footer (Total y Botones) */}
        <div style={{ padding: '25px', borderTop: '1px solid #444', background: '#111111' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'white' }}>Total:</span>
            <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#00E676' }}>${total.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {newItems.length > 0 && (
              <button 
                onClick={onGenerateCommand} 
                style={{ width: '100%', padding: '14px', background: '#00B4D8', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', fontSize: '0.9rem' }}
              >
                GENERAR COMANDA
              </button>
            )}
            
            {newItems.length === 0 && historyItems.length > 0 && orderStatus !== 'cuenta_solicitada' && (
              <button 
                onClick={onRequestBill} 
                style={{ width: '100%', padding: '14px', background: '#FCA311', color: 'black', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', fontSize: '0.9rem' }}
              >
                SOLICITAR CUENTA
              </button>
            )}
            
            {(orderStatus === 'cuenta_solicitada') && (
              <button 
                onClick={onFinalizePayment} 
                style={{ width: '100%', padding: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', fontSize: '0.9rem' }}
              >
                COBRAR Y CERRAR MESA
              </button>
            )}
            
            {/* BOTÓN DE CANCELAR - Estilo Sólido Rojo como en Figma */}
            <button 
              onClick={() => {
                if(confirm('¿Estás seguro de CANCELAR esta mesa? Se perderá el pedido y se liberará la mesa.')) {
                  onCancelOrder()
                }
              }}
              style={{ width: '100%', padding: '14px', background: '#ff0000', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'none', fontSize: '0.9rem' }}
            >
              Cancelar orden
            </button>
          </div>
        </div>
        
      </div>
    </div>
  )
}