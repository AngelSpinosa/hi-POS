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
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      <h2 style={{ color: 'white', marginBottom: '20px' }}>Seleccione una Mesa</h2>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
        gap: '20px' 
      }}>
        {tables.map(table => (
          <div
            key={table.id}
            onClick={() => onSelectTable(table.id)}
            style={{
              backgroundColor: '#2d2d2d',
              border: `2px solid ${getTableColor(table.estado_orden || 'libre')}`,
              borderRadius: '10px',
              padding: '20px',
              height: '120px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
              transition: 'transform 0.1s'
            }}
          >
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white' }}>
              #{table.numero}
            </div>
            
            <div style={{ 
              marginTop: '10px', 
              color: getTableColor(table.estado_orden || 'libre'),
              fontWeight: 'bold',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              {getStatusText(table.estado_orden || 'libre')}
            </div>

            {/* Solo mostramos total si hay una orden viva */}
            {table.total_actual && table.total_actual > 0 ? (
              <div style={{ marginTop: '5px', color: '#fbbf24' }}>
                ${table.total_actual.toFixed(2)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}