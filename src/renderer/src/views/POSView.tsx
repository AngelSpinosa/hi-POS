import { useEffect, useState } from 'react'
// Importamos el tipo base Producto
import type { Producto } from '../types/db'
import { OrderCart } from '../components/OrderCart'
import { PaymentModal } from '../components/PaymentModal'
import { TicketReceipt } from '../components/TicketReceipt'
import { PinPadModal } from '../components/PinPadModal'
import { useActiveOrder } from '../hooks/useActiveOrder'

// Definimos un tipo local que extiende Producto para incluir la propiedad dinámica del backend
export interface ProductoPOS extends Producto {
  disponible?: boolean;
}

// Componente KitchenCommand local
// eslint-disable-next-line react/prop-types
function KitchenCommand({ items, tableNum, onClose }: any) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: '#fff', color: '#000', padding: '20px', width: '250px', fontFamily: 'monospace' }}>
        <h3 style={{ textAlign: 'center', borderBottom: '2px dashed #000' }}>COCINA - MESA {tableNum}</h3>
        {/* eslint-disable-next-line react/prop-types */}
        {items.map((item: any, idx: number) => (
          <div key={idx} style={{ fontSize: '1.2rem', margin: '10px 0' }}>[ ] {item.cantidad} x {item.nombre}</div>
        ))}
        <button onClick={onClose} style={{ width: '100%', marginTop: '20px', padding: '10px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer' }}>OK</button>
      </div>
    </div>
  )
}

interface POSViewProps {
  tableId: number;
  userId?: number;
  onBack: () => void;
}

export function POSView({ tableId, userId, onBack }: POSViewProps) {
  const order = useActiveOrder(tableId, userId)
  // Usamos ProductoPOS en lugar de Producto para permitir la propiedad 'disponible'
  const [products, setProducts] = useState<ProductoPOS[]>([])
  
  // Estado para cancelar
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)

  // NUEVO: Estado para el reloj
  const [currentTime, setCurrentTime] = useState(new Date())

  // NUEVO: Efecto del reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    // LLamamos al nuevo endpoint que cruza productos con recetas e insumos
    // @ts-ignore
    window.electron.ipcRenderer.invoke('get-productos-pos').then((res) => {
      if (Array.isArray(res)) setProducts(res.filter(p => p.active === 1))
    })
  }, [])

  const total = order.cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0)

  const handlePaymentConfirm = async (method: 'efectivo' | 'tarjeta', received: number) => {
    await order.processPayment(method, received, total)
  }

  // Activa el modal del PIN al dar clic en cancelar en el carrito
  const requestCancel = () => setIsCancelModalOpen(true)

  // Recibe el PIN y ejecuta la cancelación
  const handleCancelConfirm = async (pin: string) => {
    const success = await order.cancelOrder(pin)
    if (success) {
      setIsCancelModalOpen(false)
      onBack() 
    }
  }

  // Declaramos la función para limpiar el ticket y regresar al mapa
  const handleTicketClose = () => {
    order.setTicketData(null)
    onBack() 
  }

  // NUEVO: Formateo de fecha y hora idéntico al Dashboard
  const timeString = currentTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
  const dateString = currentTime.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const formattedDate = dateString.replace(/\b\w/g, l => l.toUpperCase())

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#111', color: 'white' }}>
      
      {/* SECCIÓN IZQUIERDA: Menú de Productos */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', backgroundColor: '#1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
          <button onClick={onBack} style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}>
            ← Volver al Mapa
          </button>
          <h2 style={{ margin: 0, color: '#f97316' }}>Mesa {tableId}</h2>
          
          {/* NUEVO: Contenedor de la Hora, reemplaza al div vacío anterior */}
          <div style={{ textAlign: 'right', color: '#9ca3af', minWidth: '100px' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>{timeString}</div>
            <div style={{ fontSize: '0.8rem' }}>{formattedDate}</div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
            {products.map((product) => {
              // Verificamos si hay stock (el backend lo precalculó en product.disponible)
              // Asumimos true si por alguna razón no viene el valor para no romper productos sin receta
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
                  {/* Etiqueta de agotado */}
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

      {/* SECCIÓN DERECHA: Carrito de Compras */}
      <div style={{ width: '380px', backgroundColor: '#1a1a1a', borderLeft: '1px solid #333', padding: '20px' }}>
        <OrderCart 
          cart={order.cart} 
          total={total} 
          orderId={order.activeOrderId}
          onPay={() => {}} 
          onRemove={order.removeFromCart} 
          onUpdateQuantity={order.updateQuantity}
          onGenerateCommand={() => order.generateCommand(tableId)} 
          onRequestBill={order.requestBill}
          onFinalizePayment={() => order.setIsPaymentModalOpen(true)}
          onCancelOrder={requestCancel} 
          orderStatus={order.orderStatus}
        />
      </div>

      {/* MODALES */}
      <PaymentModal 
        isOpen={order.isPaymentModalOpen} 
        total={total}
        onClose={() => order.setIsPaymentModalOpen(false)} 
        onConfirmPayment={handlePaymentConfirm}
      />

      {order.kitchenData && (
        <KitchenCommand items={order.kitchenData.items} tableNum={order.kitchenData.tableNum} onClose={() => order.setKitchenData(null)} />
      )}

      {order.ticketData && (
        <TicketReceipt 
          orderId={order.ticketData.orderId}
          items={order.ticketData.items}
          total={order.ticketData.total}
          payment={order.ticketData.payment as any}
          onClose={handleTicketClose}
          onPrint={handleTicketClose}
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