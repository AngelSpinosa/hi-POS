import { useEffect, useState, useCallback } from 'react'
import type { Mesa } from './types/db'
import { TableGrid } from './components/TableGrid'
import { DailyReport } from './components/DailyReport'
import { Dashboard } from './components/Dashboard'
import { PinPadModal } from './components/PinPadModal'
import { UserManagement } from './components/UserManagement'
import { POSView } from './views/POSView' 
import { ProductManagement } from './components/ProductManagement' 
// NUEVO: IMPORTAMOS LA PANTALLA DE LICENCIA
import { LicenseScreen } from './components/LicenseScreen'

// NUEVO: Añadimos 'LICENSE_ERROR' a las vistas posibles
type ViewState = 'DASHBOARD' | 'TABLES' | 'ORDER' | 'REPORT' | 'USERS' | 'PRODUCTS' | 'LICENSE_ERROR';

interface CurrentUser {
  id: number;
  nombre: string;
  rol: 'admin' | 'cajero';
}

function App() {
  // Empezamos asumiendo que estamos cargando la validación
  const [view, setView] = useState<ViewState>('DASHBOARD')
  const [isCheckingLicense, setIsCheckingLicense] = useState(true)
  const [licenseErrorReason, setLicenseErrorReason] = useState<string>('')
  
  const [tables, setTables] = useState<Mesa[]>([])
  const [activeTableId, setActiveTableId] = useState<number | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [pinTitle, setPinTitle] = useState('Ingrese su PIN') 
  const [pendingView, setPendingView] = useState<ViewState | null>(null)
  const [pendingTableId, setPendingTableId] = useState<number | null>(null)

  // ==========================================
  // NUEVO: FLUJO DE VALIDACIÓN DE LICENCIA
  // ==========================================
  useEffect(() => {
    checkLicenseStatus()
  }, [])

  const checkLicenseStatus = async () => {
    setIsCheckingLicense(true)
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('license:check')
      
      if (result.valid) {
        // Licencia OK, cargamos los datos normales y vamos al Dashboard
        loadTables()
        setView('DASHBOARD')
      } else {
        // Licencia fallida, bloqueamos en la pantalla de error
        setLicenseErrorReason(result.reason || 'NO_LICENSE')
        setView('LICENSE_ERROR')
      }
    } catch (error) {
      console.error('Error validando licencia:', error)
      setLicenseErrorReason('ERROR_CONEXION')
      setView('LICENSE_ERROR')
    } finally {
      setIsCheckingLicense(false)
    }
  }

  // Función que se llama cuando el usuario logra activar la licencia correctamente
  const handleLicenseActivated = () => {
    checkLicenseStatus()
  }
  // ==========================================

  const loadTables = async () => {
    try {
      // @ts-ignore
      const data = await window.electron.ipcRenderer.invoke('get-tables')
      setTables(data)
    } catch (err) { console.error(err) }
  }

  const requestViewChange = (targetView: ViewState, title: string) => {
    setPendingView(targetView)
    setPinTitle(title)
    setIsPinModalOpen(true)
  }

  const handlePinVerify = async (pin: string) => {
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('verify-pin', { pin })
      
      if (result.success) {
        const user = result.user
        setCurrentUser(user)

        if (pendingView === 'TABLES') {
          if (pendingTableId) {
             await openTableOrder(pendingTableId, user.id)
          } else {
             loadTables()
             setView('TABLES')
          }
        }
        else if (['REPORT', 'USERS', 'PRODUCTS'].includes(pendingView || '')) {
          if (user.rol === 'admin') {
            if (pendingView) setView(pendingView)
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
    } catch (error) { console.error(error) }
  }

  const openTableOrder = async (tableId: number, userId: number) => {
    setActiveTableId(tableId)
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('open-table-order', { tableId, userId })
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

  // --- RENDERIZADO CONDICIONAL ---

  // NUEVO: Mostrar pantalla de carga mientras valida la licencia
  if (isCheckingLicense) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#111', color: 'white', alignItems: 'center', justifyContent: 'center' }}>
        <h1 style={{ color: '#f97316', marginBottom: '20px' }}>POS PIZZA 🍕</h1>
        <div style={{ color: '#9ca3af', fontSize: '1.2rem' }}>Verificando licencia...</div>
      </div>
    )
  }

  // NUEVO: Bloqueo de Licencia
  if (view === 'LICENSE_ERROR') {
    return <LicenseScreen onLicenseActivated={handleLicenseActivated} reason={licenseErrorReason} />
  }

  if (view === 'DASHBOARD') {
    return (
      <>
        <PinPadModal title={pinTitle} isOpen={isPinModalOpen} onClose={() => { setIsPinModalOpen(false); setPendingView(null); }} onVerify={handlePinVerify} />
        <Dashboard 
          onNavigate={(v) => {
            const titles: Record<string, string> = {
              'TABLES': 'Acceso a Mesas',
              'REPORT': 'Acceso a Reportes',
              'USERS': 'Gestión de Usuarios',
              'PRODUCTS': 'Gestión de Productos'
            }
            requestViewChange(v as ViewState, titles[v])
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
    // @ts-ignore
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
        onBack={() => {
          loadTables()
          setView('TABLES')
        }} 
      />
    )
  }

  return <div style={{height: '100vh', background: '#1a1a1a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Cargando...</div>
}

export default App