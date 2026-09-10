import { useState, useCallback, useEffect } from 'react'
import type { Producto, CartItem, TicketData } from '../types/db'

export interface ShippingData {
  clienteNombre: string;
  clienteTelefono: string;
  direccionEnvio: string;
  canalDeliveryId: number;
  costoEnvio: number;
  notasEntrega: string;
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

  // Botón "Generar comanda" del carrito: ya no manda nada a cocina todavía.
  // Primero se piden los datos de envío (nuevo orden del flujo, CU-75 rediseñado);
  // la comanda y el auto-cobro se disparan juntos hasta confirmar ese formulario.
  const generateCommand = () => {
    if (!activeOrderId) return
    if (cart.length === 0) { alert('⚠️ Agrega al menos un producto antes de continuar.'); return; }
    setIsShippingModalOpen(true)
  }

  // Se llama al confirmar ShippingInfoModal: aquí se hace todo en un solo paso —
  // se manda la comanda a cocina (print-command) y, si hay algo que imprimir,
  // se registran los datos de envío + el auto-cobro (create-delivery-info).
  // Ya no hay PaymentModal de por medio: el cajero no captura nada de pago.
  const confirmShipping = async (data: ShippingData) => {
    if (!activeOrderId) return
    setIsShippingModalOpen(false)
    try {
      // 1. Mandar comanda a cocina
      // @ts-ignore
      const printRes = await window.electron.ipcRenderer.invoke('print-command', { ordenId: activeOrderId })
      if (!printRes || !printRes.success || !printRes.items || printRes.items.length === 0) {
        alert('⚠️ No hay productos nuevos para enviar a la cocina.')
        return
      }

      // 2. Registrar datos de envío + auto-cobro con esos mismos datos
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('create-delivery-info', {
        ordenId: activeOrderId,
        clienteNombre: data.clienteNombre,
        clienteTelefono: data.clienteTelefono,
        direccionEnvio: data.direccionEnvio,
        canalDeliveryId: data.canalDeliveryId,
        costoEnvio: data.costoEnvio,
        notasEntrega: data.notasEntrega
      })

      if (result && result.success) {
        setKitchenData({ items: printRes.items })
        setTicketData({
          orderId: activeOrderId,
          items: [...cart],
          total: result.totalACobrar,
          date: new Date().toLocaleString(),
          pagos: [{
            metodo: 'app_delivery',
            monto: result.totalACobrar,
            cambio: 0
          }],
        } as any)
        await refreshOrder()
      } else {
        alert(result?.error || 'Error al procesar el pedido de domicilio')
      }
    } catch (e) { console.error(e) }
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
    ticketData, setTicketData,
    kitchenData, setKitchenData,
    addToCart, removeFromCart, updateQuantity,
    generateCommand, confirmShipping, cancelOrder
  }
}