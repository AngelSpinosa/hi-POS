import { useState, useEffect } from 'react'
import type { ReporteDiario, OrdenHistorial, CartItem } from '../types/db'
import { OrderDetailModal } from './OrderDetailModal'

export function DailyReport() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [report, setReport] = useState<ReporteDiario | null>(null)
  const [orders, setOrders] = useState<OrdenHistorial[]>([])
  
  // Estado para el corte de caja
  const [cashInDrawer, setCashInDrawer] = useState('')
  
  // Estado para modal de detalle
  const [selectedOrder, setSelectedOrder] = useState<{id: number, items: CartItem[]} | null>(null)

  useEffect(() => {
    const fetchReport = async () => {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('get-daily-report', { date })
      if (res.success) {
        setReport(res.report || { total_ventas: 0, total_pedidos: 0, total_efectivo: 0, total_tarjeta: 0 })
        setOrders(res.orders || [])
      }
    }
    fetchReport()
  }, [date])

  const handleOpenDetail = async (orderId: number) => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('get-order-details', { orderId })
    if (res.success) {
      setSelectedOrder({ id: orderId, items: res.items })
    }
  }

  // VALIDACIÓN DE ENTRADA (Solo positivos)
  const handleCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Si está vacío, lo permitimos para poder borrar
    if (value === '') {
      setCashInDrawer('')
      return
    }
    // Si es negativo, lo ignoramos
    if (parseFloat(value) < 0) return
    
    setCashInDrawer(value)
  }

  const preventInvalidChars = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Bloqueamos el signo menos y la 'e' exponencial
    if (['-', '+', 'e', 'E'].includes(e.key)) {
      e.preventDefault()
    }
  }

  // Cálculos para corte de caja
  const expectedCash = report?.total_efectivo || 0
  const realCash = parseFloat(cashInDrawer) || 0
  const difference = realCash - expectedCash

  return (
    <div style={{ padding: '20px', color: 'white', height: '100%', overflowY: 'auto' }}>
      
      {/* HEADER Y FECHA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>Reporte Diario 📊</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => {
               const d = new Date(); d.setDate(d.getDate() - 1); 
               setDate(d.toISOString().split('T')[0])
            }}
            style={{ padding: '8px 12px', background: '#404040', border: 'none', color: 'white', borderRadius: '5px', cursor: 'pointer' }}
          >
            Ayer
          </button>
          <button 
            onClick={() => setDate(new Date().toISOString().split('T')[0])}
            style={{ padding: '8px 12px', background: '#3b82f6', border: 'none', color: 'white', borderRadius: '5px', cursor: 'pointer' }}
          >
            Hoy
          </button>
          <input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: '8px', background: '#262626', border: '1px solid #404040', color: 'white', borderRadius: '5px' }}
          />
        </div>
      </div>

      {/* TARJETAS DE KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '30px' }}>
        <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '10px', borderLeft: '4px solid #22c55e' }}>
          <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Ventas Totales</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${report?.total_ventas.toFixed(2)}</div>
        </div>
        <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '10px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Pedidos Pagados</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{report?.total_pedidos}</div>
        </div>
        <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '10px', borderLeft: '4px solid #eab308' }}>
          <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Efectivo</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${report?.total_efectivo.toFixed(2)}</div>
        </div>
        <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '10px', borderLeft: '4px solid #a855f7' }}>
          <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Tarjeta</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${report?.total_tarjeta.toFixed(2)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        
        {/* LISTA DE VENTAS */}
        <div style={{ background: '#2d2d2d', borderRadius: '10px', padding: '20px' }}>
          <h3 style={{ marginTop: 0 }}>Historial de Ventas</h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ color: '#9ca3af', borderBottom: '1px solid #404040' }}>
                <tr>
                  <th style={{ padding: '10px' }}>Hora</th>
                  <th>Mesa</th>
                  <th>Total</th>
                  <th>Método</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid #404040' }}>
                    <td style={{ padding: '10px' }}>{new Date(order.creado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td>#{order.mesa}</td>
                    <td style={{ fontWeight: 'bold', color: '#22c55e' }}>${order.total.toFixed(2)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{order.metodo}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        onClick={() => handleOpenDetail(order.id)}
                        style={{ background: 'transparent', border: '1px solid #666', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px' }}
                      >Ver</button>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Sin ventas este día</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CORTE DE CAJA RÁPIDO */}
        <div style={{ background: '#2d2d2d', borderRadius: '10px', padding: '20px' }}>
          <h3 style={{ marginTop: 0 }}>Corte de Caja (MVP)</h3>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#9ca3af', marginBottom: '5px' }}>Total Esperado (Efectivo)</label>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${expectedCash.toFixed(2)}</div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#9ca3af', marginBottom: '5px' }}>Dinero Real en Caja</label>
            <input 
              type="number" 
              min="0" // Validación HTML básica
              value={cashInDrawer}
              onChange={handleCashChange} // Validación lógica estricta
              onKeyDown={preventInvalidChars} // Bloqueo de teclas invalidas
              placeholder="0.00"
              style={{ width: '100%', padding: '10px', background: '#1a1a1a', border: '1px solid #404040', color: 'white', fontSize: '1.2rem', borderRadius: '5px' }}
            />
          </div>

          <div style={{ padding: '15px', borderRadius: '5px', background: difference === 0 ? '#064e3b' : difference > 0 ? '#064e3b' : '#7f1d1d' }}>
            <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Diferencia</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: difference === 0 ? '#34d399' : difference > 0 ? '#34d399' : '#f87171' }}>
              {difference > 0 ? '+' : ''}{difference.toFixed(2)}
            </div>
            <small style={{ color: '#d1d5db' }}>
              {difference === 0 ? '¡Caja cuadrada!' : difference > 0 ? 'Sobra dinero' : 'Falta dinero'}
            </small>
          </div>
        </div>

      </div>

      {selectedOrder && (
        <OrderDetailModal 
          orderId={selectedOrder.id} 
          items={selectedOrder.items} 
          onClose={() => setSelectedOrder(null)} 
        />
      )}
    </div>
  )
}