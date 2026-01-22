import { useEffect, useState, useCallback } from 'react'
import type { Producto, CartItem } from './types/db'
import { OrderCart } from './components/OrderCart'
import { PaymentModal } from './components/PaymentModal'

function App() {
  const [products, setProducts] = useState<Producto[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [successData, setSuccessData] = useState<{ change: number, orderId: number } | null>(null)

  const fetchActiveOrder = useCallback(async () => {
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('get-active-order')
      if (result.success) {
        setActiveOrderId(result.order.id)
        setCart(result.items)
      }
    } catch (error) {
      console.error('Error recuperando orden:', error)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        // @ts-ignore
        const items = await window.electron.ipcRenderer.invoke('get-products')
        setProducts(items)
        await fetchActiveOrder()
      } catch (error) {
        console.error('Error inicializando app:', error)
      }
    }
    init()
  }, [fetchActiveOrder])

  // --- ACCIONES OPTIMIZADAS (Actualización directa) ---

  const addToCart = async (product: Producto) => {
    if (!activeOrderId) return
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('add-to-cart', {
        orderId: activeOrderId,
        product
      })
      // Usamos directamente los items que devuelve el backend
      if (result.success && result.items) {
        setCart(result.items)
      }
    } catch (error) {
      console.error('Error agregando producto:', error)
    }
  }

  const removeFromCart = async (productId: number) => {
    if (!activeOrderId) return
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('remove-from-cart', {
        orderId: activeOrderId,
        productId
      })
      // Actualización inmediata
      if (result.success && result.items) {
        setCart(result.items)
      }
    } catch (error) {
      console.error('Error eliminando producto:', error)
    }
  }

  const updateQuantity = async (productId: number, newQuantity: number) => {
    if (!activeOrderId) return
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('update-quantity', {
        orderId: activeOrderId,
        productId,
        quantity: newQuantity
      })
      // Actualización inmediata
      if (result.success && result.items) {
        setCart(result.items)
      }
    } catch (error) {
      console.error('Error actualizando cantidad:', error)
    }
  }

  const total = cart.reduce((sum, item) => sum + item.precio * item.quantity, 0)

  const handlePaymentConfirm = async (method: 'efectivo' | 'tarjeta', received: number) => {
    if (!activeOrderId) return
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('pay-order', {
        orderId: activeOrderId,
        payment: { method, received },
        total
      })

      if (result.success) {
        const change = received - total
        setSuccessData({ change, orderId: activeOrderId })
        
        console.log('Venta completada. Orden ID:', activeOrderId)
        setIsPaymentModalOpen(false)
        await fetchActiveOrder() 
        setTimeout(() => setSuccessData(null), 3000)

      } else {
        alert(result.error || 'Error al procesar el pago.')
      }
    } catch (error) {
      console.error('Error de comunicación:', error)
    }
  }

  return (
    <div className="pos-container">
      {/* SECCIÓN IZQUIERDA: MENÚ */}
      <div className="products-section">
        <h2>Menú</h2>
        <div className="products-grid">
          {products.map((product) => (
            <div
              key={product.id}
              className="product-card"
              onClick={() => addToCart(product)}
            >
              <h3>{product.nombre}</h3>
              <div className="product-price">${product.precio.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SECCIÓN DERECHA: CARRITO */}
      <OrderCart 
        cart={cart} 
        total={total}
        orderId={activeOrderId}
        onPay={() => setIsPaymentModalOpen(true)} 
        onRemove={removeFromCart}
        onUpdateQuantity={updateQuantity}
      />

      {/* MODAL DE PAGO */}
      <PaymentModal 
        isOpen={isPaymentModalOpen}
        total={total}
        onClose={() => setIsPaymentModalOpen(false)}
        onConfirmPayment={handlePaymentConfirm}
      />

      {/* FEEDBACK VISUAL DE ÉXITO */}
      {successData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(5px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, color: 'white', animation: 'fadeIn 0.2s'
        }} onClick={() => setSuccessData(null)}>
          
          <div style={{ fontSize: '5rem', marginBottom: '10px' }}>✅</div>
          <h1 style={{ fontSize: '3rem', margin: 0, textShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
            ¡Venta Exitosa!
          </h1>
          <p style={{ fontSize: '1.5rem', color: '#d1d5db', marginTop: '10px' }}>
            Orden #{successData.orderId.toString().padStart(4, '0')} registrada
          </p>
          
          <div style={{ 
            marginTop: '30px', padding: '20px 40px', 
            backgroundColor: '#2d2d2d', borderRadius: '15px', 
            border: '2px solid #22c55e',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            textAlign: 'center' 
          }}>
            <div style={{ fontSize: '1.2rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Su Cambio
            </div>
            <div style={{ fontSize: '4rem', fontWeight: 'bold', color: '#22c55e', lineHeight: 1, marginTop: '5px' }}>
              ${successData.change.toFixed(2)}
            </div>
          </div>
          
          <p style={{ marginTop: '50px', color: '#6b7280' }}>
            Toque en cualquier lugar para continuar
          </p>
        </div>
      )}
    </div>
  )
}

export default App