import { useState, useEffect } from 'react'
import type { AppConfig } from '../types/db'

interface DashboardProps {
  onNavigate: (view: 'TABLES' | 'REPORT' | 'USERS' | 'PRODUCTS' | 'SETTINGS') => void;
  licenseInfo?: { type: string; remainingDays?: number } | null;
  appConfig?: AppConfig | null;
}

export function Dashboard({ onNavigate, licenseInfo, appConfig }: DashboardProps) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  const handleInjectDemoData = async () => {
    if (confirm('🍔 ¿Estás seguro? Esto añadirá Mesas, Usuarios (Admin PIN: 1234), Productos e Insumos preconfigurados para que pruebes el sistema. Puedes borrarlos luego desde "Ajustes".')) {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('inject-demo-data')
      if (res.success) {
        alert('✅ ¡Datos de prueba cargados con éxito! Explora las diferentes secciones.')
      } else {
        alert('❌ Error al cargar datos: ' + res.error)
      }
    }
  }

  const cardStyle = {
    background: '#262626',
    borderRadius: '15px',
    padding: '25px 15px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '1px solid #333',
    transition: 'transform 0.1s, background 0.2s, box-shadow 0.2s',
    minHeight: '160px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
  }

  const iconStyle = { fontSize: '3rem', marginBottom: '10px' } 
  const titleStyle = { fontSize: '1.2rem', fontWeight: 'bold', margin: '0 0 5px 0', letterSpacing: '1px', textTransform: 'uppercase' as const }
  const subtitleStyle = { fontSize: '0.85rem', color: '#9ca3af', margin: 0 }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1a1a1a', color: 'white' }}>
      
      {/* HEADER DINÁMICO CON LOGO */}
      <div style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Renderizado de logo si existe */}
          {appConfig?.logo_path && (
            <img 
              src={appConfig.logo_path} 
              alt="Logo del Negocio" 
              style={{ width: '60px', height: '60px', objectFit: 'contain', borderRadius: '8px', background: '#fff', padding: '2px' }} 
            />
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--color-primary, #f97316)' }}>
              {appConfig?.business_name ? appConfig.business_name.toUpperCase() : 'POS PIZZERÍA'} {!appConfig?.logo_path && '🍕'}
            </h1>
            <p style={{ margin: '3px 0 0 0', color: '#9ca3af', fontSize: '0.9rem' }}>Sistema de Punto de Venta v1.0</p>
            
            {licenseInfo?.type === 'DEMO' && (
              <div style={{ marginTop: '10px', display: 'inline-block', padding: '5px 12px', background: '#450a0a', border: '1px solid #ef4444', borderRadius: '20px', color: '#fca5a5', fontSize: '0.8rem', fontWeight: 'bold' }}>
                ⚠️ Modo Demo, le quedan {licenseInfo.remainingDays} días de prueba
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
            {formatTime(time)}
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.9rem', textTransform: 'capitalize' }}>
            {formatDate(time)}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '30px 40px', overflowY: 'auto' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: '20px', 
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          
          <div style={cardStyle} onClick={() => onNavigate('TABLES')} className="menu-card">
            <div style={iconStyle}>🍽️</div>
            <h2 style={titleStyle}>Mesas</h2>
            <p style={subtitleStyle}>Ver Mapa y Órdenes</p>
          </div>

          <div style={cardStyle} onClick={() => onNavigate('REPORT')} className="menu-card">
            <div style={iconStyle}>📊</div>
            <h2 style={titleStyle}>Reportes</h2>
            <p style={subtitleStyle}>Cortes y Estadísticas</p>
          </div>

          <div style={cardStyle} onClick={() => onNavigate('PRODUCTS')} className="menu-card">
            <div style={iconStyle}>🍕</div>
            <h2 style={titleStyle}>Productos</h2>
            <p style={subtitleStyle}>Inventario y Precios</p>
          </div>

          <div style={cardStyle} onClick={() => onNavigate('USERS')} className="menu-card">
            <div style={iconStyle}>👥</div>
            <h2 style={titleStyle}>Usuarios</h2>
            <p style={subtitleStyle}>Personal y Accesos</p>
          </div>

          <div style={{...cardStyle, border: '1px solid var(--color-secondary, #1e3a8a)'}} onClick={() => onNavigate('SETTINGS')} className="menu-card">
            <div style={iconStyle}>⚙️</div>
            <h2 style={{...titleStyle, color: 'var(--color-secondary, #60a5fa)'}}>Ajustes</h2>
            <p style={subtitleStyle}>Sistema e Impresoras</p>
          </div>

          <div 
            style={{...cardStyle, background: '#450a0a', border: '1px solid #7f1d1d'}} 
            onClick={() => window.close()} 
            className="menu-card-danger"
          >
            <div style={iconStyle}>🚪</div>
            <h2 style={{...titleStyle, color: '#fca5a5'}}>Salir</h2>
            <p style={{...subtitleStyle, color: '#f87171'}}>Cerrar Sistema</p>
          </div>

        </div>

        {/* BANNER DE DATOS DE PRUEBA */}
        <div style={{ maxWidth: '1200px', margin: '40px auto 0 auto', background: 'rgba(59, 130, 246, 0.05)', border: '1px dashed var(--color-secondary, #3b82f6)', borderRadius: '15px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: '0 0 5px 0', color: 'var(--color-secondary, #93c5fd)' }}>¿Es tu primera vez explorando el sistema?</h3>
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9rem' }}>Carga un menú base de Pizzería, mesas y personal de prueba para que juegues con las ventas y reportes.</p>
          </div>
          <button 
            onClick={handleInjectDemoData}
            style={{ background: 'var(--color-secondary, #3b82f6)', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}
          >
            📥 Cargar Datos de Prueba
          </button>
        </div>

      </div>

      <style>{`
        .menu-card:hover {
          transform: translateY(-5px);
          background: #333 !important;
          border-color: #555 !important;
          box-shadow: 0 8px 15px rgba(0,0,0,0.4) !important;
        }
        .menu-card-danger:hover {
          transform: translateY(-5px);
          background: #7f1d1d !important;
          border-color: #ef4444 !important;
          box-shadow: 0 8px 15px rgba(239, 68, 68, 0.2) !important;
        }
      `}</style>

    </div>
  )
}