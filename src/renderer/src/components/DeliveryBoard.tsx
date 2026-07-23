import { useEffect, useState } from 'react'
import type { PedidoDomicilio } from '../types/db'

interface DeliveryBoardProps {
  onBack: () => void;
  onNewOrder: () => void;
}

const COLUMNS: { key: PedidoDomicilio['estado_envio']; title: string }[] = [
  { key: 'en_cocina', title: 'En cocina' },
  { key: 'en_camino', title: 'En camino' },
  { key: 'entregado', title: 'Entregado' },
]

export function DeliveryBoard({ onBack, onNewOrder }: DeliveryBoardProps) {
  const [pedidos, setPedidos] = useState<PedidoDomicilio[]>([])
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  const fetchPedidos = async () => {
    try {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('get-delivery-orders')
      if (Array.isArray(res)) setPedidos(res)
    } catch (e) { console.error('Error cargando pedidos de domicilio:', e) }
  }

  useEffect(() => {
    fetchPedidos()
    // Refresco periódico simple, para reflejar pedidos nuevos creados desde DeliveryPOSView
    const interval = setInterval(fetchPedidos, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleDrop = async (estadoDestino: PedidoDomicilio['estado_envio']) => {
    setDragOverColumn(null)
    if (draggingId == null) return
    const pedido = pedidos.find(p => p.id === draggingId)
    if (!pedido || pedido.estado_envio === estadoDestino) { setDraggingId(null); return }

    // Actualización optimista
    setPedidos(prev => prev.map(p => p.id === draggingId ? { ...p, estado_envio: estadoDestino } : p))
    setDraggingId(null)

    try {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('update-delivery-status', {
        orderDomicilioId: pedido.id,
        estadoEnvio: estadoDestino
      })
      if (!res || !res.success) {
        alert('❌ No se pudo mover el pedido: ' + (res?.error || 'Error desconocido'))
        fetchPedidos() // revertir con el estado real
      }
    } catch (e) {
      console.error(e)
      fetchPedidos()
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#111', color: 'white', fontFamily: 'var(--font-heading, monospace)' }}>

      {/* Header */}
      <div style={{ padding: '25px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
        <button onClick={onBack} style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>←</span> Menú principal
        </button>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Pedidos</h1>
      </div>

      {/* Columnas */}
      <div style={{ flex: 1, display: 'flex', gap: '20px', padding: '30px 40px', overflow: 'hidden' }}>
        {COLUMNS.map(col => {
          const pedidosColumna = pedidos.filter(p => p.estado_envio === col.key)
          const isDragOver = dragOverColumn === col.key

          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.key) }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={() => handleDrop(col.key)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid ${isDragOver ? '#00E676' : '#333'}`,
                borderRadius: '12px',
                padding: '15px',
                overflowY: 'auto',
                background: isDragOver ? '#00e67611' : 'transparent',
                transition: 'background 0.15s, border-color 0.15s'
              }}
            >
              <h2 style={{ textAlign: 'center', margin: '0 0 15px 0', fontSize: '1.3rem' }}>{col.title}</h2>

              {pedidosColumna.length === 0 && (
                <div style={{ textAlign: 'center', color: '#555', marginTop: '20px', fontSize: '0.9rem' }}>Sin pedidos</div>
              )}

              {pedidosColumna.map(pedido => (
                <div
                  key={pedido.id}
                  draggable
                  onDragStart={() => setDraggingId(pedido.id)}
                  onDragEnd={() => setDraggingId(null)}
                  style={{
                    border: '1px solid #444',
                    borderRadius: '10px',
                    padding: '12px 15px',
                    marginBottom: '12px',
                    background: '#1a1a1a',
                    cursor: 'grab',
                    opacity: draggingId === pedido.id ? 0.4 : 1
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '4px' }}>
                    {pedido.cliente_direccion || 'Sin dirección registrada'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                    {pedido.cliente_nombre}{pedido.cliente_telefono ? ` · ${pedido.cliente_telefono}` : ''}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#22c55e', marginTop: '6px', fontWeight: 'bold' }}>
                    ${pedido.orden_total.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Botón flotante para crear un pedido nuevo */}
      <button
        onClick={onNewOrder}
        title="Nuevo pedido a domicilio"
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#00E676',
          color: 'black',
          border: 'none',
          fontSize: '1.8rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
        }}
      >
        +
      </button>
    </div>
  )
}