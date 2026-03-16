import { useState, useEffect } from 'react'

// ACTUALIZADO: Añadido 'PRODUCTS' a las opciones de navegación permitidas
interface DashboardProps {
  onNavigate: (view: 'TABLES' | 'REPORT' | 'USERS' | 'PRODUCTS') => void;
  licenseInfo?: { type: string; remainingDays?: number } | null; // NUEVO: Recibimos la info
}

export function Dashboard({ onNavigate, licenseInfo }: DashboardProps) { // ACTUALIZADO
  const [time, setTime] = useState(new Date())

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const btnStyle = {
    background: '#2d2d2d', border: '1px solid #404040', borderRadius: '15px',
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'transform 0.1s, border-color 0.2s',
    color: 'white', padding: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
    minHeight: '220px'
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1a1a1a', color: 'white' }}>
      
      {/* Header con Logo y Reloj */}
      <div style={{ padding: '30px 50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#f97316' }}>POS PIZZERÍA 🍕</h1>
          <p style={{ margin: '5px 0 0 0', color: '#9ca3af' }}>Sistema de Punto de Venta v1.0</p>
          
          {/* NUEVO: Etiqueta visible SOLO cuando la licencia es DEMO */}
          {licenseInfo?.type === 'DEMO' && (
            <div style={{ marginTop: '12px', display: 'inline-block', padding: '6px 14px', background: '#450a0a', border: '1px solid #ef4444', borderRadius: '20px', color: '#fca5a5', fontSize: '0.85rem', fontWeight: 'bold' }}>
              ⚠️ Modo Demo, le quedan {licenseInfo.remainingDays} días de prueba
            </div>
          )}
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
        
        {/* Opción 1: MESAS */}
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

        {/* Opción 2: REPORTES */}
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

        {/* Opción 3: PRODUCTOS (NUEVO) */}
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

        {/* Opción 4: USUARIOS */}
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

        {/* Opción 5: SALIR */}
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