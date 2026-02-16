import { useEffect, useState, useCallback } from 'react'
import type { Mesa } from './types/db'
import { TableGrid } from './components/TableGrid'
import { DailyReport } from './components/DailyReport'
import { Dashboard } from './components/Dashboard'
import { PinPadModal } from './components/PinPadModal'
import { UserManagement } from './components/UserManagement'
import { POSView } from './views/POSView' // <--- Importamos la nueva vista

type ViewState = 'DASHBOARD' | 'TABLES' | 'ORDER' | 'REPORT' | 'USERS';

interface CurrentUser {
  id: number;
  nombre: string;
  rol: 'admin' | 'cajero';
}

function App() {
  const [view, setView] = useState<ViewState>('DASHBOARD')
  
  // Estado Global necesario para navegación (Mesas y Usuario)
  const [tables, setTables] = useState<Mesa[]>([])
  const [activeTableId, setActiveTableId] = useState<number | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  
  // Estados para el PIN Global (Navegación y Apertura de Mesa)
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [pinTitle, setPinTitle] = useState('Ingrese su PIN') 
  const [pendingView, setPendingView] = useState<ViewState | null>(null)
  const [pendingTableId, setPendingTableId] = useState<number | null>(null)

  const refreshTables = useCallback(async () => {
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('get-tables')
      setTables(result)
    } catch (error) { console.error(error) }
  }, [])

  useEffect(() => { refreshTables() }, [refreshTables])

  // --- NAVEGACIÓN Y SEGURIDAD ---

  const handleNavigate = (targetView: ViewState) => {
    if (targetView === 'REPORT' || targetView === 'USERS') {
      setPinTitle('Acceso Restringido 🔒')
      setPendingView(targetView)
      setIsPinModalOpen(true)
    } else if (targetView === 'TABLES') {
      setView('TABLES')
      refreshTables() // Refrescar estado de mesas al entrar
    } else {
      setView(targetView)
    }
  }

  const handleSelectTableRequest = (tableId: number) => {
    setPinTitle('Mesero responsable 👤')
    setPendingTableId(tableId)
    setIsPinModalOpen(true)
  }

  const handlePinVerify = async (pin: string) => {
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('verify-pin', { pin })
      
      if (result.success && result.user) {
        const user: CurrentUser = result.user
        setCurrentUser(user)
        setIsPinModalOpen(false) 
        
        // A. Navegación a módulos protegidos
        if (pendingView) {
          if ((pendingView === 'USERS' || pendingView === 'REPORT') && user.rol !== 'admin') {
            alert('Acceso Denegado: Se requieren permisos de Administrador.')
          } else {
            setView(pendingView)
          }
          setPendingView(null)
        }
  
        // B. Apertura de Mesa (POS)
        if (pendingTableId !== null) {
          // Intentamos abrir la mesa
          // @ts-ignore
          const openResult = await window.electron.ipcRenderer.invoke('open-table-order', { 
            tableId: pendingTableId, userId: user.id 
          })
          
          if (openResult.success) {
            setActiveTableId(pendingTableId)
            setView('ORDER')
          } else {
            alert(openResult.error)
          }
          setPendingTableId(null)
        }
      } else {
        alert(result.error || 'PIN Incorrecto')
      }
    } catch (error) {
      console.error(error)
      alert('Error de comunicación')
    }
  }

  const handleBackToDashboard = () => {
    setView('DASHBOARD')
    setCurrentUser(null) 
  }

  const handleBackToTables = async () => {
    setView('TABLES')
    setActiveTableId(null)
    await refreshTables()
  }

  // --- RENDERIZADO (Router Básico) ---

  if (view === 'DASHBOARD') {
    return (
      <>
        <PinPadModal title={pinTitle} isOpen={isPinModalOpen} onClose={() => { setIsPinModalOpen(false); setPendingView(null); setPendingTableId(null); }} onVerify={handlePinVerify} />
        <Dashboard onNavigate={handleNavigate} />
      </>
    )
  }

  if (view === 'USERS') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 20px', background: '#1a1a1a', borderBottom: '1px solid #404040' }}>
          <button onClick={handleBackToDashboard} style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>← Volver al Menú</button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <UserManagement />
        </div>
      </div>
    )
  }

  if (view === 'REPORT') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 20px', background: '#1a1a1a', borderBottom: '1px solid #404040' }}>
          <button onClick={handleBackToDashboard} style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>← Volver al Menú</button>
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
        <PinPadModal title={pinTitle} isOpen={isPinModalOpen} onClose={() => { setIsPinModalOpen(false); setPendingTableId(null); }} onVerify={handlePinVerify} />
        <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', background: '#1a1a1a', alignItems: 'center' }}>
          <button onClick={handleBackToDashboard} style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>← Menú Principal</button>
          <div style={{ fontWeight: 'bold', color: 'white' }}>MAPA DE MESAS</div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <TableGrid tables={tables} onSelectTable={handleSelectTableRequest} />
        </div>
      </div>
    )
  }

  // NUEVO: Usamos el componente POSView para la venta
  if (view === 'ORDER' && activeTableId) {
    const tableNum = tables.find(t => t.id === activeTableId)?.numero || 0
    return (
      <POSView 
        tableId={activeTableId} 
        tableNumber={tableNum} 
        onBack={handleBackToTables} 
      />
    )
  }

  return null
}

export default App