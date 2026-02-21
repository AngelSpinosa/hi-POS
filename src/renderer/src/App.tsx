import { useEffect, useState } from 'react'
import type { Mesa } from './types/db'
import { TableGrid } from './components/TableGrid'
import { DailyReport } from './components/DailyReport'
import { Dashboard } from './components/Dashboard'
import { PinPadModal } from './components/PinPadModal'
import { UserManagement } from './components/UserManagement'
import { ProductManagement } from './components/ProductManagement'
import { POSView } from './views/POSView'

// Definimos TODOS los estados posibles de la vista
type ViewState = 'DASHBOARD' | 'TABLES' | 'ORDER' | 'REPORT' | 'USERS' | 'PRODUCTS';

// Interfaz para la navegación que viene del Dashboard (limitada)
type DashboardNav = 'TABLES' | 'REPORT' | 'USERS';

interface CurrentUser {
  id: number;
  nombre: string;
  rol: 'admin' | 'cajero';
}

function App() {
  const [view, setView] = useState<ViewState>('DASHBOARD')
  
  const [tables, setTables] = useState<Mesa[]>([])
  const [activeTableId, setActiveTableId] = useState<number | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  
  // Seguridad y Navegación
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [pinTitle, setPinTitle] = useState('Ingrese su PIN') 
  const [pendingView, setPendingView] = useState<ViewState | null>(null)
  const [pendingTableId, setPendingTableId] = useState<number | null>(null)

  useEffect(() => { loadTables() }, [])

  const loadTables = async () => {
    try {
      // @ts-ignore
      const data = await window.electron.ipcRenderer.invoke('get-tables')
      setTables(data)
    } catch (err) { console.error(err) }
  }

  // --- NAVEGACIÓN SEGURA ---

  // Solicitud de cambio de vista
  const requestViewChange = (targetView: ViewState, title: string) => {
    setPendingView(targetView)
    setPinTitle(title)
    setIsPinModalOpen(true)
  }

  // Verificar PIN
  const handlePinVerify = async (pin: string) => {
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('verify-pin', { pin })
      
      if (result.success) {
        const user = result.user
        setCurrentUser(user)

        // Lógica de Redirección según Permisos
        if (pendingView === 'TABLES') {
          if (pendingTableId) {
             await openTableOrder(pendingTableId, user.id)
          } else {
             setView('TABLES')
          }
        }
        else if (pendingView === 'REPORT' || pendingView === 'USERS' || pendingView === 'PRODUCTS') {
          if (user.rol === 'admin') {
            setView(pendingView)
          } else {
            alert('Acceso denegado: Se requieren permisos de Administrador.')
            return
          }
        }

        setIsPinModalOpen(false)
        setPendingView(null)
        setPendingTableId(null)
      } else {
        alert('PIN Incorrecto')
      }
    } catch (error) {
      console.error(error)
    }
  }

  const openTableOrder = async (tableId: number, userId: number) => {
    setActiveTableId(tableId)
    // Inicializar orden en backend si es necesario
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('open-table-order', { mesaId: tableId, userId })
    setView('ORDER')
  }

  const handleSelectTableRequest = (id: number) => {
    setPendingTableId(id)
    setPendingView('TABLES')
    setPinTitle(`Mesa ${id}: Ingrese PIN`)
    setIsPinModalOpen(true)
  }

  const handleBackToDashboard = () => {
    setView('DASHBOARD')
    setActiveTableId(null)
    setPendingTableId(null)
    setCurrentUser(null)
  }

  // --- RENDERIZADO ---

  if (view === 'DASHBOARD') {
    return (
      <>
        <PinPadModal 
          title={pinTitle} 
          isOpen={isPinModalOpen} 
          onClose={() => { setIsPinModalOpen(false); setPendingView(null); }} 
          onVerify={handlePinVerify} 
        />
        
        {/* Renderizamos el Dashboard existente */}
        <Dashboard 
          onNavigate={(v: DashboardNav) => {
            const titles: Record<DashboardNav, string> = {
              'TABLES': 'Acceso a Mesas',
              'REPORT': 'Acceso a Reportes',
              'USERS': 'Gestión de Usuarios'
            }
            requestViewChange(v, titles[v])
          }}
        />
      </>
    )
  }

  if (view === 'REPORT') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', background: '#1a1a1a', alignItems: 'center' }}>
          <button onClick={handleBackToDashboard} style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>← Menú Principal</button>
          <div style={{ fontWeight: 'bold', color: 'white' }}>REPORTE DIARIO</div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <DailyReport />
        </div>
      </div>
    )
  }

  if (view === 'USERS') {
    // @ts-ignore: Ignoramos error de TS si UserManagement no define props explícitamente en tu versión local
    return <UserManagement onBack={handleBackToDashboard} />
  }

  if (view === 'PRODUCTS') {
    return <ProductManagement onBack={handleBackToDashboard} />
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

  if (view === 'ORDER' && activeTableId) {
    return (
      <POSView 
        tableId={activeTableId} 
        userId={currentUser?.id} 
        onBack={() => setView('TABLES')} 
      />
    )
  }

  return <div style={{height: '100vh', background: '#1a1a1a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Cargando...</div>
}

export default App