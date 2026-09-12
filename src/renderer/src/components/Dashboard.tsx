import { useState, useEffect } from 'react'
import type { AppConfig } from '../types/db'

// Importación de Íconos SVG locales
import IconTable from '../assets/icons/TableRestaurant.svg'
import IconAnalytics from '../assets/icons/Analytics.svg'
import IconPizza from '../assets/icons/Pizza.svg'
import IconUsers from '../assets/icons/Users.svg'
import IconSettings from '../assets/icons/Settings.svg'
import IconDelivery from '../assets/icons/bike.svg' // Añadido para Envíos
import IconDiscount from '../assets/icons/Discount.svg' // Añadido para Descuentos
import IconLogout from '../assets/icons/Logout.svg'
import IconClose from '../assets/icons/Close.svg'

interface DashboardProps {
  // Actualizado para incluir las nuevas vistas (DELIVERY, PROMOS y TAKEAWAY)
  onNavigate: (view: 'TABLES' | 'REPORT' | 'USERS' | 'PRODUCTS' | 'SETTINGS' | 'DELIVERY' | 'PROMOS' | 'TAKEAWAY') => void;
  licenseInfo?: { type: string; remainingDays?: number } | null;
  appConfig?: AppConfig | null;
}

export function Dashboard({ onNavigate, licenseInfo, appConfig }: DashboardProps) {
  const [time, setTime] = useState(new Date())
  
  // VERIFICAR ESTADO GUARDADO EN LOCALSTORAGE PARA OCULTAR EL BANNER
  const [showDemoBanner, setShowDemoBanner] = useState(() => {
    return localStorage.getItem('hideDemoBanner') !== 'true'
  })

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

  // FUNCIÓN PARA CERRAR EL BANNER PERMANENTEMENTE
  const handleDismissBanner = () => {
    localStorage.setItem('hideDemoBanner', 'true')
    setShowDemoBanner(false)
  }

  // NUEVO: Recibe la categoría y el nombre para hacerlo dinámico
  const handleInjectDemoData = async (category: string, categoryName: string) => {
    if (confirm(`¿Estás seguro? Esto añadirá un menú base de ${categoryName}, junto con su inventario y recetas para que pruebes el sistema. (PIN de Admin: 1234)`)) {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('inject-demo-data', { category })
      if (res.success) {
        alert('¡Datos de prueba cargados con éxito! Ve al módulo de Productos e Insumos para ver la magia.')
        handleDismissBanner() // Lo ocultamos automáticamente tras inyectar con éxito
      } else {
        alert('Error al cargar datos: ' + res.error)
      }
    }
  }

  // NUEVO: Extrae el valor dinámicamente sin limitarlo solo a "pizza"
  const onSelectCategory = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const text = e.target.options[e.target.selectedIndex].text;
    if (value !== '') {
      handleInjectDemoData(value, text);
      e.target.value = ''; // Resetear el select
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
              Modo Demo, le quedan {licenseInfo.remainingDays} días de prueba
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
          
          {/* BOTÓN MESAS */}
          <div className="pos-card" onClick={() => onNavigate('TABLES')}>
            <img src={IconTable} alt="Mesas" className="pos-card-icon" />
            <h2 className="pos-card-title">Mesas</h2>
            <p className="pos-card-subtitle">Ver mapa y órdenes</p>
          </div>

          {/* NUEVO BOTÓN ENVÍOS */}
          <div className="pos-card" onClick={() => onNavigate('DELIVERY')}>
            <img src={IconDelivery} alt="Envíos" className="pos-card-icon" />
            <h2 className="pos-card-title">Envíos</h2>
            <p className="pos-card-subtitle">Pedidos a domicilio</p>
          </div>

          {/* NUEVO BOTÓN PARA LLEVAR */}
          {/* No existe un ícono SVG dedicado todavía (ni bag.svg ni door.svg en assets/icons),
              así que se usa un SVG inline en lugar de importar un archivo que podría no existir.
              Si luego agregas un ícono propio, basta con reemplazar este <svg> por <img src={IconTakeaway} .../> */}
          <div className="pos-card" onClick={() => onNavigate('TAKEAWAY')}>
            <svg className="pos-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '48px', height: '48px' }}>
              <path d="M6 2 L18 2 L20 8 L4 8 Z" strokeLinejoin="round" />
              <path d="M4 8 L5.5 21 L18.5 21 L20 8" strokeLinejoin="round" />
              <path d="M9 12 C9 12 9 14 12 14 C15 14 15 12 15 12" strokeLinecap="round" />
            </svg>
            <h2 className="pos-card-title">Para llevar</h2>
            <p className="pos-card-subtitle">Abrir órdenes para llevar</p>
          </div>

          {/* BOTÓN REPORTES */}
          <div className="pos-card" onClick={() => onNavigate('REPORT')}>
            <img src={IconAnalytics} alt="Reportes" className="pos-card-icon" />
            <h2 className="pos-card-title">Reportes</h2>
            <p className="pos-card-subtitle">Cortes de caja y estadísticas</p>
          </div>

          {/* BOTÓN PRODUCTOS */}
          <div className="pos-card" onClick={() => onNavigate('PRODUCTS')}>
            <img src={IconPizza} alt="Productos e Insumos" className="pos-card-icon" />
            <h2 className="pos-card-title">Productos e<br/>insumos</h2>
            <p className="pos-card-subtitle">Inventario y recetas</p>
          </div>

          {/* BOTÓN USUARIOS */}
          <div className="pos-card" onClick={() => onNavigate('USERS')}>
            <img src={IconUsers} alt="Usuarios" className="pos-card-icon" />
            <h2 className="pos-card-title">Usuarios</h2>
            <p className="pos-card-subtitle">Personal y accesos</p>
          </div>

          {/* BOTÓN AJUSTES */}
          <div className="pos-card" onClick={() => onNavigate('SETTINGS')}>
            <img src={IconSettings} alt="Ajustes" className="pos-card-icon" />
            <h2 className="pos-card-title">Ajustes</h2>
            <p className="pos-card-subtitle">Sistema y tickets</p>
          </div>

          {/* NUEVO BOTÓN DESCUENTOS */}
          <div className="pos-card" onClick={() => onNavigate('PROMOS')}>
            <img src={IconDiscount} alt="Descuentos" className="pos-card-icon" />
            <h2 className="pos-card-title">Descuentos</h2>
            <p className="pos-card-subtitle">Gestionar promociones</p>
          </div>

          {/* BOTÓN SALIR */}
          <div className="pos-card pos-card-danger" onClick={() => window.close()}>
            <img src={IconLogout} alt="Salir" className="pos-card-icon" />
            <h2 className="pos-card-title">Salir</h2>
            <p className="pos-card-subtitle">Cerrar App</p>
          </div>
        </div>

        {/* BANNER DE DATOS DE PRUEBA */}
        {showDemoBanner && (
          <div className="demo-banner">
            <button className="banner-close" onClick={handleDismissBanner} title="Ocultar para siempre">
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
                {/* AQUI ESTÁN LAS NUEVAS OPCIONES DE CATEGORÍA */}
                <option value="pizza"> Pizzería</option>
                <option value="restaurante"> Restaurante / Fast Food</option>
                <option value="cafe"> Cafetería</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* MARCA DE AGUA INFERIOR */}
      <div className="hipos-logo">
        Hi-POS
      </div>
    </div>
  )
}