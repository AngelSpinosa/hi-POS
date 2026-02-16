import { useEffect, useState } from 'react'
import type { Producto, Mesa } from '../types/db'
import { OrderCart } from '../components/OrderCart'
import { PaymentModal } from '../components/PaymentModal'
import { TicketReceipt } from '../components/TicketReceipt'
import { PinPadModal } from '../components/PinPadModal'
import { useActiveOrder } from '../hooks/useActiveOrder'

// Componente KitchenCommand local (para no exportarlo si no se usa fuera)
// eslint-disable-next-line react/prop-types
function KitchenCommand({ items, tableNum, onClose }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: '#fff', color: '#000', padding: '20px', width: '250px', fontFamily: 'monospace' }}>
        <h3 style={{ textAlign: 'center', borderBottom: '2px dashed #000' }}>COCINA - MESA {tableNum}</h3>
        {/* eslint-disable-next-line react/prop-types */}
        {items.map((item, idx) => (
          <div key={idx} style={{ fontSize: '1.2rem', margin: '10px 0' }}>[ ] {item.cantidad} x {item.nombre}</div>
        ))}
        <div style={{ borderTop: '2px dashed #000', marginTop: '20px', paddingTop: '10px', textAlign: 'center' }}>{new Date().toLocaleTimeString()}</div>
        <button onClick={onClose} style={{ marginTop: '20px', width: '100%', padding: '10px', background: 'black', color: 'white', border: 'none', cursor: 'pointer' }}>CERRAR</button>
      </div>
    </div>
  )
}

interface POSViewProps {
  tableId: number;
  tableNumber: number;
  onBack: () => void;
}

export function POSView({ tableId, tableNumber, onBack }: POSViewProps) {
  const [products, setProducts] = useState<Producto[]>([])
  
  // Usamos nuestro Hook personalizado para toda la lógica
  const order = useActiveOrder()
  
  // Estado local para cancelación segura
  const [isCancelPinOpen, setIsCancelPinOpen] = useState(false)

  // Cargar productos y la orden al montar
  useEffect(() => {
    const init = async () => {
      // @ts-ignore
      const prods = await window.electron.ipcRenderer.invoke('get-products')
      setProducts(prods)
      // Cargar la orden de la mesa
      await order.loadOrder(tableId)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const total = order.cart.reduce((sum: number, item) => sum + item.precio * item.cantidad, 0)

  // Wrappers para acciones que requieren cerrar o volver
  const handlePayment = async (method: 'efectivo' | 'tarjeta', received: number) => {
    const success = await order.payOrder(method, received)
    // No volvemos automáticamente aquí, esperamos a cerrar el ticket
  }

  const handleTicketClose = () => {
    order.setTicketData(null)
    // Si no es un pre-ticket (pendiente), significa que ya pagó -> Volver
    if (order.ticketData?.payment.method !== 'PENDIENTE') {
      onBack()
    }
  }

  // Lógica de cancelación con PIN
  const requestCancel = () => setIsCancelPinOpen(true)
  
  const handleCancelVerify = async (pin: string) => {
    if (!order.activeOrderId) return
    // Validamos PIN en backend directo con la acción de cancelar
    // @ts-ignore
    const result = await window.electron.ipcRenderer.invoke('cancel-order', { orderId: order.activeOrderId, pin })
    
    if (result.success) {
      setIsCancelPinOpen(false)
      onBack() // Éxito, volvemos a mesas
    } else {
      alert('Error: ' + result.error)
    }
  }

  return (
    <div className="pos-container">
      {/* Header Navegación */}
      <div style={{ position: 'absolute', top: 10, left: 20, zIndex: 100 }}>
        <button onClick={onBack} style={{ padding: '10px 20px', background: '#404040', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          ← Volver a Mesas
        </button>
        <span style={{ marginLeft: '20px', color: 'white', fontWeight: 'bold' }}>Mesa #{tableNumber}</span>
      </div>

      <div className="products-section" style={{ paddingTop: '60px' }}>
        <h2>Menú</h2>
        <div className="products-grid">
          {products.map((product) => (
            <div key={product.id} className="product-card" onClick={() => order.addToCart(product)}>
              <h3>{product.nombre}</h3>
              <div className="product-price">${product.precio.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="ticket-section" style={{ paddingTop: '60px' }}>
        <OrderCart 
          cart={order.cart} total={total} orderId={order.activeOrderId}
          onPay={() => {}} 
          onRemove={order.removeFromCart} onUpdateQuantity={order.updateQuantity}
          onGenerateCommand={() => order.generateCommand(tableNumber)} 
          onRequestBill={order.requestBill}
          onFinalizePayment={() => order.setIsPaymentModalOpen(true)}
          onCancelOrder={requestCancel} 
          orderStatus={order.orderStatus}
        />
      </div>

      <PaymentModal 
        isOpen={order.isPaymentModalOpen} total={total}
        onClose={() => order.setIsPaymentModalOpen(false)} onConfirmPayment={handlePayment}
      />

      {/* Modales de Feedback */}
      {order.kitchenData && (
        <KitchenCommand items={order.kitchenData.items} tableNum={order.kitchenData.tableNum} onClose={() => order.setKitchenData(null)} />
      )}

      {order.ticketData && (
        <TicketReceipt 
          {...order.ticketData}
          onClose={handleTicketClose}
          onPrint={handleTicketClose}
        />
      )}

      {/* Modal de PIN para Cancelar (Local de esta vista) */}
      <PinPadModal
        title="Autorizar Cancelación 🗑️"
        isOpen={isCancelPinOpen}
        onClose={() => setIsCancelPinOpen(false)}
        onVerify={handleCancelVerify}
      />
    </div>
  )
}