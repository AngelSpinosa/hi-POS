import { useEffect, useState, useCallback } from 'react'
import type { Producto, CartItem, Mesa } from './types/db'
import { OrderCart } from './components/OrderCart'
import { PaymentModal } from './components/PaymentModal'
import { TicketReceipt } from './components/TicketReceipt'
import { TableGrid } from './components/TableGrid'
import { DailyReport } from './components/DailyReport'
import { Dashboard } from './components/Dashboard'
import { PinPadModal } from './components/PinPadModal'

// eslint-disable-next-line react/prop-types
function KitchenCommand({ items, tableNum, onClose }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: '#fff', color: '#000', padding: '20px', width: '250px', fontFamily: 'monospace' }}>
        <h3 style={{ textAlign: 'center', borderBottom: '2px dashed #000' }}>COCINA - MESA {tableNum}</h3>
        {/* eslint-disable-next-line react/prop-types */}
        {items.map((item, idx) => (
          <div key={idx} style={{ fontSize: '1.2rem', margin: '10px 0' }}>[ ] {item.cantidad} x {item.nombre}</div>
        ))}
        <div style={{ borderTop: '2px dashed #000', marginTop: '20px', paddingTop: '10px', textAlign: 'center' }}>{new Date().toLocaleTimeString()}</div>
        <button onClick={onClose} style={{ marginTop: '20px', width: '100%', padding: '10px', background: 'black', color: 'white', border: 'none', cursor: 'pointer' }}>CERRAR</button>
      </div>
    </div>
  )
}

type ViewState = 'DASHBOARD' | 'TABLES' | 'ORDER' | 'REPORT' | 'USERS';

interface TicketData {
  orderId: number;
  items: CartItem[];
  total: number;
  payment: { method: string; received: number; change: number };
}

function App() {
  const [view, setView] = useState<ViewState>('DASHBOARD')
  const [tables, setTables] = useState<Mesa[]>([])
  const [products, setProducts] = useState<Producto[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  
  const [activeTableId, setActiveTableId] = useState<number | null>(null)
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [orderStatus, setOrderStatus] = useState<string>('abierta')
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [ticketData, setTicketData] = useState<TicketData | null>(null)
  const [kitchenData, setKitchenData] = useState<{items: CartItem[], tableNum: number} | null>(null)
  
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [pinTitle, setPinTitle] = useState('Ingrese su PIN') // Título dinámico para el modal
  
  // Estados para acciones pendientes tras el PIN
  const [pendingView, setPendingView] = useState<ViewState | null>(null)
  const [pendingTableId, setPendingTableId] = useState<number | null>(null)
  
  const [currentUser, setCurrentUser] = useState<{ nombre: string, rol: string } | null>(null)

  const refreshTables = useCallback(async () => {
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('get-tables')
      setTables(result)
    } catch (error) { console.error(error) }
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        // @ts-ignore
        const prods = await window.electron.ipcRenderer.invoke('get-products')
        setProducts(prods)
        await refreshTables()
      } catch (error) { console.error('Error cargando datos', error) }
    }
    init()
  }, [refreshTables])

  // --- LÓGICA DE SEGURIDAD Y NAVEGACIÓN ---

  // 1. Navegación desde Dashboard
  const handleNavigate = (targetView: ViewState) => {
    if (targetView === 'REPORT' || targetView === 'USERS') {
      setPinTitle('Acceso Restringido 🔒')
      setPendingView(targetView)
      setIsPinModalOpen(true)
    } else if (targetView === 'TABLES') {
      setView('TABLES')
    } else {
      setView(targetView)
    }
  }

  // 2. Selección de Mesa (Dispara el PIN)
  const handleSelectTableRequest = (tableId: number) => {
    setPinTitle('Mesero responsable 👤')
    setPendingTableId(tableId)
    setIsPinModalOpen(true)
  }

  // 3. Verificación del PIN (Centralizada)
  const handlePinVerify = async (pin: string) => {
    let user: { nombre: string; rol: string } | null = null;
    
    // Simulación de validación (idealmente vendría de BD)
    if (pin === '1234') user = { nombre: 'Angel Admin', rol: 'admin' }
    if (pin === '0000') user = { nombre: 'Aldo Cajero', rol: 'cajero' }

    if (user) {
      setCurrentUser(user)
      setIsPinModalOpen(false) // Cierra el modal si es correcto
      
      // CASO A: Navegación protegida (Reportes/Usuarios)
      if (pendingView) {
        if ((pendingView === 'USERS' || pendingView === 'REPORT') && user.rol !== 'admin') {
          alert('Acceso Denegado: Se requieren permisos de Administrador.')
        } else {
          setView(pendingView)
        }
        setPendingView(null)
      }

      // CASO B: Acceso a Mesa (Cualquier rol válido puede atender)
      if (pendingTableId !== null) {
        await executeOpenTable(pendingTableId)
        setPendingTableId(null)
      }

    } else {
      alert('PIN Incorrecto')
    }
  }

  // Función interna para abrir la mesa (solo se llama tras éxito del PIN)
  const executeOpenTable = async (tableId: number) => {
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('open-table-order', { tableId })
      if (result.success) {
        setActiveTableId(tableId)
        setActiveOrderId(result.order.id)
        setCart(result.items)
        setOrderStatus(result.order.estatus)
        setView('ORDER')
      }
    } catch (error) { console.error(error) }
  }

  const handleBackToDashboard = async () => {
    setView('DASHBOARD')
    setActiveTableId(null)
    setActiveOrderId(null)
    setCart([])
    setCurrentUser(null) 
  }

  const handleBackToTables = async () => {
    setView('TABLES')
    setActiveTableId(null)
    setActiveOrderId(null)
    setCart([])
    await refreshTables()
  }

  // --- LÓGICA DE ORDEN (Carrito y Acciones) ---

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

  const handleGenerateCommand = async () => {
    if (!activeOrderId) return
    const newItems = cart.filter(i => i.comanda_impresa === 0)
    const tableNum = tables.find(t => t.id === activeTableId)?.numero || 0
    // @ts-ignore
    const result = await window.electron.ipcRenderer.invoke('generate-command', { orderId: activeOrderId })
    if (result.success) {
      setCart(result.items) 
      setKitchenData({ items: newItems, tableNum }) 
    }
  }

  const total = cart.reduce((sum: number, item) => sum + item.precio * item.cantidad, 0)

  const handleRequestBill = async () => {
    if (!activeOrderId) return
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('update-order-status', { orderId: activeOrderId, status: 'cuenta_solicitada' })
    setOrderStatus('cuenta_solicitada')
    
    setTicketData({
      orderId: activeOrderId, items: [...cart], total: total,
      payment: { method: 'PENDIENTE', received: 0, change: 0 }
    })
  }

  const handlePaymentConfirm = async (method: 'efectivo' | 'tarjeta', received: number) => {
    if (!activeOrderId) return
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('pay-order', {
        orderId: activeOrderId, payment: { method, received }, total
      })
      if (result.success) {
        setTicketData({
          orderId: activeOrderId, items: [...cart], total: total,
          payment: { method, received, change: received - total }
        })
        setIsPaymentModalOpen(false)
      } else { alert(result.error) }
    } catch (error) { console.error(error) }
  }

  const handleCancelOrder = async () => {
    if (!activeOrderId) return
    // @ts-ignore
    const result = await window.electron.ipcRenderer.invoke('cancel-order', { orderId: activeOrderId })
    if (result.success) { handleBackToTables() } 
    else { alert('Error al cancelar: ' + result.error) }
  }

  // --- RENDERIZADO DE VISTAS ---

  if (view === 'DASHBOARD') {
    // El modal ahora vive fuera para poder sobreponerse al dashboard
    return (
      <>
        <PinPadModal 
          title={pinTitle}
          isOpen={isPinModalOpen} 
          onClose={() => { setIsPinModalOpen(false); setPendingView(null); setPendingTableId(null); }}
          onVerify={handlePinVerify}
        />
        <Dashboard onNavigate={handleNavigate} />
      </>
    )
  }

  if (view === 'USERS') {
    return (
      <div style={{ padding: '20px', color: 'white', background: '#1a1a1a', height: '100vh' }}>
        <button onClick={handleBackToDashboard} style={{ background: 'transparent', color: '#888', border: 'none', cursor: 'pointer', fontSize: '1.2rem', marginBottom: '20px' }}>← Menú Principal</button>
        <h1>Gestión de Usuarios</h1>
        <p>Bienvenido, {currentUser?.nombre}</p>
        <div style={{ padding: '50px', textAlign: 'center', border: '2px dashed #444', borderRadius: '10px' }}>
          🚧 Módulo en construcción 🚧
        </div>
      </div>
    )
  }

  if (view === 'REPORT') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 20px', background: '#1a1a1a', borderBottom: '1px solid #404040' }}>
          <button onClick={handleBackToDashboard} style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
            ← Volver al Menú
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <DailyReport />
        </div>
      </div>
    )
  }

  if (view === 'TABLES') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Modal de PIN aquí también por si el usuario está en esta vista y selecciona mesa */}
        <PinPadModal 
          title={pinTitle}
          isOpen={isPinModalOpen} 
          onClose={() => { setIsPinModalOpen(false); setPendingTableId(null); }}
          onVerify={handlePinVerify}
        />
        
        <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', background: '#1a1a1a', alignItems: 'center' }}>
          <button onClick={handleBackToDashboard} style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
            ← Menú Principal
          </button>
          <div style={{ fontWeight: 'bold', color: 'white' }}>MAPA DE MESAS</div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {/* AQUÍ ESTABA EL CAMBIO CLAVE: Usamos handleSelectTableRequest en lugar de abrir directo */}
          <TableGrid tables={tables} onSelectTable={handleSelectTableRequest} />
        </div>
      </div>
    )
  }

  // VISTA ORDER (POS)
  return (
    <div className="pos-container">
      {/* Navegación Orden */}
      <div style={{ position: 'absolute', top: 10, left: 20, zIndex: 100 }}>
        <button onClick={handleBackToTables} style={{ padding: '10px 20px', background: '#404040', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>← Volver a Mesas</button>
        <span style={{ marginLeft: '20px', color: 'white', fontWeight: 'bold' }}>Mesa #{tables.find(t => t.id === activeTableId)?.numero}</span>
      </div>

      <div className="products-section" style={{ paddingTop: '60px' }}>
        <h2>Menú</h2>
        <div className="products-grid">
          {products.map((product) => (
            <div key={product.id} className="product-card" onClick={() => addToCart(product)}>
              <h3>{product.nombre}</h3>
              <div className="product-price">${product.precio.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="ticket-section" style={{ paddingTop: '60px' }}>
        <OrderCart 
          cart={cart} total={total} orderId={activeOrderId}
          onPay={() => {}} 
          onRemove={removeFromCart} onUpdateQuantity={updateQuantity}
          onGenerateCommand={handleGenerateCommand} onRequestBill={handleRequestBill}
          onFinalizePayment={() => setIsPaymentModalOpen(true)}
          onCancelOrder={handleCancelOrder} 
          orderStatus={orderStatus}
        />
      </div>

      <PaymentModal 
        isOpen={isPaymentModalOpen} total={total}
        onClose={() => setIsPaymentModalOpen(false)} onConfirmPayment={handlePaymentConfirm}
      />

      {kitchenData && (
        <KitchenCommand items={kitchenData.items} tableNum={kitchenData.tableNum} onClose={() => setKitchenData(null)} />
      )}

      {ticketData && (
        <TicketReceipt 
          {...ticketData}
          onClose={() => { setTicketData(null); if (ticketData.payment.method !== 'PENDIENTE') handleBackToTables() }}
          onPrint={() => { setTicketData(null); if (ticketData.payment.method !== 'PENDIENTE') handleBackToTables() }}
        />
      )}
    </div>
  )
}

export default App