import { useState, useEffect } from 'react'
import type { ReporteDiario, OrdenHistorial, CartItem } from '../types/db'
import { OrderDetailModal } from './OrderDetailModal'

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
  const [selectedOrder, setSelectedOrder] = useState<{id: number, order: any, items: CartItem[], pagos?: any[]} | null>(null)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  // Pestañas: "En restaurante" agrupa local + llevar; "A domicilio" es tipo_orden === 'domicilio'
  const [activeTab, setActiveTab] = useState<'restaurante' | 'domicilio'>('restaurante')

  const fetchReport = async () => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('get-daily-report', { date })
    if (res.success) {
      const fetchedReport = res.report || null;
      setReport(fetchedReport)
      setOrders(res.orders || [])

      if (fetchedReport?.dinero_real !== undefined && fetchedReport?.dinero_real !== null) {
        setCashInDrawer(fetchedReport.dinero_real.toString())
      } else {
        setCashInDrawer('') 
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
      setSelectedOrder({ id: orderId, order: res.order, items: res.items, pagos: res.pagos })
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

  // Solo las órdenes realmente pagadas cuentan como venta — antes se incluían
  // también las canceladas en los totales, lo cual inflaba las cifras.
  const paidOrders = orders.filter((o: any) => o.estatus === 'pagada')

  // Venta neta de una orden: en restaurante es simplemente order.total (ya viene
  // con descuentos aplicados). En domicilio, lo que realmente le queda al negocio
  // es ingreso_neto (total del pedido ya sin la comisión de la plataforma) más el
  // costo de envío completo (el envío no paga comisión).
  const netoOrden = (o: any) =>
    o.tipo_orden === 'domicilio'
      ? (o.ingreso_neto || 0) + (o.costo_envio || 0)
      : o.total

  const totalVentas = paidOrders.reduce((sum, order: any) => sum + netoOrden(order), 0);
  const totalPedidos = paidOrders.length;

  // Efectivo/Tarjeta son estrictamente lo que pasa por la caja física — los pedidos
  // a domicilio (metodo 'app_delivery') nunca entran aquí, por diseño.
  const expectedCash = paidOrders.filter((o: any) => o.metodo === 'efectivo' || o.metodo === 'Mixto').reduce((sum, o: any) => sum + netoOrden(o), 0);
  const totalTarjeta = paidOrders.filter((o: any) => o.metodo === 'tarjeta').reduce((sum, o: any) => sum + netoOrden(o), 0);

  const realCash = parseFloat(cashInDrawer) || 0
  const difference = realCash - expectedCash

  // Filtra el historial de ventas según la pestaña activa
  const ordersInTab = orders.filter((o: any) =>
    activeTab === 'domicilio' ? o.tipo_orden === 'domicilio' : o.tipo_orden !== 'domicilio'
  )

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
      const res = await window.electron.ipcRenderer.invoke('save-daily-cut', { date, realCash, difference })
      if (res.success) {
        alert('Corte de caja guardado con éxito.')
        fetchReport() 
      } else {
        alert(' Error: ' + res.error)
      }
    } catch (error) {
      alert('Error de conexión al guardar el corte.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleExportExcel = async (range: 'selected' | 'yesterday' | 'week') => {
    try {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('export-excel', { range, referenceDate: date });
      if (res.canceled) {
        setIsExportModalOpen(false);
        return;
      }
      if (res.success) {
        alert('Reporte exportado a Excel con éxito.');
        setIsExportModalOpen(false);
      } else {
        alert('Error al exportar: ' + res.error);
      }
    } catch (e) {
      alert('Error de comunicación al exportar a Excel.');
    }
  }

  const todayStr = getLocalDate();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = getLocalDate(yesterdayDate);

 return (
    <div className="report-container" style={{ height: '100%', paddingTop: '20px' }}>
      
      <div className="report-content">
        
        {/* TÍTULO Y FILTROS */}
        <div className="report-top-bar">
          <h1 className="report-title">Reporte Diario</h1>
          <div className="date-filters">
            <button 
              className={`btn-filter ${date === yesterdayStr ? 'active-blue' : ''}`}
              onClick={() => setDate(yesterdayStr)}
            >
              Ayer
            </button>
            <button 
              className={`btn-filter ${date === todayStr ? 'active-blue' : ''}`}
              onClick={() => setDate(todayStr)}
            >
              Hoy
            </button>
            <input 
              type="date" 
              className="date-input"
              value={date} 
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {/* 4 KPIs SUPERIORES */}
        <div className="kpi-grid">
          <div className="kpi-card green">
            <div className="kpi-title">Ventas Totales</div>
            <div className="kpi-value">${totalVentas.toFixed(2)}</div>
          </div>
          <div className="kpi-card blue">
            <div className="kpi-title">Pedidos pagados</div>
            <div className="kpi-value">{totalPedidos}</div>
          </div>
          <div className="kpi-card cream">
            <div className="kpi-title">Efectivo</div>
            <div className="kpi-value">${expectedCash.toFixed(2)}</div>
          </div>
          <div className="kpi-card orange">
            <div className="kpi-title">Tarjeta</div>
            <div className="kpi-value">${totalTarjeta.toFixed(2)}</div>
          </div>
        </div>

        {/* ÁREA PRINCIPAL DIVIDIDA EN 2 COLUMNAS */}
        <div className="report-panels">
          
          {/* PANEL IZQUIERDO: HISTORIAL */}
          <div className="report-panel">
            <div style={{ display: 'flex', gap: '25px', borderBottom: '1px solid #333', marginBottom: '15px' }}>
              <button
                onClick={() => setActiveTab('restaurante')}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: '0 0 10px 0', fontFamily: 'inherit', fontSize: '1rem', fontWeight: 'bold',
                  color: activeTab === 'restaurante' ? '#00E676' : '#9ca3af',
                  borderBottom: activeTab === 'restaurante' ? '2px solid #00E676' : '2px solid transparent'
                }}
              >
                En restaurante
              </button>
              <button
                onClick={() => setActiveTab('domicilio')}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: '0 0 10px 0', fontFamily: 'inherit', fontSize: '1rem', fontWeight: 'bold',
                  color: activeTab === 'domicilio' ? '#00E676' : '#9ca3af',
                  borderBottom: activeTab === 'domicilio' ? '2px solid #00E676' : '2px solid transparent'
                }}
              >
                A domicilio
              </button>
            </div>
            <h2 className="panel-title">Historial de ventas</h2>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>{activeTab === 'domicilio' ? 'Cliente' : 'Mesa'}</th>
                    <th>Total</th>
                    <th>Método de P.</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ordersInTab.map(order => (
                    <tr key={order.id}>
                      <td>{new Date(order.creado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      <td>
                        {activeTab === 'domicilio' ? (
                          <>
                            <div>{(order as any).cliente_nombre || 'Sin nombre'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '3px' }}>{(order as any).canal_nombre || 'N/A'}</div>
                          </>
                        ) : (
                          <>
                            <div>#{order.mesa || 'N/A'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '3px' }}>Mesero: {order.cajero || 'N/A'}</div>
                          </>
                        )}
                      </td>
                      <td>${(order.total + ((order as any).costo_envio || 0)).toFixed(2)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{(order as any).metodo}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-ver" onClick={() => handleOpenDetail(order.id)}>
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                  {ordersInTab.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: '#666', borderBottom: 'none' }}>Sin ventas registradas este día</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PANEL DERECHO: CORTE DE CAJA */}
          <div className="report-panel">
            <h2 className="panel-title">Corte de caja</h2>
            
            <span className="cut-label">Total esperado (efectivo)</span>
            <h3 className="cut-value-large">${expectedCash.toFixed(2)}</h3>

            <label className="cut-input-label">Dinero real en caja</label>
            <input 
              type="number" 
              min="0"
              className="cut-input"
              value={cashInDrawer}
              onChange={handleCashChange}
              onKeyDown={preventInvalidChars}
              placeholder="0.00"
            />

            <div className={`diff-box ${difference < 0 ? 'danger' : 'success'}`}>
              <div className="diff-label">Diferencia</div>
              <h3 className="diff-value">
                {difference > 0 ? '+' : ''}{difference.toFixed(2)}
              </h3>
              <p className="diff-msg">
                {difference === 0 ? '¡Caja cuadrada!' : difference > 0 ? 'Sobra dinero' : 'Falta dinero'}
              </p>
            </div>

            <button 
              className="btn-save-cut"
              onClick={handleSaveCut}
              disabled={isSaving || orders.length === 0}
            >
              {isSaving ? 'Guardando...' : (isAlreadySaved ? 'Actualizar Corte' : 'Guardar Corte')}
            </button>

            <button 
              className="btn-export-excel"
              onClick={() => setIsExportModalOpen(true)}
            >
              Exportar a Excel
            </button>
          </div>
        </div>

      </div>

      {/* LOGO INFERIOR */}
      <div className="hipos-logo">
        hi-POS
      </div>

      {/* MODALES: ¡Ya sin el error de TS! */}
      {selectedOrder && (
        <OrderDetailModal 
          orderId={selectedOrder.id} 
          order={selectedOrder.order}
          items={selectedOrder.items} 
          pagos={selectedOrder.pagos} 
          onClose={() => setSelectedOrder(null)} 
        />
      )}

      {isExportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Exportar a Excel</h3>
            <p className="modal-text">
              Selecciona el rango de tiempo que deseas exportar basándote en la fecha actual <strong>({date})</strong>:
            </p>
            
            <div className="modal-options">
              <button className="btn-modal-option" onClick={() => handleExportExcel('selected')}>
                Reporte de este día
              </button>
              <button className="btn-modal-option" onClick={() => handleExportExcel('yesterday')}>
                Reporte de ayer
              </button>
              <button className="btn-modal-option" onClick={() => handleExportExcel('week')}>
                Reportes de la última semana
              </button>
            </div>
            
            <button className="btn-modal-cancel" onClick={() => setIsExportModalOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}