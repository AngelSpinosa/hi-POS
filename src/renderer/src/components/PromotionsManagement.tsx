import { useState, useEffect } from 'react'
import type { Promocion, Categoria, Producto, CrearPromocionPayload } from '../types/db'

export function PromotionsManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // --- ESTADOS DE DATOS REALES ---
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [categories, setCategories] = useState<Categoria[]>([])
  const [products, setProducts] = useState<Producto[]>([])

  // --- ESTADOS DEL FORMULARIO DEL MODAL ---
  const [editingPromoId, setEditingPromoId] = useState<number | null>(null) // <-- NUEVO ESTADO PARA EDICIÓN
  const [promoType, setPromoType] = useState<'2x1' | '% TOTAL' | '% de producto' | 'Precio Fijo'>('2x1')
  const [promoName, setPromoName] = useState('')
  const [promoValue, setPromoValue] = useState('')
  const [promoValuePago, setPromoValuePago] = useState('') // <-- Nuevo: "Y" en "X productos por el precio de Y"
  const [applyTo, setApplyTo] = useState<'Categorias' | 'Productos'>('Categorias')
  const [selectedRefId, setSelectedRefId] = useState<number | ''>('')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')

  // Carga inicial de datos desde SQLite
  const fetchData = async () => {
    setIsLoading(true)
    try {
      // @ts-ignore
      const [resPromos, resCats, resProds] = await Promise.all([
        // @ts-ignore
        window.electron.ipcRenderer.invoke('get-promociones'),
        // @ts-ignore
        window.electron.ipcRenderer.invoke('get-categories'),
        // @ts-ignore
        window.electron.ipcRenderer.invoke('get-products')
      ])

      if (Array.isArray(resPromos)) setPromociones(resPromos)
      if (Array.isArray(resCats)) setCategories(resCats.filter(c => c.activa)) 
      if (Array.isArray(resProds)) setProducts(resProds.filter(p => p.active)) 

    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const promocionesActivas = promociones.filter(p => p.activa)
  const promocionesDesactivadas = promociones.filter(p => !p.activa)

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('toggle-promocion-status', { id, activa: currentStatus ? 0 : 1 })
    if (res.success) {
      await fetchData()
    } else {
      alert('Error al cambiar el estado: ' + res.error)
    }
  }

  // --- NUEVA LÓGICA DE EDICIÓN ---
  const handleEdit = (id: number) => {
    const promo = promociones.find(p => p.id === id)
    if (!promo) return

    setEditingPromoId(id)
    setPromoType(promo.tipo as any)
    setPromoName(promo.nombre)
    setPromoValue(promo.valor ? promo.valor.toString() : '0')
    setPromoValuePago(promo.valor_pago ? promo.valor_pago.toString() : '')
    setValidFrom(promo.hora_inicio || '')
    setValidTo(promo.hora_fin || '')
    // Nota: Dejamos applyTo y selectedRefId vacíos porque los vamos a bloquear visualmente 
    // y no se actualizarán en el backend durante una edición básica.
    
    setIsModalOpen(true)
  }

  // Limpiar el formulario al cerrar
  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingPromoId(null)
    setPromoType('2x1')
    setPromoName('')
    setPromoValue('')
    setPromoValuePago('')
    setApplyTo('Categorias')
    setSelectedRefId('')
    setValidFrom('')
    setValidTo('')
  }

  // dias_activa ya no lo llena el admin: se calcula solo a partir de la vigencia.
  // Ej. Del 10 al 15 -> 5. Si no hay vigencia definida (es opcional), se guarda 'Todos'.
  const calcularDiasActiva = (inicio: string, fin: string): string => {
    if (!inicio || !fin) return 'Todos'
    const msPorDia = 1000 * 60 * 60 * 24
    const diff = Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / msPorDia)
    if (diff <= 0) return 'Todos'
    return String(diff)
  }

  // Guardar nueva promoción o actualizar existente
  const handleSavePromocion = async () => {
    if (!promoName.trim()) { alert('Ingresa un nombre para la promoción'); return; }
    if (!promoValue || Number(promoValue) < 0) { alert('Ingresa un valor válido'); return; }

    // Validación específica para '2x1' generalizado (X productos por el precio de Y)
    if (promoType === '2x1') {
      if (!promoValuePago || Number(promoValuePago) <= 0) { alert('Ingresa por el precio de cuántos productos se paga'); return; }
      if (Number(promoValuePago) >= Number(promoValue)) { alert('El "precio de" debe ser menor a la cantidad de productos'); return; }
    }
    
    // Solo validamos la selección de categoría/producto si estamos creando una nueva
    if (!editingPromoId && !selectedRefId) { alert(`Selecciona un ${applyTo === 'Categorias' ? 'categoría' : 'producto'}`); return; }

    if (editingPromoId) {
      // --- LÓGICA PARA ACTUALIZAR ---
      const payload = {
        id: editingPromoId,
        nombre: promoName.trim(),
        valor: Number(promoValue),
        valor_pago: promoType === '2x1' ? Number(promoValuePago) : null,
        dias_activa: calcularDiasActiva(validFrom, validTo),
        hora_inicio: validFrom || null,
        hora_fin: validTo || null,
      }
      
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('update-promocion', payload)
      if (res.success) {
        alert('Promoción actualizada exitosamente.')
        handleCloseModal()
        await fetchData()
      } else {
        alert('Error al actualizar: ' + res.error)
      }
      
    } else {
      // --- LÓGICA PARA CREAR ---
      const payload: CrearPromocionPayload = {
        nombre: promoName.trim(),
        tipo: promoType,
        valor: Number(promoValue),
        valor_pago: promoType === '2x1' ? Number(promoValuePago) : null,
        dias_activa: calcularDiasActiva(validFrom, validTo),
        hora_inicio: validFrom || null,
        hora_fin: validTo || null,
        aplica_a: applyTo,
        referencia_ids: [Number(selectedRefId)]
      }

      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('create-promocion', payload)
      if (res.success) {
        alert('Promoción creada exitosamente.')
        handleCloseModal()
        await fetchData()
      } else {
        alert('Error al crear promoción: ' + res.error)
      }
    }
  }

  const formatearValor = (promo: Promocion) => {
    if (promo.tipo === '% TOTAL' || promo.tipo === '% de producto') return `${promo.valor || 0}%`
    if (promo.tipo === 'Precio Fijo') return `$${Number(promo.valor || 0).toFixed(2)}`
    if (promo.tipo === '2x1') return promo.valor_pago ? `${promo.valor}x${promo.valor_pago}` : `${promo.valor || 2}x1`
    return String(promo.valor)
  }

  const formatearVigencia = (inicio: string | null, fin: string | null) => {
    if (!inicio && !fin) return 'Indefinida'
    if (inicio && fin) return `Del ${inicio} al ${fin}`
    if (inicio) return `Desde ${inicio}`
    if (fin) return `Hasta ${fin}`
    return 'Indefinida'
  }

  const inputStyle = {
    width: '100%', padding: '10px', background: 'transparent', border: '1px solid #555',
    color: 'white', borderRadius: '8px', boxSizing: 'border-box' as const, marginBottom: '15px', fontFamily: 'inherit'
  }
  
  // Estilo para inputs bloqueados
  const disabledStyle = { ...inputStyle, opacity: 0.5, cursor: 'not-allowed', backgroundColor: '#222' }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', backgroundColor: '#0f0f0f', color: 'white', fontFamily: 'inherit' }}>
      <div style={{ flex: 1, padding: '30px 40px', overflowY: 'auto' }}>
        <h1 style={{ fontSize: '2.5rem', margin: '0 0 30px 0' }}>Descuentos y promociones</h1>

        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '50px' }}>Cargando promociones...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
            
            {/* TABLAS OMITIDAS POR BREVEDAD (Son exactamente iguales a las tuyas) */}
            {/* TABLA: PROMOCIONES ACTIVAS */}
            <div>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '20px' }}>Promociones<br/>activas</h2>
              <div style={{ border: '1px solid #ffffff', borderRadius: '16px', overflow: 'hidden' }}>
                <table className="custom-table">
                  <thead>
                    <tr><th>Nombre</th><th>Tipo</th><th>Valor</th><th>Vigencia</th><th>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {promocionesActivas.map(promo => (
                      <tr key={promo.id}>
                        <td>{promo.nombre}</td>
                        <td>{promo.tipo}</td>
                        <td>{formatearValor(promo)}</td>
                        <td>{formatearVigencia(promo.hora_inicio, promo.hora_fin)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button onClick={() => handleToggleStatus(promo.id, promo.activa)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#FF0000' }} title="Desactivar">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                            <button onClick={() => handleEdit(promo.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'white' }} title="Editar">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {promocionesActivas.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '30px', color: '#888' }}>No hay promociones activas</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TABLA: PROMOCIONES DESACTIVADAS */}
            <div>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '20px' }}>Promociones<br/>desactivadas</h2>
              <div style={{ border: '1px solid #ffffff', borderRadius: '16px', overflow: 'hidden' }}>
                <table className="custom-table">
                  <thead>
                    <tr><th>Nombre</th><th>Tipo</th><th>Valor</th><th>Vigencia</th><th>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {promocionesDesactivadas.map(promo => (
                      <tr key={promo.id}>
                        <td style={{ color: '#888' }}>{promo.nombre}</td>
                        <td style={{ color: '#888' }}>{promo.tipo}</td>
                        <td style={{ color: '#888' }}>{formatearValor(promo)}</td>
                        <td style={{ color: '#888' }}>{formatearVigencia(promo.hora_inicio, promo.hora_fin)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button onClick={() => handleToggleStatus(promo.id, promo.activa)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#00E676' }} title="Reactivar">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                            </button>
                            <button onClick={() => handleEdit(promo.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'white' }} title="Editar">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {promocionesDesactivadas.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '30px', color: '#888' }}>No hay promociones desactivadas</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>

      <button 
        onClick={() => setIsModalOpen(true)}
        style={{
          position: 'fixed', bottom: '40px', right: '40px', width: '70px', height: '70px',
          borderRadius: '50%', backgroundColor: '#00E676', color: 'white', border: 'none',
          fontSize: '2.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center',
          cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,230,118,0.4)', transition: 'transform 0.2s',
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        +
      </button>

      {/* MODAL DINÁMICO DE CREACIÓN / EDICIÓN */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#161616', padding: '40px', borderRadius: '16px', border: '1px solid #333', width: '450px', maxWidth: '90%' }}>
            
            {/* Cambio Dinámico del Título */}
            <h2 style={{ textAlign: 'center', marginBottom: '25px', fontSize: '1.8rem' }}>
              {editingPromoId ? 'Editar promoción' : 'Crear promoción'}
            </h2>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <select 
                value={promoType} 
                onChange={e => setPromoType(e.target.value as any)}
                disabled={!!editingPromoId} // Bloqueado en edición
                style={{ ...(editingPromoId ? disabledStyle : inputStyle), width: 'auto', display: 'inline-block', textAlign: 'center' }}
              >
                <option value="2x1">2x1</option>
                <option value="% TOTAL">% TOTAL</option>
                <option value="% de producto">% de producto</option>
                <option value="Precio Fijo">Precio Fijo</option>
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px', color: '#ccc' }}>Nombre promoción</label>
              <input type="text" value={promoName} onChange={e => setPromoName(e.target.value)} style={inputStyle} placeholder="Ej. Combo Lunes..." />
            </div>

            {/* Radio Buttons de Aplicación Bloqueados en edición */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: editingPromoId ? 'not-allowed' : 'pointer', opacity: editingPromoId ? 0.5 : 1 }}>
                <input type="radio" disabled={!!editingPromoId} checked={applyTo === 'Categorias'} onChange={() => { setApplyTo('Categorias'); setSelectedRefId(''); }} style={{ accentColor: '#00E676' }} />
                Aplicar a Categorías
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: editingPromoId ? 'not-allowed' : 'pointer', opacity: editingPromoId ? 0.5 : 1 }}>
                <input type="radio" disabled={!!editingPromoId} checked={applyTo === 'Productos'} onChange={() => { setApplyTo('Productos'); setSelectedRefId(''); }} style={{ accentColor: '#00E676' }} />
                Aplicar a Productos
              </label>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <select 
                value={selectedRefId} 
                onChange={e => setSelectedRefId(e.target.value ? Number(e.target.value) : '')} 
                disabled={!!editingPromoId}
                style={editingPromoId ? disabledStyle : inputStyle}
              >
                <option value="">{editingPromoId ? 'Bloqueado (Ya asignado)' : `Seleccionar ${applyTo === 'Categorias' ? 'categoría' : 'producto'}...`}</option>
                {applyTo === 'Categorias' 
                  ? categories.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)
                  : products.map(prod => <option key={prod.id} value={prod.id}>{prod.nombre}</option>)
                }
              </select>
            </div>

            {/* Valor numérico de la promoción */}
            {promoType === '2x1' ? (
              // Layout tipo Figma: dos inputs — "X Productos por el precio de Y"
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '10px', color: '#ccc', textAlign: 'center' }}>
                  Productos por el precio de:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <input
                    type="number"
                    min="1"
                    value={promoValue}
                    onChange={e => setPromoValue(e.target.value)}
                    style={{ ...inputStyle, marginBottom: 0, width: '70px', textAlign: 'center' }}
                    placeholder="3"
                  />
                  <span style={{ color: '#ccc' }}>Productos por el precio de</span>
                  <input
                    type="number"
                    min="1"
                    value={promoValuePago}
                    onChange={e => setPromoValuePago(e.target.value)}
                    style={{ ...inputStyle, marginBottom: 0, width: '70px', textAlign: 'center' }}
                    placeholder="2"
                  />
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px', color: '#ccc' }}>
                  {(promoType === '% de producto' || promoType === '% TOTAL') ? '% de descuento:' : 'Monto de descuento ($):'}
                </label>
                <input 
                  type="number" 
                  min="0"
                  value={promoValue} 
                  onChange={e => setPromoValue(e.target.value)} 
                  style={{ ...inputStyle, marginBottom: 0, textAlign: 'center' }} 
                  placeholder="10" 
                />
              </div>
            )}

            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '10px', color: '#ccc', textAlign: 'center' }}>Vigencia (Opcional)</label>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <span>Del</span>
                <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
                <span>al</span>
                <input type="date" value={validTo} onChange={e => setValidTo(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <button onClick={handleCloseModal} style={{ flex: 1, padding: '12px', background: '#FF0000', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleSavePromocion} style={{ flex: 1, padding: '12px', background: '#00E676', color: 'black', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Confirmar</button>
            </div>

          </div>
        </div>
      )}

      <style>{`
        .custom-table { width: 100%; border-collapse: collapse; text-align: center; }
        .custom-table th { padding: 15px; font-weight: bold; border-bottom: 1px solid #ffffff; }
        .custom-table td { border: 1px solid #ffffff; padding: 15px; }
        .custom-table tr th:first-child, .custom-table tr td:first-child { border-left: none; }
        .custom-table tr th:last-child, .custom-table tr td:last-child { border-right: none; }
        .custom-table tr:last-child td { border-bottom: none; }
        ::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
      `}</style>
    </div>
  )
}