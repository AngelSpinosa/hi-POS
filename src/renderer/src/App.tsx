import { useEffect, useState, useCallback } from 'react'
import type { Mesa } from './types/db'
import { TableGrid } from './components/TableGrid'
import { DailyReport } from './components/DailyReport'
import { Dashboard } from './components/Dashboard'
import { PinPadModal } from './components/PinPadModal'
import { UserManagement } from './components/UserManagement'
import { POSView } from './views/POSView' 
import { ProductManagement } from './components/ProductManagement' 
import { LicenseScreen } from './components/LicenseScreen'

type ViewState = 'DASHBOARD' | 'TABLES' | 'ORDER' | 'REPORT' | 'USERS' | 'PRODUCTS' | 'LICENSE_ERROR';

interface CurrentUser {
  id: number;
  nombre: string;
  rol: 'admin' | 'cajero';
}

function App() {
  const [view, setView] = useState<ViewState>('DASHBOARD')
  
  // Estados de la Licencia
  const [isCheckingLicense, setIsCheckingLicense] = useState(true)
  const [licenseErrorReason, setLicenseErrorReason] = useState<string>('')
  const [hasValidLicense, setHasValidLicense] = useState<boolean>(false) // NUEVO: Memoria de seguridad
  const [licenseInfo, setLicenseInfo] = useState<{type: string, remainingDays?: number} | null>(null) // NUEVO: Memoria de datos de la licencia
  
  const [tables, setTables] = useState<Mesa[]>([])
  const [activeTableId, setActiveTableId] = useState<number | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [pinTitle, setPinTitle] = useState('Ingrese su PIN') 
  const [pendingView, setPendingView] = useState<ViewState | null>(null)
  const [pendingTableId, setPendingTableId] = useState<number | null>(null)

  useEffect(() => {
    checkLicenseStatus()
  }, [])

  const checkLicenseStatus = async () => {
    setIsCheckingLicense(true)
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('license:check')
      
      if (result.valid) {
        setHasValidLicense(true)
        setLicenseInfo({ type: result.type, remainingDays: result.remainingDays }) // Guardamos la info enviada por el backend
        loadTables()
        setView('DASHBOARD')
      } else {
        setHasValidLicense(false)
        setLicenseErrorReason(result.reason || 'NO_LICENSE')
        setView('LICENSE_ERROR')
      }
    } catch (error) {
      console.error('Error validando licencia:', error)
      setHasValidLicense(false)
      setLicenseErrorReason('ERROR_CONEXION')
      setView('LICENSE_ERROR')
    } finally {
      setIsCheckingLicense(false)
    }
  }

  const handleLicenseActivated = () => {
    checkLicenseStatus()
  }

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

  // NUEVO: La función de regresar ahora respeta si tienes licencia o no
  const handleBackToDashboard = () => {
    setActiveTableId(null)
    setPendingTableId(null)
    setCurrentUser(null)
    
    if (hasValidLicense) {
      setView('DASHBOARD')
    } else {
      setView('LICENSE_ERROR') // Te regresa a la pantalla de bloqueo
    }
  }

  // --- RENDERIZADO CONDICIONAL ---

  if (isCheckingLicense) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#111', color: 'white', alignItems: 'center', justifyContent: 'center' }}>
        <h1 style={{ color: '#f97316', marginBottom: '20px' }}>POS PIZZA 🍕</h1>
        <div style={{ color: '#9ca3af', fontSize: '1.2rem' }}>Verificando licencia...</div>
      </div>
    )
  }

  if (view === 'LICENSE_ERROR') {
    return (
      <>
        {/* Incluimos el Modal del PIN aquí también para proteger los reportes */}
        <PinPadModal title={pinTitle} isOpen={isPinModalOpen} onClose={() => { setIsPinModalOpen(false); setPendingView(null); }} onVerify={handlePinVerify} />
        <LicenseScreen 
          onLicenseActivated={handleLicenseActivated} 
          reason={licenseErrorReason} 
          onViewReports={() => requestViewChange('REPORT', 'Acceso a Reportes (Admin)')}
        />
      </>
    )
  }

  if (view === 'DASHBOARD') {
    return (
      <>
        <PinPadModal title={pinTitle} isOpen={isPinModalOpen} onClose={() => { setIsPinModalOpen(false); setPendingView(null); }} onVerify={handlePinVerify} />
        <Dashboard 
          licenseInfo={licenseInfo} // NUEVO: Pasamos la info al Dashboard
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
          <button onClick={handleBackToDashboard} style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
            {hasValidLicense ? '← Menú Principal' : '← Volver a Activación'}
          </button>
          <div style={{ fontWeight: 'bold', color: 'white' }}>
            REPORTE DIARIO {hasValidLicense ? '' : '(SOLO LECTURA)'}
          </div>
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