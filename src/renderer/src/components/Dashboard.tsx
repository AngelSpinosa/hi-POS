import { useState, useEffect } from 'react'
import type { AppConfig } from '../types/db'

// Importación de Íconos SVG locales
import IconTable from '../assets/icons/TableRestaurant.svg'
import IconAnalytics from '../assets/icons/Analytics.svg'
import IconPizza from '../assets/icons/Pizza.svg'
import IconUsers from '../assets/icons/Users.svg'
import IconSettings from '../assets/icons/Settings.svg'
import IconLogout from '../assets/icons/Logout.svg'
import IconClose from '../assets/icons/Close.svg'

interface DashboardProps {
  onNavigate: (view: 'TABLES' | 'REPORT' | 'USERS' | 'PRODUCTS' | 'SETTINGS') => void;
  licenseInfo?: { type: string; remainingDays?: number } | null;
  appConfig?: AppConfig | null;
}

export function Dashboard({ onNavigate, licenseInfo, appConfig }: DashboardProps) {
  const [time, setTime] = useState(new Date())
  const [showDemoBanner, setShowDemoBanner] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const handleInjectDemoData = async () => {
    if (confirm('🍔 ¿Estás seguro? Esto añadirá Mesas, Usuarios (Admin PIN: 1234), Productos e Insumos preconfigurados para que pruebes el sistema.')) {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('inject-demo-data')
      if (res.success) {
        alert('✅ ¡Datos de prueba cargados con éxito! Explora las diferentes secciones.')
      } else {
        alert('❌ Error al cargar datos: ' + res.error)
      }
    }
  }

  const onSelectCategory = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === 'pizza') {
      handleInjectDemoData();
      e.target.value = ''; 
    }
  }

  const displayBusinessName = appConfig?.business_name ? appConfig.business_name : 'NOMBRE DEL\nNEGOCIO';

  return (
    <div className="dashboard-container">
      
      {/* HEADER: Nombre y Reloj */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1 className="brand-title">
            {displayBusinessName}
          </h1>
          
          {licenseInfo?.type === 'DEMO' && (
            <div className="demo-pill">
              Modo Demo, le quedan {licenseInfo.remainingDays} días de prueba ⚠️
            </div>
          )}
        </div>

        <div className="time-display">
          <div className="time-hours">HORA : {formatTime(time)}</div>
          <div className="time-date">{formatDate(time)}</div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* GRID DE MÓDULOS */}
        <div className="cards-grid">
          <div className="pos-card" onClick={() => onNavigate('TABLES')}>
            <img src={IconTable} alt="Mesas" className="pos-card-icon" />
            <h2 className="pos-card-title">Mesas</h2>
            <p className="pos-card-subtitle">Ver mapa y órdenes</p>
          </div>

          <div className="pos-card" onClick={() => onNavigate('REPORT')}>
            <img src={IconAnalytics} alt="Reportes" className="pos-card-icon" />
            <h2 className="pos-card-title">Reportes</h2>
            <p className="pos-card-subtitle">Cortes de caja y estadísticas</p>
          </div>

          <div className="pos-card" onClick={() => onNavigate('PRODUCTS')}>
            <img src={IconPizza} alt="Productos e Insumos" className="pos-card-icon" />
            <h2 className="pos-card-title">Productos e<br/>insumos</h2>
            <p className="pos-card-subtitle">Inventario y recetas</p>
          </div>

          <div className="pos-card" onClick={() => onNavigate('USERS')}>
            <img src={IconUsers} alt="Usuarios" className="pos-card-icon" />
            <h2 className="pos-card-title">Usuarios</h2>
            <p className="pos-card-subtitle">Personal y accesos</p>
          </div>

          <div className="pos-card" onClick={() => onNavigate('SETTINGS')}>
            <img src={IconSettings} alt="Ajustes" className="pos-card-icon" />
            <h2 className="pos-card-title">Ajustes</h2>
            <p className="pos-card-subtitle">Sistema y tickets</p>
          </div>

          <div className="pos-card pos-card-danger" onClick={() => window.close()}>
            <img src={IconLogout} alt="Salir" className="pos-card-icon" />
            <h2 className="pos-card-title">Salir</h2>
            <p className="pos-card-subtitle">Cerrar App</p>
          </div>
        </div>

        {/* BANNER DE DATOS DE PRUEBA */}
        {showDemoBanner && (
          <div className="demo-banner">
            <button className="banner-close" onClick={() => setShowDemoBanner(false)} title="Cerrar banner">
              <img src={IconClose} alt="Cerrar" />
            </button>
            
            <div className="banner-content">
              <h3>¿Es tu primera vez explorando el sistema?</h3>
              <p>
                Carga un menú base para tu tipo de negocio, para que pruebes funcionalidades como las ventas y reportes
              </p>
            </div>

            <div className="banner-actions">
              <select className="demo-dropdown" onChange={onSelectCategory}>
                <option value="">Seleccionar categoría ▼</option>
                <option value="pizza">🍕 Pizzería (Cargar Datos)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* MARCA DE AGUA INFERIOR */}
      <div className="hipos-logo">
        hi-POS
      </div>
    </div>
  )
}