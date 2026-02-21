import { useState, useCallback, useEffect } from 'react'
import type { Producto, CartItem, TicketData } from '../types/db'

export function useActiveOrder(tableId: number | null, userId: number | undefined) {
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderStatus, setOrderStatus] = useState<string>('abierta')
  
  // Modales y Datos UI (Requeridos por POSView)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [ticketData, setTicketData] = useState<TicketData | null>(null)
  const [kitchenData, setKitchenData] = useState<{items: CartItem[], tableNum: number} | null>(null)

  // Cargar Orden
  const fetchOrder = useCallback(async () => {
    if (!tableId) return
    try {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('open-table-order', { mesaId: tableId, userId })
      if (res.success) {
        setActiveOrderId(res.order.id)
        setCart(res.items)
        setOrderStatus(res.order.estatus)
      } else {
        // Si falla o no hay orden
        setActiveOrderId(null)
        setCart([])
      }
    } catch (e) { console.error(e) }
  }, [tableId, userId])

  // Cargar inicial
  useEffect(() => {
    if (tableId) fetchOrder()
  }, [fetchOrder, tableId])

  // --- ACCIONES DEL CARRITO ---

  const addToCart = async (product: Producto) => {
    if (!activeOrderId) return
    try {
      // @ts-ignore
      await window.electron.ipcRenderer.invoke('add-order-item', { ordenId: activeOrderId, product })
      await fetchOrder()
    } catch (e) { console.error(e) }
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

  // --- ACCIONES DE ORDEN (Cocina, Cuenta, Pago) ---

  const generateCommand = async (tableNumber: number) => {
    if (!activeOrderId) return
    try {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('print-command', { ordenId: activeOrderId })
      if (res.success && res.items.length > 0) {
        setKitchenData({ items: res.items, tableNum: tableNumber })
        await fetchOrder()
      } else {
        // Feedback opcional si no hay nada nuevo
        console.log('Nada nuevo para imprimir')
      }
    } catch (e) { console.error(e) }
  }

  const requestBill = async () => {
    if (!activeOrderId) return
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('request-bill', { ordenId: activeOrderId })
    await fetchOrder()
  }

  const processPayment = async (method: string, amount: number) => {
    if (!activeOrderId) return { success: false }
    
    // Calculamos total actual del carrito local para el registro
    const total = cart.reduce((acc, item) => acc + (item.precio * item.cantidad), 0)

    try {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('pay-order', { 
        orderId: activeOrderId, 
        payment: { method, received: amount }, 
        total 
      })

      if (res.success) {
        setTicketData({
          orderId: activeOrderId,
          items: [...cart],
          total,
          date: new Date().toLocaleString(),
          payment: { method, amount, change: amount - total }
        })
        setIsPaymentModalOpen(false)
        await fetchOrder()
        return { success: true }
      }
      return { success: false }
    } catch (e) { return { success: false } }
  }

  const cancelOrder = async (pin: string) => {
    if (!activeOrderId) return false
    try {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('cancel-order', { orderId: activeOrderId, pin })
      if (res.success) {
        setActiveOrderId(null)
        setCart([])
        return true
      }
      return false
    } catch (e) { return false }
  }

  // Refrescar manualmente
  const refresh = fetchOrder

  // Retorno estructurado para POSView
  return {
    activeOrderId,
    cart,
    orderStatus,
    
    // UI State & Setters
    isPaymentModalOpen,
    setIsPaymentModalOpen,
    ticketData,
    setTicketData,
    kitchenData,
    setKitchenData,

    // Actions
    addToCart,
    removeFromCart,
    updateQuantity,
    generateCommand,
    requestBill,
    processPayment, // POSView lo usa como handlePayment interno, pero lo exponemos
    cancelOrder,
    refresh
  }
}