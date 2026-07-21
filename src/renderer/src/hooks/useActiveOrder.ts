import { useState, useCallback, useEffect, useMemo } from 'react'
import type { Producto, CartItem, TicketData } from '../types/db'
import type { PaymentData } from '../components/PaymentModal'

// Interfaz local para tipar las reglas que vienen del backend
interface PromoConReglas {
  id: number;
  nombre: string;
  tipo: string;
  valor: number | null;
  valorPago: number | null; // <-- Nuevo: para '2x1' generalizado ("X productos por el precio de Y")
  categorias: number[];
  productos: number[];
}

export function useActiveOrder(tableId: number, userId?: number) {
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderStatus, setOrderStatus] = useState<string>('abierta')
  const [totalPagado, setTotalPagado] = useState<number>(0) 
  
  // Nuevo estado para guardar las reglas de promoción en memoria
  const [promocionesActivas, setPromocionesActivas] = useState<PromoConReglas[]>([])

  // Modales locales
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [ticketData, setTicketData] = useState<TicketData | null>(null)
  const [kitchenData, setKitchenData] = useState<{items: CartItem[], tableNum: number} | null>(null)

  // Cargar Promociones Activas (Solo se ejecuta una vez al montar el hook)
  useEffect(() => {
    const fetchPromos = async () => {
      try {
        // @ts-ignore
        const res = await window.electron.ipcRenderer.invoke('get-active-promos-con-reglas')
        if (Array.isArray(res)) setPromocionesActivas(res)
      } catch (e) { console.error('Error cargando promos', e) }
    }
    fetchPromos()
  }, [])

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
        setTotalPagado(result.order.totalPagado || 0) 
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

  // ==========================================
  // MOTOR MATEMÁTICO DE PROMOCIONES (CU-37)
  // ==========================================
  const { subtotal, descuentoTotal, totalCalculado, promosAplicadas } = useMemo(() => {
    let currentSubtotal = cart.reduce((sum, item) => sum + (item.precio * item.cantidad), 0)
    let currentDescuento = 0
    let applied: string[] = []

    promocionesActivas.forEach(promo => {
      let promoDescuento = 0;

      if (promo.tipo === '% TOTAL') {
        // Aplica al subtotal completo
        promoDescuento = currentSubtotal * ((promo.valor || 0) / 100);
        if (promoDescuento > 0) applied.push(promo.nombre);
      } else {
        // Aplica solo a productos/categorías específicas
        let aplicaPromo = false;
        
        cart.forEach(item => {
          // Intentamos leer el ID real del producto (o el ID del item si no está mapeado)
          // *Nota: Asegúrate de que el backend envíe categoria_id y producto_id en CartItem
          const prodId = (item as any).producto_id || item.id; 
          const catId = (item as any).categoria_id;

          const matchProducto = promo.productos.includes(prodId);
          const matchCategoria = catId ? promo.categorias.includes(catId) : false;

          if (matchProducto || matchCategoria) {
            aplicaPromo = true;
            if (promo.tipo === '% de producto') {
              promoDescuento += (item.precio * item.cantidad) * ((promo.valor || 0) / 100);
            } else if (promo.tipo === '2x1') {
              // Generalizado: "X productos por el precio de Y" (el clásico 2x1 es X=2, Y=1)
              const cantidadRequerida = promo.valor && promo.valor > 0 ? promo.valor : 2;
              const cantidadPagada = promo.valorPago && promo.valorPago > 0 ? promo.valorPago : 1;
              if (cantidadPagada < cantidadRequerida) {
                const grupos = Math.floor(item.cantidad / cantidadRequerida);
                const itemsGratis = grupos * (cantidadRequerida - cantidadPagada);
                promoDescuento += itemsGratis * item.precio;
              }
            }
          }
        });

        // Si es Precio Fijo y encontró al menos 1 coincidencia en el carrito
        if (promo.tipo === 'Precio Fijo' && aplicaPromo) {
          promoDescuento += (promo.valor || 0);
        }

        if (promoDescuento > 0) applied.push(promo.nombre);
      }

      currentDescuento += promoDescuento;
    });

    // Aseguramos que el total nunca sea negativo
    const finalTotal = Math.max(0, currentSubtotal - currentDescuento);

    return {
      subtotal: currentSubtotal,
      descuentoTotal: currentDescuento,
      totalCalculado: finalTotal,
      promosAplicadas: applied
    }
  }, [cart, promocionesActivas]) // <-- Se recalcula automáticamente si el carrito o las promos cambian

  // --- ACCIONES DEL CARRITO ---
  const addToCart = async (product: Producto) => {
    if (!activeOrderId) { alert('⚠️ La orden no se generó correctamente. Sal al menú de mesas y vuelve a entrar.'); return; }
    if (orderStatus === 'cuenta_solicitada') { alert('⚠️ No se pueden añadir productos, la cuenta ya fue solicitada.'); return; }
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('add-order-item', { ordenId: activeOrderId, product })
      if (result && result.success) await fetchOrder()
      else alert('❌ Error al añadir el producto: ' + (result?.error || 'Desconocido'))
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

  const processPayment = async (paymentData: PaymentData) => {
    if (!activeOrderId) return false
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('pay-order', { orderId: activeOrderId, payment: paymentData })

      if (result && result.success) {
        if (result.isFullyPaid) {
          // Reemplazamos la suma manual por el valor procesado por el motor matemático.
          // Si fue cortesía, el total del ticket debe ser $0 (no el total con descuento de promos),
          // para que TicketReceipt detecte isCortesia y muestre el sello correspondiente.
          setTicketData({
            orderId: activeOrderId,
            items: [...cart],
            total: paymentData.isCourtesy ? 0 : totalCalculado,
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
        } else {
          await fetchOrder()
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
    // EXPORTAMOS LOS VALORES MATEMÁTICOS NUEVOS
    subtotal, descuentoTotal, totalCalculado, promosAplicadas,
    addToCart, removeFromCart, updateQuantity,
    generateCommand, requestBill, processPayment, cancelOrder
  }
}