import { useEffect, useState } from 'react'
import type { CartItem, PedidoDomicilio } from '../types/db'

interface DeliveryOrderDetailModalProps {
  pedido: PedidoDomicilio;
  onClose: () => void;
}

interface OrderDetailResult {
  order: { tipo_orden: string; descuento_total: number; costo_envio?: number | null };
  items: CartItem[];
  pagos: { metodo: string; monto_recibido: number; cambio: number }[];
}

// Modal de detalle para el tablero de "Pedidos". A diferencia del OrderDetailModal
// de Reportes, este sí muestra los datos de contacto/entrega (cliente, teléfono,
// dirección, indicaciones, plataforma), porque aquí es donde el cajero necesita
// consultarlos rápido para el repartidor. Los productos/descuento/pagos se piden
// a get-order-details (mismo handler que usa Reportes) porque el tablero no los trae
// de entrada — sería desperdiciar consultas refrescando cada 5s solo para el listado.
export function DeliveryOrderDetailModal({ pedido, onClose }: DeliveryOrderDetailModalProps) {
  const [detail, setDetail] = useState<OrderDetailResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    // @ts-ignore
    window.electron.ipcRenderer.invoke('get-order-details', { orderId: pedido.orden_id }).then((res: any) => {
      if (!active) return
      if (res && res.success) setDetail({ order: res.order, items: res.items || [], pagos: res.pagos || [] })
      setLoading(false)
    })
    return () => { active = false }
  }, [pedido.orden_id])

  const subtotal = (detail?.items || []).reduce((sum, item) => sum + item.precio * item.cantidad, 0)
  const descuento = detail?.order?.descuento_total || 0
  const costoEnvio = pedido.costo_envio || 0
  const total = subtotal - descuento + costoEnvio

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 6000,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        fontFamily: 'monospace'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#111', color: 'white', padding: '30px',
          borderRadius: '12px', width: '380px', maxHeight: '85vh', overflowY: 'auto',
          border: '1px solid #333', boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Pedido #{pedido.orden_id}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>

        {/* Datos de envío */}
        <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '12px 15px', marginBottom: '15px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{pedido.cliente_nombre}</div>
          {pedido.cliente_telefono && (
            <div style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '6px' }}>📞 {pedido.cliente_telefono}</div>
          )}
          <div style={{ color: '#f3f4f6', fontSize: '0.9rem', marginBottom: '6px' }}>📍 {pedido.cliente_direccion || 'Sin dirección registrada'}</div>
          {pedido.notas_entrega && (
            <div style={{ color: '#fbbf24', fontSize: '0.85rem', marginBottom: '6px' }}>📌 {pedido.notas_entrega}</div>
          )}
          <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
            Plataforma: <span style={{ color: '#f3f4f6' }}>{pedido.canal_nombre || 'N/A'}</span>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px 0' }}>Cargando pedido...</div>
        ) : (
          <>
            <div style={{ borderTop: '2px dashed #444', borderBottom: '2px dashed #444', padding: '15px 0', margin: '15px 0' }}>
              {(detail?.items || []).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '1rem' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontWeight: 'bold' }}>{item.cantidad}x</span>
                    <span>{item.nombre}</span>
                  </div>
                  <span>${(item.precio * item.cantidad).toFixed(2)}</span>
                </div>
              ))}
              {(detail?.items || []).length === 0 && (
                <div style={{ color: '#666', textAlign: 'center' }}>Sin productos</div>
              )}
            </div>

            {descuento > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', color: '#f97316', marginBottom: '8px' }}>
                <span>Descuento</span>
                <span>-${descuento.toFixed(2)}</span>
              </div>
            )}

            {costoEnvio > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', color: '#9ca3af', marginBottom: '8px' }}>
                <span>Costo de envío</span>
                <span>${costoEnvio.toFixed(2)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', color: '#00E676', marginBottom: '20px' }}>
              <span>TOTAL</span>
              <span>${total.toFixed(2)}</span>
            </div>

            {detail?.pagos && detail.pagos.length > 0 && (
              <div style={{ background: '#1a1a1a', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#9ca3af', fontSize: '0.9rem', textTransform: 'uppercase' }}>Pagos registrados:</h4>
                {detail.pagos.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.95rem' }}>
                    <span style={{ textTransform: 'capitalize' }}>✅ {p.metodo}</span>
                    <span>${p.monto_recibido.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}