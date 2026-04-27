import { useState, useEffect } from 'react'
import type { ReporteDiario, OrdenHistorial, CartItem } from '../types/db'
import { OrderDetailModal } from './OrderDetailModal'

// 🛠️ HELPER: Obtener fecha estrictamente en la ZONA HORARIA LOCAL (Evita el bug de medianoche)
const getLocalDate = (d = new Date()) => {
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
}

export function DailyReport() {
  const [date, setDate] = useState(getLocalDate())
  const [report, setReport] = useState<ReporteDiario | any>(null)
  const [orders, setOrders] = useState<OrdenHistorial[]>([])
  
  // Estado para el corte de caja
  const [cashInDrawer, setCashInDrawer] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  
  // Estado para modales
  const [selectedOrder, setSelectedOrder] = useState<{id: number, items: CartItem[]} | null>(null)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false) // NUEVO ESTADO PARA EXCEL

  const fetchReport = async () => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('get-daily-report', { date })
    if (res.success) {
      const fetchedReport = res.report || null;
      setReport(fetchedReport)
      setOrders(res.orders || [])

      // Si este día ya tiene un corte guardado, cargamos el dinero real automáticamente
      if (fetchedReport?.dinero_real !== undefined && fetchedReport?.dinero_real !== null) {
        setCashInDrawer(fetchedReport.dinero_real.toString())
      } else {
        setCashInDrawer('') // Limpiamos si es un día nuevo sin corte
      }
    }
  }

  useEffect(() => {
    fetchReport()
  }, [date])

  const handleOpenDetail = async (orderId: number) => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('get-order-details', { orderId })
    if (res.success) {
      setSelectedOrder({ id: orderId, items: res.items })
    }
  }

  const handleCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '') {
      setCashInDrawer('')
      return
    }
    if (parseFloat(value) < 0) return
    setCashInDrawer(value)
  }

  const preventInvalidChars = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) {
      e.preventDefault()
    }
  }

  const totalVentas = orders.reduce((sum, order) => sum + order.total, 0);
  const totalPedidos = orders.length;
  const expectedCash = orders.filter(o => o.metodo === 'efectivo').reduce((sum, o) => sum + o.total, 0);
  const totalTarjeta = orders.filter(o => o.metodo === 'tarjeta').reduce((sum, o) => sum + o.total, 0);

  const realCash = parseFloat(cashInDrawer) || 0
  const difference = realCash - expectedCash

  const isAlreadySaved = report?.dinero_real !== null && report?.dinero_real !== undefined

  const handleSaveCut = async () => {
    if (cashInDrawer === '') {
      alert('Por favor ingresa el dinero real en caja.')
      return
    }

    const confirm = window.confirm(
      `¿Confirmas ${isAlreadySaved ? 'actualizar' : 'guardar'} el corte de caja para el ${date}?\n\n` +
      `Efectivo Esperado: $${expectedCash.toFixed(2)}\n` +
      `Efectivo Declarado: $${realCash.toFixed(2)}\n` +
      `Diferencia: $${difference.toFixed(2)}`
    )

    if (!confirm) return

    setIsSaving(true)
    try {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('save-daily-cut', {
        date,
        realCash,
        difference
      })

      if (res.success) {
        alert('✅ Corte de caja guardado con éxito.')
        fetchReport() 
      } else {
        alert('❌ Error: ' + res.error)
      }
    } catch (error) {
      alert('Error de conexión al guardar el corte.')
    } finally {
      setIsSaving(false)
    }
  }

  // --- NUEVA LÓGICA PARA EXPORTAR A EXCEL (CU-49) ---
  const handleExportExcel = async (range: 'selected' | 'yesterday' | 'week') => {
    try {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('export-excel', { range, referenceDate: date });
      if (res.canceled) {
        setIsExportModalOpen(false);
        return;
      }
      if (res.success) {
        alert('✅ Reporte exportado a Excel con éxito.');
        setIsExportModalOpen(false);
      } else {
        alert('❌ Error al exportar: ' + res.error);
      }
    } catch (e) {
      alert('❌ Error de comunicación al exportar a Excel.');
    }
  }
  // ---------------------------------------------------

  const todayStr = getLocalDate();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = getLocalDate(yesterdayDate);

  return (
    <div style={{ padding: '20px', color: 'white', height: '100%', overflowY: 'auto' }}>
      
      {/* HEADER Y FECHA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>Reporte Diario 📊</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setDate(yesterdayStr)}
            style={{ 
              padding: '8px 12px', 
              background: date === yesterdayStr ? '#3b82f6' : '#404040', 
              border: 'none', color: 'white', borderRadius: '5px', cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            Ayer
          </button>
          <button 
            onClick={() => setDate(todayStr)}
            style={{ 
              padding: '8px 12px', 
              background: date === todayStr ? '#3b82f6' : '#404040', 
              border: 'none', color: 'white', borderRadius: '5px', cursor: 'pointer',
              transition: 'background 0.2s'
            }}
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
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${totalVentas.toFixed(2)}</div>
        </div>
        <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '10px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Pedidos Pagados</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{totalPedidos}</div>
        </div>
        <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '10px', borderLeft: '4px solid #eab308' }}>
          <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Efectivo</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${expectedCash.toFixed(2)}</div>
        </div>
        <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '10px', borderLeft: '4px solid #a855f7' }}>
          <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Tarjeta</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>${totalTarjeta.toFixed(2)}</div>
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
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Sin ventas registradas este día</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CORTE DE CAJA RÁPIDO */}
        <div style={{ background: '#2d2d2d', borderRadius: '10px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <h3 style={{ marginTop: 0 }}>Corte de Caja (MVP)</h3>
             {isAlreadySaved && (
               <span style={{ fontSize: '0.8rem', background: '#065f46', color: '#34d399', padding: '2px 8px', borderRadius: '10px' }}>✓ Guardado</span>
             )}
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#9ca3af', marginBottom: '5px' }}>Total Esperado (Efectivo)</label>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${expectedCash.toFixed(2)}</div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#9ca3af', marginBottom: '5px' }}>Dinero Real en Caja</label>
            <input 
              type="number" 
              min="0"
              value={cashInDrawer}
              onChange={handleCashChange}
              onKeyDown={preventInvalidChars}
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

          <button 
            onClick={handleSaveCut}
            disabled={isSaving || orders.length === 0}
            style={{ 
              width: '100%', 
              padding: '12px', 
              marginTop: '20px', 
              background: (isSaving || orders.length === 0) ? '#404040' : (isAlreadySaved ? '#059669' : '#3b82f6'), 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px', 
              fontWeight: 'bold', 
              cursor: (isSaving || orders.length === 0) ? 'not-allowed' : 'pointer' 
            }}
          >
            {isSaving ? 'Guardando...' : (isAlreadySaved ? '🔄 Actualizar Corte' : '💾 Guardar Corte')}
          </button>

          {/* NUEVO: BOTÓN DE EXPORTAR A EXCEL */}
          <button 
            onClick={() => setIsExportModalOpen(true)}
            style={{ 
              width: '100%', 
              padding: '12px', 
              marginTop: '10px', 
              background: 'transparent', 
              color: '#10b981', 
              border: '1px solid #10b981', 
              borderRadius: '5px', 
              fontWeight: 'bold', 
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#000'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#10b981'; }}
          >
            📊 Exportar a Excel
          </button>

        </div>

      </div>

      {selectedOrder && (
        <OrderDetailModal 
          orderId={selectedOrder.id} 
          items={selectedOrder.items} 
          onClose={() => setSelectedOrder(null)} 
        />
      )}

      {/* NUEVO: MODAL DE EXCEL */}
      {isExportModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 5000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#1a1a1a', padding: '30px', borderRadius: '15px', width: '400px', border: '1px solid #404040', color: 'white', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#10b981', fontSize: '1.4rem' }}>📊 Exportar a Excel</h3>
            <p style={{ color: '#9ca3af', marginBottom: '25px', lineHeight: '1.5' }}>
              Selecciona el rango de tiempo que deseas exportar basándote en la fecha actual <strong style={{ color: '#fff' }}>({date})</strong>:
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => handleExportExcel('selected')}
                style={{ padding: '14px', background: '#262626', color: 'white', border: '1px solid #404040', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                📅 Reporte de este día
              </button>
              <button 
                onClick={() => handleExportExcel('yesterday')}
                style={{ padding: '14px', background: '#262626', color: 'white', border: '1px solid #404040', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ⏪ Reporte de ayer
              </button>
              <button 
                onClick={() => handleExportExcel('week')}
                style={{ padding: '14px', background: '#262626', color: 'white', border: '1px solid #404040', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                📆 Reportes de la última semana
              </button>
            </div>
            
            <button 
              onClick={() => setIsExportModalOpen(false)}
              style={{ width: '100%', padding: '14px', marginTop: '20px', background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}