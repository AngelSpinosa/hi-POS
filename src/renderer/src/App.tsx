import { useEffect, useState, useCallback } from 'react'
import type { Producto, CartItem } from './types/db'
import { OrderCart } from './components/OrderCart'
import { PaymentModal } from './components/PaymentModal'

function App() {
  const [products, setProducts] = useState<Producto[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  // Función central: Sincronizar el Frontend con la Base de Datos
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

  // 1. Inicialización de la App
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

  // 2. Agregar Producto
  const addToCart = async (product: Producto) => {
    if (!activeOrderId) return

    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('add-to-cart', {
        orderId: activeOrderId,
        product
      })
      
      if (result.success) await fetchActiveOrder()
    } catch (error) {
      console.error('Error agregando producto:', error)
    }
  }

  // 3. Eliminar Producto
  const removeFromCart = async (productId: number) => {
    if (!activeOrderId) return

    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('remove-from-cart', {
        orderId: activeOrderId,
        productId
      })
      
      if (result.success) await fetchActiveOrder()
    } catch (error) {
      console.error('Error eliminando producto:', error)
    }
  }

  // 4. Actualizar Cantidad
  const updateQuantity = async (productId: number, newQuantity: number) => {
    if (!activeOrderId) return

    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('update-quantity', {
        orderId: activeOrderId,
        productId,
        quantity: newQuantity
      })
      
      if (result.success) await fetchActiveOrder()
    } catch (error) {
      console.error('Error actualizando cantidad:', error)
    }
  }

  const total = cart.reduce((sum, item) => sum + item.precio * item.quantity, 0)

  // 5. Procesar Pago
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
        console.log('Venta completada. Orden ID:', activeOrderId)
        setIsPaymentModalOpen(false)
        await fetchActiveOrder() 
      } else {
        alert('Error al procesar el pago.')
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
        orderId={activeOrderId} // <--- Pasamos el ID real aquí
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
    </div>
  )
}

export default App