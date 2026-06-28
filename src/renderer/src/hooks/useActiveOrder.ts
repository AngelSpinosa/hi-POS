import { useState, useCallback, useEffect } from 'react'
import type { Producto, CartItem, TicketData } from '../types/db'
// Importamos la interfaz PaymentData para que coincida con el Modal y el POSView
import type { PaymentData } from '../components/PaymentModal'

export function useActiveOrder(tableId: number, userId?: number) {
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderStatus, setOrderStatus] = useState<string>('abierta')
  const [totalPagado, setTotalPagado] = useState<number>(0) // <-- NUEVO ESTADO
  
  // Modales locales
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [ticketData, setTicketData] = useState<TicketData | null>(null)
  const [kitchenData, setKitchenData] = useState<{items: CartItem[], tableNum: number} | null>(null)

  // Cargar Orden
  const fetchOrder = useCallback(async () => {
    if (!tableId) return
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('open-table-order', { 
        tableId: tableId, 
        userId: userId 
      })
      
      if (result && result.success) {
        setActiveOrderId(result.order.id)
        setCart(result.items || [])
        setOrderStatus(result.order.estatus)
        setTotalPagado(result.order.totalPagado || 0) // <-- GUARDAMOS EL TOTAL PAGADO
      } else {
        setActiveOrderId(null)
      }
    } catch (error) {
      console.error('Error al cargar la orden:', error)
      setActiveOrderId(null)
    }
  }, [tableId, userId])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  // --- ACCIONES DEL CARRITO ---
  const addToCart = async (product: Producto) => {
    if (!activeOrderId) {
      alert('⚠️ La orden no se generó correctamente. Sal al menú de mesas y vuelve a entrar.')
      return
    }
    if (orderStatus === 'cuenta_solicitada') {
      alert('⚠️ No se pueden añadir productos, la cuenta ya fue solicitada.')
      return
    }

    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('add-order-item', { 
        ordenId: activeOrderId, 
        product 
      })
      if (result && result.success) {
        await fetchOrder()
      } else {
        alert('❌ Error al añadir el producto: ' + (result?.error || 'Desconocido'))
      }
    } catch (e) { console.error('Error:', e) }
  }

  const removeFromCart = async (itemId: number) => {
    if (!activeOrderId) return
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('remove-order-item', { itemId, ordenId: activeOrderId })
    await fetchOrder()
  }

  const updateQuantity = async (itemId: number, change: number) => {
    if (!activeOrderId) return
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('update-order-item-qty', { itemId, ordenId: activeOrderId, change })
    await fetchOrder()
  }

  // --- ACCIONES DE ORDEN ---
  const generateCommand = async (tableNumber: number) => {
    if (!activeOrderId) return
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('print-command', { ordenId: activeOrderId })
    if (res && res.success && res.items.length > 0) {
      setKitchenData({ items: res.items, tableNum: tableNumber })
      await fetchOrder()
    } else {
       alert('No hay productos nuevos para enviar a la cocina.')
    }
  }

  const requestBill = async () => {
    if (!activeOrderId) return
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('request-bill', { ordenId: activeOrderId })
    await fetchOrder()
  }

  // NUEVA LÓGICA DE PAGO (Soporta pagos parciales y múltiples SIN CERRAR EL MODAL)
  const processPayment = async (paymentData: PaymentData) => {
    if (!activeOrderId) return false
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('pay-order', {
        orderId: activeOrderId, 
        payment: paymentData 
      })

      if (result && result.success) {
        if (result.isFullyPaid) {
          // Si se completó el pago de toda la mesa, preparamos el Ticket y CERRAMOS el modal
          const totalCart = cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
          
          setTicketData({
            orderId: activeOrderId, 
            items: [...cart], 
            total: totalCart,
            date: new Date().toLocaleString(),
            pagos: [{ 
              metodo: paymentData.method, 
              monto: paymentData.received, 
              cambio: paymentData.method === 'efectivo' ? paymentData.received - paymentData.amountToPay : 0 
            }],
            cajero: result.cajero 
          } as any) // <--- AÑADIDO: 'as any' para ignorar el tipado estricto de TicketData por ahora
          
          setIsPaymentModalOpen(false) // Solo se cierra al liquidar todo
          return true
        } else {
          // ES UN PAGO PARCIAL: ¡Mantenemos el modal abierto!
          // Refrescamos la orden. Esto actualizará 'totalPagado' y automáticamente 
          // el Modal verá el nuevo 'totalRestante', limpiando el input de cobro.
          await fetchOrder()
          
          // Mostramos la alerta para que el cajero sepa que el pago pasó
          alert(`✅ Pago parcial de $${paymentData.amountToPay.toFixed(2)} registrado con éxito.\nRestan: $${result.remaining.toFixed(2)} por cobrar.`)
          
          return true
        }
      }
      
      alert(result?.error || 'Error al procesar pago')
      return false
    } catch (error) { 
      console.error(error)
      return false 
    }
  }

  const cancelOrder = async (pin: string) => {
    if (!activeOrderId) return false
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('cancel-order', { orderId: activeOrderId, pin })
      if (result && result.success) {
        setActiveOrderId(null)
        setCart([])
        setOrderStatus('abierta')
        return true
      }
      alert('❌ No se pudo cancelar: ' + (result?.error || 'PIN incorrecto o sin permisos'))
      return false
    } catch (error) { return false }
  }

  return {
    activeOrderId, cart, orderStatus, totalPagado,
    isPaymentModalOpen, setIsPaymentModalOpen,
    ticketData, setTicketData,
    kitchenData, setKitchenData,
    addToCart, removeFromCart, updateQuantity,
    generateCommand, requestBill, processPayment, cancelOrder
  }
}