import { useState, useCallback, useEffect } from 'react'
import type { Producto, CartItem, TicketData } from '../types/db'
import type { PaymentData } from '../components/PaymentModal'

// Igual que useDeliveryOrder.ts: no duplica el motor de promociones en el
// frontend. orders.ts ya recalcula orden.total con descuentos incluidos en
// cada add/remove/update-qty, así que aquí solo se confía en ese valor.
export function useTakeawayOrder(userId?: number) {
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderTotal, setOrderTotal] = useState(0)
  const [descuentoTotal, setDescuentoTotal] = useState(0)
  const [totalPagado, setTotalPagado] = useState(0)
  const [orderStatus, setOrderStatus] = useState<string>('abierta')

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [ticketData, setTicketData] = useState<TicketData | null>(null)
  const [kitchenData, setKitchenData] = useState<{ items: CartItem[] } | null>(null)

  // Crear la orden base al montar (equivalente a open-table-order, sin mesa)
  useEffect(() => {
    const openOrder = async () => {
      if (!userId) return
      try {
        // @ts-ignore
        const result = await window.electron.ipcRenderer.invoke('open-carryout-order', { userId })
        if (result && result.success) setActiveOrderId(result.order.id)
      } catch (e) { console.error('Error abriendo orden para llevar:', e) }
    }
    openOrder()
  }, [userId])

  const refreshOrder = useCallback(async () => {
    if (!activeOrderId) return
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('get-carryout-order-state', { ordenId: activeOrderId })
      if (result && result.success) {
        setCart(result.items || [])
        setOrderTotal(result.order.total || 0)
        setDescuentoTotal(result.order.descuento_total || 0)
        setTotalPagado(result.order.totalPagado || 0)
        setOrderStatus(result.order.estatus)
      }
    } catch (e) { console.error('Error refrescando orden para llevar:', e) }
  }, [activeOrderId])

  const addToCart = async (product: Producto) => {
    if (!activeOrderId) { alert('La orden no se generó correctamente. Sal y vuelve a entrar.'); return; }
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('add-order-item', { ordenId: activeOrderId, product })
      if (result && result.success) await refreshOrder()
      else alert('Error al añadir el producto: ' + (result?.error || 'Desconocido'))
    } catch (e) { console.error(e) }
  }

  const removeFromCart = async (itemId: number) => {
    if (!activeOrderId) return
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('remove-order-item', { itemId, ordenId: activeOrderId })
    await refreshOrder()
  }

  const updateQuantity = async (itemId: number, change: number) => {
    if (!activeOrderId) return
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('update-order-item-qty', { itemId, ordenId: activeOrderId, change })
    await refreshOrder()
  }

  // "Generar comanda": manda a cocina Y, de inmediato, marca la cuenta como
  // solicitada — así el botón "Cobrar" de OrderCart aparece sin que el
  // cajero tenga que dar un tercer paso extra (a diferencia de mesas).
  const generateCommand = async () => {
    if (!activeOrderId) return
    if (cart.length === 0) { alert('Agrega al menos un producto antes de generar la comanda.'); return; }
    try {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('print-command', { ordenId: activeOrderId })
      if (res && res.success && res.items.length > 0) {
        setKitchenData({ items: res.items })
        // @ts-ignore
        await window.electron.ipcRenderer.invoke('request-bill', { ordenId: activeOrderId })
        await refreshOrder()
      } else {
        alert('No hay productos nuevos para enviar a la cocina.')
      }
    } catch (e) { console.error(e) }
  }

  const processPayment = async (paymentData: PaymentData) => {
    if (!activeOrderId) return false
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('pay-order', { orderId: activeOrderId, payment: paymentData })

      if (result && result.success && result.isFullyPaid) {
        setTicketData({
          orderId: activeOrderId,
          items: [...cart],
          total: paymentData.isCourtesy ? 0 : orderTotal,
          date: new Date().toLocaleString(),
          pagos: [{
            metodo: paymentData.method,
            monto: paymentData.received,
            cambio: paymentData.method === 'efectivo' ? paymentData.received - paymentData.amountToPay : 0
          }],
          cajero: result.cajero
        } as any)
        setIsPaymentModalOpen(false)
        return true
      }
      alert(result?.error || 'Error al procesar el pago')
      return false
    } catch (e) { console.error(e); return false }
  }

  const cancelOrder = async (pin: string) => {
    if (!activeOrderId) return false
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('cancel-order', { orderId: activeOrderId, pin })
      if (result && result.success) return true
      alert('No se pudo cancelar: ' + (result?.error || 'PIN incorrecto o sin permisos'))
      return false
    } catch (e) { return false }
  }

  return {
    activeOrderId, cart, orderTotal, descuentoTotal, totalPagado, orderStatus,
    isPaymentModalOpen, setIsPaymentModalOpen,
    ticketData, setTicketData,
    kitchenData, setKitchenData,
    addToCart, removeFromCart, updateQuantity,
    generateCommand, processPayment, cancelOrder
  }
}