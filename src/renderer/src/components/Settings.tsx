import React from 'react'

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1a1a1a', color: 'white' }}>
      
      {/* Barra superior */}
      <div style={{ padding: '15px 30px', display: 'flex', justifyContent: 'space-between', background: '#2d2d2d', alignItems: 'center', borderBottom: '1px solid #404040' }}>
        <button onClick={onBack} style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}>
          ← Volver al Menú
        </button>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#3b82f6' }}>CONFIGURACIÓN DEL SISTEMA ⚙️</div>
        <div style={{ width: '130px' }}></div> {/* Espaciador */}
      </div>

      {/* Contenido (Placeholder UI) */}
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ borderBottom: '1px solid #333', paddingBottom: '10px', color: '#f97316', fontSize: '1.2rem' }}>Impresión y Tickets</h2>
            <div style={{ background: '#262626', padding: '25px', borderRadius: '10px', marginTop: '15px', color: '#9ca3af', border: '1px dashed #404040' }}>
              <p style={{ margin: 0 }}>🖨️ Configuraciones de impresora térmica, logo del negocio y mensaje al pie del ticket se agregarán aquí en la versión Post-MVP.</p>
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ borderBottom: '1px solid #333', paddingBottom: '10px', color: '#f97316', fontSize: '1.2rem' }}>Base de Datos</h2>
            <div style={{ background: '#262626', padding: '25px', borderRadius: '10px', marginTop: '15px', color: '#9ca3af', border: '1px dashed #404040' }}>
              <p style={{ margin: 0 }}>💾 Opciones para respaldar la información (Backup), limpiar el historial de ventas antiguas y restablecer de fábrica.</p>
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ borderBottom: '1px solid #333', paddingBottom: '10px', color: '#f97316', fontSize: '1.2rem' }}>Licencia y Sistema</h2>
            <div style={{ background: '#262626', padding: '25px', borderRadius: '10px', marginTop: '15px', color: '#9ca3af', border: '1px dashed #404040' }}>
              <p style={{ margin: 0 }}>🔑 Panel para actualizar a una licencia perpetua o renovar el periodo del sistema.</p>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}