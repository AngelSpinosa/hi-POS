import { useState, useEffect } from 'react'

interface DashboardProps {
  onNavigate: (view: 'TABLES' | 'REPORT' | 'USERS') => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
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
    color: 'white', padding: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1a1a1a', color: 'white' }}>
      
      {/* Header con Logo y Reloj */}
      <div style={{ padding: '30px 50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', background: 'linear-gradient(to right, #fbbf24, #eab308)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            POS PIZZA
          </h1>
          <div style={{ color: '#888', marginTop: '5px' }}>Sistema de Gestión v1.0</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ color: '#888' }}>
            {time.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </div>

      {/* Grid de Menú Principal */}
      <div style={{ flex: 1, padding: '50px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '30px', alignContent: 'center' }}>
        
        {/* Opción 1: VENTAS (Principal) */}
        <div 
          onClick={() => onNavigate('TABLES')}
          style={{ ...btnStyle, background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)', borderColor: '#3b82f6' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ fontSize: '4rem', marginBottom: '15px' }}>🍕</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>VENTAS</div>
          <div style={{ color: '#bfdbfe', marginTop: '5px' }}>Mesas y Pedidos</div>
        </div>

        {/* Opción 2: REPORTES */}
        <div 
          onClick={() => onNavigate('REPORT')}
          style={btnStyle}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.borderColor = '#fbbf24' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = '#404040' }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '15px' }}>📊</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>REPORTES</div>
          <div style={{ color: '#9ca3af', marginTop: '5px' }}>Cortes y Estadísticas</div>
        </div>

        {/* Opción 3: USUARIOS (Admin) */}
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

        {/* Opción 4: SALIR */}
        <div 
          onClick={() => window.close()} // Cierra la app (en electron)
          style={{ ...btnStyle, background: '#2d2d2d' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.borderColor = '#ef4444' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = '#404040' }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '15px' }}>🔴</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>SALIR</div>
          <div style={{ color: '#9ca3af', marginTop: '5px' }}>Cerrar Sistema</div>
        </div>

      </div>
    </div>
  )
}