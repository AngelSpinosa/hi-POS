import { useState, useEffect } from 'react'
import type { ReporteDiario, OrdenHistorial, CartItem } from '../types/db'
import { OrderDetailModal } from './OrderDetailModal'
//HELPER: Obtener fecha estrictamente en la ZONA HORARIA LOCAL (Evita el bug de medianoche)
const getLocalDate = (d = new Date()) => {
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
}

// Añadimos la interfaz para recibir la función de volver atrás
interface DailyReportProps {
  onBack?: () => void;
}

export function DailyReport({ onBack }: DailyReportProps) {
  const [date, setDate] = useState(getLocalDate())
  const [report, setReport] = useState<ReporteDiario | any>(null)
  const [orders, setOrders] = useState<OrdenHistorial[]>([])
  
  // Estado para el corte de caja
  const [cashInDrawer, setCashInDrawer] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  
  // Estado para modales
  const [selectedOrder, setSelectedOrder] = useState<{id: number, items: CartItem[]} | null>(null)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  // Estado para el reloj de la cabecera
  const [time, setTime] = useState(new Date())

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

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
      const res = await window.electron.ipcRenderer.invoke('save-daily-cut', { date, realCash, difference })
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

  const todayStr = getLocalDate();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = getLocalDate(yesterdayDate);

  return (
    <div className="report-container">
      
      {/* CABECERA AL ESTILO FIGMA */}
      <div className="report-header">
        <button className="btn-back" onClick={onBack}>
          ← Menú principal
        </button>
        <div className="time-display">
          <div className="time-hours">HORA : {formatTime(time)}</div>
          <div className="time-date">{formatDate(time)}</div>
        </div>
      </div>

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
            <h2 className="panel-title">Historial de ventas</h2>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Mesa</th>
                    <th>Total</th>
                    <th>Método de P.</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id}>
                      <td>{new Date(order.creado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      <td>#{order.mesa}</td>
                      <td>${order.total.toFixed(2)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{order.metodo}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-ver" onClick={() => handleOpenDetail(order.id)}>
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
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

      {/* MODALES */}
      {selectedOrder && (
        <OrderDetailModal 
          orderId={selectedOrder.id} 
          items={selectedOrder.items} 
          onClose={() => setSelectedOrder(null)} 
        />
      )}

      {isExportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">📊 Exportar a Excel</h3>
            <p className="modal-text">
              Selecciona el rango de tiempo que deseas exportar basándote en la fecha actual <strong>({date})</strong>:
            </p>
            
            <div className="modal-options">
              <button className="btn-modal-option" onClick={() => handleExportExcel('selected')}>
                📅 Reporte de este día
              </button>
              <button className="btn-modal-option" onClick={() => handleExportExcel('yesterday')}>
                ⏪ Reporte de ayer
              </button>
              <button className="btn-modal-option" onClick={() => handleExportExcel('week')}>
                📆 Reportes de la última semana
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