import { useEffect, useState } from 'react'
import type { Producto } from '../types/db'
import { OrderCart } from '../components/OrderCart'
import { PaymentModal, type PaymentData } from '../components/PaymentModal'
import { TicketReceipt } from '../components/TicketReceipt'
import { PinPadModal } from '../components/PinPadModal'
import { useTakeawayOrder } from '../hooks/useTakeawayOrder'
import { ScreenHeader } from '../components/ScreenHeader'

// eslint-disable-next-line react/prop-types
function KitchenCommand({ items, onClose }: any) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: '#fff', color: '#000', padding: '20px', width: '250px', fontFamily: 'monospace' }}>
        <h3 style={{ textAlign: 'center', borderBottom: '2px dashed #000' }}>COCINA - PARA LLEVAR</h3>
        {/* eslint-disable-next-line react/prop-types */}
        {items.map((item: any, idx: number) => (
          <div key={idx} style={{ fontSize: '1.2rem', margin: '10px 0' }}>[ ] {item.cantidad} x {item.nombre}</div>
        ))}
        <button onClick={onClose} style={{ width: '100%', marginTop: '20px', padding: '10px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer' }}>OK</button>
      </div>
    </div>
  )
}

interface TakeawayPOSViewProps {
  userId?: number;
  onBack: () => void;
}

export function TakeawayPOSView({ userId, onBack }: TakeawayPOSViewProps) {
  const order = useTakeawayOrder(userId)
  const [products, setProducts] = useState<Producto[]>([])
  const [businessName, setBusinessName] = useState('')
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)

  useEffect(() => {
    // Cargamos el nombre del negocio configurado, para que el ticket impreso
    // lo use en vez del valor por defecto "MI NEGOCIO POS"
    // @ts-ignore
    window.electron.ipcRenderer.invoke('get-app-config').then((res) => {
      if (res && res.success && res.data) {
        setBusinessName(res.data.business_name || '')
      }
    })
  }, [])

  useEffect(() => {
    // @ts-ignore
    window.electron.ipcRenderer.invoke('get-productos-pos').then((res) => {
      if (Array.isArray(res)) {
        // @ts-ignore
        setProducts(res.filter(p => p.active == 1 || p.active === true))
      }
    })
  }, [])

  const totalRestante = Math.max(0, order.orderTotal - order.totalPagado)

  const handlePaymentConfirm = async (paymentData: PaymentData) => {
    await order.processPayment(paymentData)
  }

  const requestCancel = () => setIsCancelModalOpen(true)

  const handleCancelConfirm = async (pin: string) => {
    const success = await order.cancelOrder(pin)
    if (success) {
      setIsCancelModalOpen(false)
      onBack()
    }
  }

  const handleTicketClose = () => {
    order.setTicketData(null)
    onBack()
  }

  const handlePrintTicket = async () => {
    if (order.ticketData) {
      try {
        // @ts-ignore
        const res = await window.electron.ipcRenderer.invoke('generate-ticket-pdf', {
          orderId: order.ticketData.orderId,
          items: order.ticketData.items,
          total: order.ticketData.total,
          subtotal: order.orderTotal + order.descuentoTotal,
          descuento: order.descuentoTotal,
          pagos: order.ticketData.pagos,
          cajero: order.ticketData.cajero,
          businessName: businessName
        })
        if (!res || !res.success) {
          alert('❌ Error al generar el ticket: ' + (res?.error || 'Desconocido'))
        }
      } catch (e) {
        console.error('Error al imprimir ticket:', e)
        alert('❌ Ocurrió un error al intentar imprimir el ticket.')
      }
    }
    handleTicketClose()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#111', color: 'white' }}>

      <ScreenHeader title={`Para llevar #${order.activeOrderId ? order.activeOrderId.toString().padStart(4, '0') : '...'}`} onBack={onBack} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* SECCIÓN IZQUIERDA: Menú de Productos */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
            {products.map((product) => {
              // @ts-ignore
              const isAvailable = product.disponible !== false;

              return (
                <div
                  key={product.id}
                  onClick={() => isAvailable && order.addToCart(product)}
                  style={{
                    position: 'relative',
                    background: isAvailable ? '#262626' : '#2a0c0c',
                    padding: '20px',
                    borderRadius: '15px',
                    cursor: isAvailable ? 'pointer' : 'not-allowed',
                    border: isAvailable ? '1px solid #404040' : '1px solid #7f1d1d',
                    textAlign: 'center',
                    transition: 'transform 0.1s',
                    opacity: isAvailable ? 1 : 0.5
                  }}
                  onMouseDown={e => isAvailable && (e.currentTarget.style.transform = 'scale(0.95)')}
                  onMouseUp={e => isAvailable && (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {!isAvailable && (
                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#dc2626', color: 'white', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.5)' }}>
                      AGOTADO
                    </div>
                  )}
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: isAvailable ? '#f3f4f6' : '#9ca3af' }}>{product.nombre}</h3>
                  <div style={{ color: isAvailable ? '#22c55e' : '#7f1d1d', fontWeight: 'bold', fontSize: '1.4rem' }}>${product.precio.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECCIÓN DERECHA: Carrito */}
      <div style={{ width: '380px', backgroundColor: '#1a1a1a', borderLeft: '1px solid #333', padding: '20px' }}>
        <OrderCart
          cart={order.cart}
          total={order.orderTotal}
          subtotal={order.orderTotal + order.descuentoTotal}
          descuento={order.descuentoTotal}
          orderId={order.activeOrderId}
          onPay={() => {}}
          onRemove={order.removeFromCart}
          onUpdateQuantity={order.updateQuantity}
          onGenerateCommand={order.generateCommand}
          onRequestBill={() => {}}
          onFinalizePayment={() => order.setIsPaymentModalOpen(true)}
          onCancelOrder={requestCancel}
          orderStatus={order.orderStatus}
          payButtonLabel="COBRAR"
        />
      </div>

      </div>

      {/* MODALES */}
      {order.kitchenData && (
        <KitchenCommand items={order.kitchenData.items} onClose={() => order.setKitchenData(null)} />
      )}

      <PaymentModal
        isOpen={order.isPaymentModalOpen}
        totalOriginal={order.orderTotal}
        totalRestante={totalRestante}
        cart={order.cart}
        onClose={() => order.setIsPaymentModalOpen(false)}
        onConfirmPayment={handlePaymentConfirm}
      />

      {order.ticketData && (
        <TicketReceipt
          orderId={order.ticketData.orderId}
          items={order.ticketData.items}
          total={order.ticketData.total}
          subtotal={order.orderTotal + order.descuentoTotal}
          descuento={order.descuentoTotal}
          pagos={order.ticketData.pagos}
          cajero={order.ticketData.cajero}
          onClose={handleTicketClose}
          onPrint={handlePrintTicket}
        />
      )}

      <PinPadModal
        title="Autorizar Cancelación 🗑️"
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onVerify={handleCancelConfirm}
      />
    </div>
  )
}