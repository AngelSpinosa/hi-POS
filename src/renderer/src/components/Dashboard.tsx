import { useState } from 'react'
import type { AppConfig } from '../types/db'
import { DashboardHeader } from '../components/DashboardHeader'

// Importación de Íconos SVG locales
import IconTable from '../assets/icons/TableRestaurant.svg'
import IconAnalytics from '../assets/icons/Analytics.svg'
import IconPizza from '../assets/icons/Pizza.svg'
import IconUsers from '../assets/icons/Users.svg'
import IconSettings from '../assets/icons/Settings.svg'
import IconDelivery from '../assets/icons/bike.svg' // Añadido para Envíos
import IconDiscount from '../assets/icons/Discount.svg' // Añadido para Descuentos
import IconTakeaway from '../assets/icons/takeout.svg' // Añadido para Para llevar
import IconLogout from '../assets/icons/Logout.svg'
import IconClose from '../assets/icons/Close.svg'

interface DashboardProps {
  // Actualizado para incluir las nuevas vistas (DELIVERY, PROMOS y TAKEAWAY)
  onNavigate: (view: 'TABLES' | 'REPORT' | 'USERS' | 'PRODUCTS' | 'SETTINGS' | 'DELIVERY' | 'PROMOS' | 'TAKEAWAY') => void;
  licenseInfo?: { type: string; remainingDays?: number } | null;
  appConfig?: AppConfig | null;
}

export function Dashboard({ onNavigate, licenseInfo, appConfig }: DashboardProps) {
  // VERIFICAR ESTADO GUARDADO EN LOCALSTORAGE PARA OCULTAR EL BANNER
  const [showDemoBanner, setShowDemoBanner] = useState(() => {
    return localStorage.getItem('hideDemoBanner') !== 'true'
  })

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

  return (
    <div className="dashboard-container">
      
      <DashboardHeader appConfig={appConfig} licenseInfo={licenseInfo} />

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

          {/* BOTÓN PARA LLEVAR */}
          <div className="pos-card" onClick={() => onNavigate('TAKEAWAY')}>
            <img src={IconTakeaway} alt="Para llevar" className="pos-card-icon" />
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
            {/* El ícono es un <img src="...svg">, no un SVG inline, así que "color"/"fill"
                normales no lo tocan — se usa filter para teñirlo del mismo rojo que el
                borde/texto de pos-card-danger. Si el rojo no calza exacto con tu paleta,
                puedes regenerar el filter en https://codepen.io/sosuke/pen/Pjoqqp */}
            <img 
              src={IconLogout} 
              alt="Salir" 
              className="pos-card-icon" 
              style={{ filter: 'invert(24%) sepia(94%) saturate(4711%) hue-rotate(353deg) brightness(97%) contrast(93%)' }} 
            />
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