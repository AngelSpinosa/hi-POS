import { useState, useCallback, useEffect } from 'react'
import type { Producto, CartItem, TicketData } from '../types/db'
import type { PaymentData } from '../components/PaymentModal'

export interface ShippingData {
  clienteNombre: string;
  clienteTelefono: string;
  direccionEnvio: string;
  canalDeliveryId: number;
  costoEnvio: number;
}

// A diferencia de useActiveOrder.ts (mesas), este hook NO duplica el motor de
// promociones en el frontend. Como orders.ts ya recalcula orden.total con
// descuentos incluidos en cada add/remove/update-qty, aquí simplemente se
// confía en ese valor releído de la BD (get-delivery-order-state) — una sola
// fuente de verdad, sin riesgo de que se desincronicen.
export function useDeliveryOrder(userId?: number) {
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderTotal, setOrderTotal] = useState(0)
  const [descuentoTotal, setDescuentoTotal] = useState(0)

  const [isShippingModalOpen, setIsShippingModalOpen] = useState(false)
  const [pendingShipping, setPendingShipping] = useState<ShippingData | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [ticketData, setTicketData] = useState<TicketData | null>(null)
  const [kitchenData, setKitchenData] = useState<{ items: CartItem[] } | null>(null)

  // Crear la orden base de domicilio al montar (equivalente a open-table-order, sin mesa)
  useEffect(() => {
    const openOrder = async () => {
      if (!userId) return
      try {
        // @ts-ignore
        const result = await window.electron.ipcRenderer.invoke('open-delivery-order', { userId })
        if (result && result.success) setActiveOrderId(result.order.id)
      } catch (e) { console.error('Error abriendo orden de domicilio:', e) }
    }
    openOrder()
  }, [userId])

  const refreshOrder = useCallback(async () => {
    if (!activeOrderId) return
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('get-delivery-order-state', { ordenId: activeOrderId })
      if (result && result.success) {
        setCart(result.items || [])
        setOrderTotal(result.order.total || 0)
        setDescuentoTotal(result.order.descuento_total || 0)
      }
    } catch (e) { console.error('Error refrescando orden de domicilio:', e) }
  }, [activeOrderId])

  const addToCart = async (product: Producto) => {
    if (!activeOrderId) { alert('⚠️ La orden no se generó correctamente. Sal y vuelve a entrar.'); return; }
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('add-order-item', { ordenId: activeOrderId, product })
      if (result && result.success) await refreshOrder()
      else alert('❌ Error al añadir el producto: ' + (result?.error || 'Desconocido'))
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

  // "Generar comanda": manda el ticket a cocina y, justo después, abre el modal de envío
  const generateCommand = async () => {
    if (!activeOrderId) return
    if (cart.length === 0) { alert('⚠️ Agrega al menos un producto antes de generar la comanda.'); return; }
    try {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('print-command', { ordenId: activeOrderId })
      if (res && res.success && res.items.length > 0) {
        setKitchenData({ items: res.items })
        setIsShippingModalOpen(true)
        await refreshOrder()
      } else {
        alert('No hay productos nuevos para enviar a la cocina.')
      }
    } catch (e) { console.error(e) }
  }

  // Se llama al confirmar ShippingInfoModal: guarda los datos y abre el PaymentModal (prepago)
  const confirmShipping = (data: ShippingData) => {
    setPendingShipping(data)
    setIsShippingModalOpen(false)
    setIsPaymentModalOpen(true)
  }

  // Se llama al confirmar el PaymentModal: aquí sí se cobra y se cierra el pedido
  const confirmPaymentAndCreate = async (paymentData: PaymentData) => {
    if (!activeOrderId || !pendingShipping) return false
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('create-delivery-info', {
        ordenId: activeOrderId,
        clienteNombre: pendingShipping.clienteNombre,
        clienteTelefono: pendingShipping.clienteTelefono,
        direccionEnvio: pendingShipping.direccionEnvio,
        canalDeliveryId: pendingShipping.canalDeliveryId,
        costoEnvio: pendingShipping.costoEnvio,
        payment: { method: paymentData.method, received: paymentData.received }
      })

      if (result && result.success) {
        setTicketData({
          orderId: activeOrderId,
          items: [...cart],
          total: result.totalACobrar,
          date: new Date().toLocaleString(),
          pagos: [{
            metodo: paymentData.method,
            monto: paymentData.received,
            cambio: result.cambio || 0
          }],
        } as any)
        setIsPaymentModalOpen(false)
        return true
      }
      alert(result?.error || 'Error al procesar el pedido de domicilio')
      return false
    } catch (e) { console.error(e); return false }
  }

  const cancelOrder = async (pin: string) => {
    if (!activeOrderId) return false
    try {
      // Reutiliza el mismo handler de cancelación que las mesas (ya es genérico por ordenId)
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('cancel-order', { orderId: activeOrderId, pin })
      if (result && result.success) return true
      alert('❌ No se pudo cancelar: ' + (result?.error || 'PIN incorrecto o sin permisos'))
      return false
    } catch (e) { return false }
  }

  return {
    activeOrderId, cart, orderTotal, descuentoTotal,
    isShippingModalOpen, setIsShippingModalOpen,
    isPaymentModalOpen, setIsPaymentModalOpen,
    ticketData, setTicketData,
    kitchenData, setKitchenData,
    // Total que debe cobrar el PaymentModal: el de la orden + el costo de envío que
    // se acaba de capturar en ShippingInfoModal (0 si todavía no se ha llenado)
    totalConEnvio: orderTotal + (pendingShipping?.costoEnvio || 0),
    addToCart, removeFromCart, updateQuantity,
    generateCommand, confirmShipping, confirmPaymentAndCreate, cancelOrder
  }
}