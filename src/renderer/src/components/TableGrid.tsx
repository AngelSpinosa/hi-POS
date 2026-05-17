import type { Mesa } from '../types/db'

interface TableGridProps {
  tables: Mesa[];
  onSelectTable: (tableId: number) => void;
}

export function TableGrid({ tables, onSelectTable }: TableGridProps) {
  
  // Lógica de colores semáforo
  const getTableColor = (status: string) => {
    switch (status) {
      case 'libre': return '#22c55e'; // Verde
      case 'cuenta_solicitada': return '#eab308'; // Amarillo (Atención requerida)
      // Tanto 'abierta' como 'enviada_cocina' son mesas OCUPADAS (Azul)
      case 'abierta': 
      case 'enviada_cocina': 
        return '#3b82f6'; 
      default: return '#6b7280'; // Gris (Desconocido/Inactivo)
    }
  }

  // Texto amigable para el humano
  const getStatusText = (status: string) => {
    switch (status) {
      case 'libre': return 'LIBRE';
      case 'cuenta_solicitada': return 'CUENTA PEDIDA';
      // Agrupamos estados técnicos en uno solo visual
      case 'abierta': 
      case 'enviada_cocina': 
        return 'ORDEN ABIERTA';
      default: return status.replace('_', ' ').toUpperCase();
    }
  }

  return (
    <div style={{ 
      padding: '40px', 
      height: '100%', 
      overflowY: 'auto', 
      fontFamily: 'var(--font-heading, monospace)',
      boxSizing: 'border-box'
    }}>
      <h2 style={{ 
        color: 'white', 
        marginBottom: '35px', 
        fontSize: '2rem', 
        fontWeight: 'bold' 
      }}>
        Selecciona una mesa
      </h2>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', 
        gap: '25px' 
      }}>
        {tables.map(table => {
          const statusColor = getTableColor(table.estado_orden || 'libre');
          
          return (
            <div
              key={table.id}
              onClick={() => onSelectTable(table.id)}
              style={{
                backgroundColor: '#161616',
                border: `2px solid ${statusColor}`,
                borderRadius: '16px',
                padding: '30px 20px',
                height: '160px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'pointer',
                boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = `0 15px 25px rgba(0,0,0,0.5), 0 0 15px ${statusColor}30`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.3)';
              }}
            >
              <div style={{ 
                fontSize: '2.8rem', 
                fontWeight: 'bold', 
                color: 'white',
                lineHeight: '1'
              }}>
                #{table.numero}
              </div>
              
              <div style={{ 
                marginTop: '15px', 
                color: statusColor,
                fontWeight: 'bold',
                fontSize: '0.9rem',
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                {getStatusText(table.estado_orden || 'libre')}
              </div>

              {/* Muestra un pequeño indicador 'pill' con el total si hay orden activa */}
              {table.total_actual && table.total_actual > 0 ? (
                <div style={{ 
                  marginTop: '12px', 
                  backgroundColor: statusColor, 
                  color: 'black', 
                  padding: '4px 10px', 
                  borderRadius: '12px', 
                  fontSize: '0.85rem', 
                  fontWeight: 'bold' 
                }}>
                  ${table.total_actual.toFixed(2)}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}