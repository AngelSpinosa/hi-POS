import { useState, useEffect } from 'react'

// Agregamos 'PRODUCTS' a los tipos permitidos
interface DashboardProps {
  onNavigate: (view: 'TABLES' | 'REPORT' | 'USERS' | 'PRODUCTS') => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const btnStyle = {
    background: '#2d2d2d', border: '1px solid #404040', borderRadius: '15px',
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'transform 0.1s, border-color 0.2s',
    color: 'white', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
    minHeight: '200px'
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1a1a1a', color: 'white' }}>
      
      {/* Header */}
      <div style={{ padding: '30px 50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#f97316' }}>POS PIZZERÍA 🍕</h1>
          <p style={{ margin: '5px 0 0 0', color: '#9ca3af' }}>Sistema de Punto de Venta v1.0</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ color: '#9ca3af' }}>
            {time.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </div>

      {/* Grid de Menú Principal */}
      <div style={{ 
        flex: 1, padding: '50px', 
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '30px', alignContent: 'center' 
      }}>
        
        {/* 1. MESAS */}
        <div 
          onClick={() => onNavigate('TABLES')}
          style={btnStyle}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.borderColor = '#f97316' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = '#404040' }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '15px' }}>🍽️</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>MESAS</div>
          <div style={{ color: '#9ca3af', marginTop: '5px' }}>Ver Mapa y Órdenes</div>
        </div>

        {/* 2. REPORTES */}
        <div 
          onClick={() => onNavigate('REPORT')}
          style={btnStyle}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.borderColor = '#3b82f6' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = '#404040' }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '15px' }}>📊</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>REPORTES</div>
          <div style={{ color: '#9ca3af', marginTop: '5px' }}>Cortes y Estadísticas</div>
        </div>

        {/* 3. PRODUCTOS */}
        <div 
          onClick={() => onNavigate('PRODUCTS')}
          style={btnStyle}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.borderColor = '#22c55e' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = '#404040' }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '15px' }}>🍕</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>PRODUCTOS</div>
          <div style={{ color: '#9ca3af', marginTop: '5px' }}>Inventario y Precios</div>
        </div>

        {/* 4. USUARIOS */}
        <div 
          onClick={() => onNavigate('USERS')}
          style={btnStyle}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.borderColor = '#fbbf24' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = '#404040' }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '15px' }}>👥</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>USUARIOS</div>
          <div style={{ color: '#9ca3af', marginTop: '5px' }}>Personal y Accesos</div>
        </div>

        {/* 5. SALIR */}
        <div 
          onClick={() => window.close()}
          style={{ ...btnStyle, background: '#450a0a' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.borderColor = '#ef4444' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = '#404040' }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '15px' }}>🚪</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>SALIR</div>
          <div style={{ color: '#9ca3af', marginTop: '5px' }}>Cerrar Sistema</div>
        </div>

      </div>
    </div>
  )
}