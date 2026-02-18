import { useState, useCallback } from 'react'
import type { Producto, CartItem, TicketData } from '../types/db'

export function useActiveOrder() {
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderStatus, setOrderStatus] = useState<string>('abierta')
  
  // Modales locales de la orden
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [ticketData, setTicketData] = useState<TicketData | null>(null)
  const [kitchenData, setKitchenData] = useState<{items: CartItem[], tableNum: number} | null>(null)

  // Cargar una orden específica
  const loadOrder = useCallback(async (tableId: number) => {
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('open-table-order', { tableId })
      if (result.success) {
        setActiveOrderId(result.order.id)
        setCart(result.items)
        setOrderStatus(result.order.estatus)
        return true
      }
      return false
    } catch (error) {
      console.error(error)
      return false
    }
  }, [])

  // Acciones del Carrito
  const addToCart = async (product: Producto) => {
    if (!activeOrderId || orderStatus === 'cuenta_solicitada') return
    // @ts-ignore
    const result = await window.electron.ipcRenderer.invoke('add-to-cart', { orderId: activeOrderId, product })
    if (result.success) setCart(result.items)
  }

  const removeFromCart = async (productId: number) => {
    if (!activeOrderId) return
    // @ts-ignore
    const result = await window.electron.ipcRenderer.invoke('remove-from-cart', { orderId: activeOrderId, productId })
    if (result.success) setCart(result.items)
  }

  const updateQuantity = async (productId: number, newQuantity: number) => {
    if (!activeOrderId) return
    // @ts-ignore
    const result = await window.electron.ipcRenderer.invoke('update-quantity', { orderId: activeOrderId, productId, quantity: newQuantity })
    if (result.success) setCart(result.items)
  }

  // Comandas y Cuenta
  const generateCommand = async (tableNum: number) => {
    if (!activeOrderId) return
    const newItems = cart.filter(i => i.comanda_impresa === 0)
    // @ts-ignore
    const result = await window.electron.ipcRenderer.invoke('generate-command', { orderId: activeOrderId })
    if (result.success) {
      setCart(result.items)
      setKitchenData({ items: newItems, tableNum })
    }
  }

  const requestBill = async () => {
    if (!activeOrderId) return
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('update-order-status', { orderId: activeOrderId, status: 'cuenta_solicitada' })
    setOrderStatus('cuenta_solicitada')
    
    // Calculamos total para el pre-ticket
    const total = cart.reduce((sum: number, item) => sum + item.precio * item.cantidad, 0)
    setTicketData({
      orderId: activeOrderId, items: [...cart], total,
      payment: { method: 'PENDIENTE', received: 0, change: 0 }
    })
  }

  const payOrder = async (method: 'efectivo' | 'tarjeta', received: number) => {
    if (!activeOrderId) return
    const total = cart.reduce((sum: number, item) => sum + item.precio * item.cantidad, 0)
    
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('pay-order', {
        orderId: activeOrderId, payment: { method, received }, total
      })

      if (result.success) {
        setTicketData({
          orderId: activeOrderId, items: [...cart], total,
          payment: { method, received, change: received - total }
        })
        setIsPaymentModalOpen(false)
        return true // Éxito
      } else {
        alert(result.error)
        return false
      }
    } catch (error) { console.error(error); return false }
  }

  const cancelOrder = async () => {
    if (!activeOrderId) return
    // @ts-ignore
    const result = await window.electron.ipcRenderer.invoke('cancel-order', { orderId: activeOrderId })
    if (result.success) {
      return true
    } else {
      alert('Error: ' + result.error)
      return false
    }
  }

  // Limpiar estado (al salir de la mesa)
  const clearOrder = () => {
    setActiveOrderId(null)
    setCart([])
    setOrderStatus('abierta')
    setTicketData(null)
    setKitchenData(null)
  }

  return {
    activeOrderId,
    cart,
    orderStatus,
    isPaymentModalOpen, setIsPaymentModalOpen,
    ticketData, setTicketData,
    kitchenData, setKitchenData,
    // Acciones
    loadOrder,
    addToCart,
    removeFromCart,
    updateQuantity,
    generateCommand,
    requestBill,
    payOrder,
    cancelOrder,
    clearOrder
  }
}