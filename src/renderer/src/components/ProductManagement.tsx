import { useState, useEffect } from 'react'
import type { Producto, Insumo } from '../types/db'
import { PinPadModal } from './PinPadModal'

interface ProductManagementProps {
  onBack: () => void;
}

export function ProductManagement({ onBack }: ProductManagementProps) {
  const [activeTab, setActiveTab] = useState<'productos' | 'insumos'>('productos')
  const [products, setProducts] = useState<Producto[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Reloj y Búsqueda
  const [currentTime, setCurrentTime] = useState(new Date())
  const [searchTerm, setSearchTerm] = useState('')

  // Formulario Productos
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formName, setFormName] = useState('')
  const [formPrice, setFormPrice] = useState('')

  // Formulario Insumos
  const [isEditingInsumo, setIsEditingInsumo] = useState(false)
  const [editingInsumoId, setEditingInsumoId] = useState<number | null>(null)
  const [formInsumoCodigo, setFormInsumoCodigo] = useState('')
  const [formInsumoNombre, setFormInsumoNombre] = useState('')
  const [formInsumoUnidad, setFormInsumoUnidad] = useState('KG')
  const [formInsumoStock, setFormInsumoStock] = useState('')
  const [formInsumoStockMinimo, setFormInsumoStockMinimo] = useState('')

  // Seguridad
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null)

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      // @ts-ignore
      const [resProducts, resInsumos] = await Promise.all([
        // @ts-ignore
        window.electron.ipcRenderer.invoke('get-products'),
        // @ts-ignore
        window.electron.ipcRenderer.invoke('get-insumos')
      ])

      if (Array.isArray(resProducts)) setProducts(resProducts)
      else setProducts([])

      if (Array.isArray(resInsumos)) setInsumos(resInsumos)
      else setInsumos([])

    } catch (e) { 
      console.error(e) 
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Búsqueda en tiempo real
  const filteredProducts = products.filter(product =>
    product.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredInsumos = insumos.filter(insumo =>
    insumo.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    insumo.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Formateo de fecha y hora idéntico al Dashboard
  const timeString = currentTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
  const dateString = currentTime.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const formattedDate = dateString.replace(/\b\w/g, l => l.toUpperCase())

  // --- MÉTODOS DEL FORMULARIO (Productos) ---

  const handleOpenCreate = () => {
    setEditingId(null)
    setFormName('')
    setFormPrice('')
    setIsEditing(true)
  }

  const handleOpenEdit = (prod: Producto) => {
    setEditingId(prod.id)
    setFormName(prod.nombre)
    setFormPrice(prod.precio?.toString() || '0')
    setIsEditing(true)
  }

  const handleSaveClick = () => {
    if (!formName.trim() || formPrice === '') {
      alert('⚠️ Por favor ingresa el nombre y el precio del producto.')
      return 
    }

    if (Number(formPrice) < 0) {
      alert('⚠️ El precio no puede ser un valor negativo.')
      return
    }
    
    const actionToExecute = async () => {
      const channel = editingId ? 'update-product' : 'create-product'
      const payload = editingId 
        ? { id: editingId, nombre: formName, precio: Number(formPrice) }
        : { nombre: formName, precio: Number(formPrice) }
      
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke(channel, payload)
      
      if (res.success) {
        setIsEditing(false)
        await fetchData()
        alert('✅ Producto guardado correctamente.')
      } else {
        alert('❌ Error al guardar: ' + res.error)
      }
    }

    setPendingAction(() => actionToExecute)
    setIsPinModalOpen(true)
  }

  const handleToggleStatusRequest = (id: number, currentStatus: number) => {
    const action = async () => {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('toggle-product-status', { 
        id, 
        active: currentStatus ? 0 : 1 
      })
      if (res.success) {
        await fetchData()
        alert(currentStatus ? '🔴 Producto Desactivado' : '🟢 Producto Activado')
      }
    }
    setPendingAction(() => action)
    setIsPinModalOpen(true)
  }

  // --- MÉTODOS DEL FORMULARIO (Insumos) ---

  const handleOpenCreateInsumo = () => {
    setEditingInsumoId(null)
    setFormInsumoCodigo('')
    setFormInsumoNombre('')
    setFormInsumoUnidad('KG')
    setFormInsumoStock('0')
    setFormInsumoStockMinimo('0')
    setIsEditingInsumo(true)
  }

  const handleOpenEditInsumo = (insumo: Insumo) => {
    setEditingInsumoId(insumo.id)
    setFormInsumoCodigo(insumo.codigo)
    setFormInsumoNombre(insumo.nombre)
    setFormInsumoUnidad(insumo.unidad_medida)
    setFormInsumoStock(insumo.stock_actual.toString())
    setFormInsumoStockMinimo(insumo.stock_minimo.toString())
    setIsEditingInsumo(true)
  }

  const handleSaveInsumoClick = () => {
    if (!formInsumoCodigo.trim() || !formInsumoNombre.trim() || formInsumoStock === '' || formInsumoStockMinimo === '') {
      alert('⚠️ Por favor completa todos los campos del insumo.')
      return
    }

    const actionToExecute = async () => {
      const channel = editingInsumoId ? 'update-insumo' : 'create-insumo'
      const payload = {
        id: editingInsumoId, // solo es útil para update
        codigo: formInsumoCodigo.toUpperCase(),
        nombre: formInsumoNombre,
        unidad_medida: formInsumoUnidad,
        stock_actual: Number(formInsumoStock),
        stock_minimo: Number(formInsumoStockMinimo)
      }
      
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke(channel, payload)
      
      if (res.success) {
        setIsEditingInsumo(false)
        await fetchData()
        alert('✅ Insumo guardado correctamente.')
      } else {
        alert('❌ Error al guardar insumo: ' + res.error)
      }
    }

    setPendingAction(() => actionToExecute)
    setIsPinModalOpen(true)
  }

  const handleDeleteInsumoRequest = (id: number) => {
    const action = async () => {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('delete-insumo', { id })
      if (res.success) {
        await fetchData()
        alert('🗑️ Insumo eliminado correctamente.')
      } else {
        alert('❌ Error al eliminar insumo: ' + res.error)
      }
    }
    setPendingAction(() => action)
    setIsPinModalOpen(true)
  }

  // --- CONFIRMACIÓN PIN ---

  const handlePinVerified = async (pin: string) => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('verify-pin', { pin })
    
    if (res.success && res.user.rol === 'admin') {
      setIsPinModalOpen(false)
      if (pendingAction) {
        await pendingAction() 
      }
      setPendingAction(null)
    } else {
      alert('⛔ PIN Incorrecto o no cuentas con permisos de Administrador.')
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#111', fontFamily: 'sans-serif' }}>
      
      {/* HEADER LIMPIO Y MODERNO */}
      <div style={{ padding: '20px 30px', display: 'flex', justifyContent: 'space-between', background: '#1a1a1a', alignItems: 'center', borderBottom: '1px solid #333' }}>
        <button onClick={onBack} style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}>
          ← Menú principal
        </button>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>Platillos e Insumos</div>
        <div style={{ textAlign: 'right', color: '#9ca3af' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>{timeString}</div>
          <div style={{ fontSize: '0.8rem' }}>{formattedDate}</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
        
        {/* TABS (Pestañas) - Rediseñadas para ser más limpias */}
        <div style={{ display: 'flex', maxWidth: '600px', marginBottom: '30px', background: '#1a1a1a', borderRadius: '12px', padding: '5px', border: '1px solid #333' }}>
          <button 
            onClick={() => { setActiveTab('productos'); setSearchTerm(''); }} 
            style={{ 
              flex: 1, padding: '12px', 
              background: activeTab === 'productos' ? '#262626' : 'transparent', 
              color: activeTab === 'productos' ? '#10b981' : '#6b7280', 
              border: 'none', borderRadius: '8px',
              cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold',
              transition: 'all 0.2s', boxShadow: activeTab === 'productos' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
            }}>
            Platillos / Productos
          </button>
          <button 
            onClick={() => { setActiveTab('insumos'); setSearchTerm(''); }} 
            style={{ 
              flex: 1, padding: '12px', 
              background: activeTab === 'insumos' ? '#262626' : 'transparent', 
              color: activeTab === 'insumos' ? '#10b981' : '#6b7280', 
              border: 'none', borderRadius: '8px',
              cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold',
              transition: 'all 0.2s', boxShadow: activeTab === 'insumos' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
            }}>
            Inventario / Insumos
          </button>
        </div>

        {/* CONTENIDO DE PESTAÑAS */}
        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '50px', fontSize: '1.2rem' }}>Cargando datos...</div>
        ) : activeTab === 'productos' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              
              {/* Barra de Búsqueda Moderna */}
              <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                <span style={{ position: 'absolute', left: '15px', top: '12px', fontSize: '1.1rem' }}>🔍</span>
                <input 
                  type="text" 
                  placeholder="Buscar platillo o producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ 
                    width: '100%', padding: '12px 20px 12px 45px', borderRadius: '25px', 
                    background: '#1a1a1a', border: '1px solid #333', color: 'white', 
                    fontSize: '1rem', outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.border = '1px solid #10b981'}
                  onBlur={(e) => e.target.style.border = '1px solid #333'}
                />
              </div>

              <button 
                onClick={handleOpenCreate}
                style={{ 
                  padding: '12px 25px', background: '#10b981', color: 'white', 
                  border: 'none', borderRadius: '25px', fontWeight: 'bold', fontSize: '1rem', 
                  cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#059669'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#10b981'}
              >
                + Nuevo producto
              </button>
            </div>

            {filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6b7280', marginTop: '50px', fontSize: '1.2rem' }}>
                {searchTerm ? `No se encontraron productos con "${searchTerm}"` : 'No hay productos registrados.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {filteredProducts.map(prod => (
                  <div key={prod.id} style={{ 
                    background: '#1a1a1a', padding: '25px', borderRadius: '15px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    border: '1px solid #333', color: 'white',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    transition: 'transform 0.2s, border-color 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = '#404040'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = '#333'; }}
                  >
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px' }}>{prod.nombre}</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: prod.active ? '#10b981' : '#ef4444', marginBottom: '20px', padding: '2px 8px', background: prod.active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', display: 'inline-block' }}>
                        {prod.active ? 'Activo' : 'Inactivo'}
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          onClick={() => handleOpenEdit(prod)}
                          style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', transition: 'all 0.2s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = 'white'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#3b82f6'; }}
                        >Editar</button>
                        <button 
                          onClick={() => handleToggleStatusRequest(prod.id, prod.active)}
                          style={{ padding: '8px 16px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', transition: 'all 0.2s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}
                        >{prod.active ? 'Ocultar' : 'Activar'}</button>
                      </div>
                    </div>
                    <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.4rem' }}>
                      ${Number(prod.precio).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Barra superior de insumos (Búsqueda y botón Nuevo) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                <span style={{ position: 'absolute', left: '15px', top: '12px', fontSize: '1.1rem' }}>🔍</span>
                <input 
                  type="text" 
                  placeholder="Buscar insumo por nombre o código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ 
                    width: '100%', padding: '12px 20px 12px 45px', borderRadius: '25px', 
                    background: '#1a1a1a', border: '1px solid #333', color: 'white', 
                    fontSize: '1rem', outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.border = '1px solid #10b981'}
                  onBlur={(e) => e.target.style.border = '1px solid #333'}
                />
              </div>

              <button 
                onClick={handleOpenCreateInsumo}
                style={{ 
                  padding: '12px 25px', background: '#10b981', color: 'white', 
                  border: 'none', borderRadius: '25px', fontWeight: 'bold', fontSize: '1rem', 
                  cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#059669'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#10b981'}
              >
                + Nuevo insumo
              </button>
            </div>

            <div style={{ background: '#1a1a1a', borderRadius: '15px', border: '1px solid #333', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#262626', borderBottom: '1px solid #333', color: '#9ca3af', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '18px 20px', fontWeight: '600' }}>Código</th>
                    <th style={{ padding: '18px 20px', fontWeight: '600' }}>Nombre del insumo</th>
                    <th style={{ padding: '18px 20px', fontWeight: '600' }}>Unidad</th>
                    <th style={{ padding: '18px 20px', fontWeight: '600', textAlign: 'right' }}>Stock actual</th>
                    <th style={{ padding: '18px 20px', fontWeight: '600', textAlign: 'right' }}>Stock mínimo</th>
                    <th style={{ padding: '18px 20px', fontWeight: '600', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInsumos.map(insumo => {
                    const isLowStock = insumo.stock_actual <= insumo.stock_minimo;
                    return (
                      <tr key={insumo.id} style={{ borderBottom: '1px solid #262626', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={{ padding: '15px 20px', color: '#6b7280', fontFamily: 'monospace' }}>{insumo.codigo}</td>
                        <td style={{ padding: '15px 20px', fontWeight: '500' }}>
                          {insumo.nombre}
                          {isLowStock && <span style={{ marginLeft: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>Alerta Stock</span>}
                        </td>
                        <td style={{ padding: '15px 20px', color: '#9ca3af' }}>{insumo.unidad_medida}</td>
                        <td style={{ padding: '15px 20px', textAlign: 'right', fontWeight: 'bold', color: isLowStock ? '#ef4444' : '#10b981', fontSize: '1.1rem' }}>{insumo.stock_actual}</td>
                        <td style={{ padding: '15px 20px', textAlign: 'right', color: '#6b7280' }}>{insumo.stock_minimo}</td>
                        <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleOpenEditInsumo(insumo)}
                            style={{ background: 'transparent', color: '#3b82f6', border: 'none', cursor: 'pointer', marginRight: '15px', fontWeight: 'bold' }}
                          >Editar</button>
                          <button 
                            onClick={() => handleDeleteInsumoRequest(insumo.id)}
                            style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                          >Eliminar</button>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredInsumos.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                        {searchTerm ? `No se encontraron insumos con "${searchTerm}"` : 'No hay insumos registrados.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* MODAL FORMULARIO PRODUCTOS */}
      {isEditing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a1a1a', padding: '35px', borderRadius: '20px', width: '420px', color: 'white', border: '1px solid #333', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h2 style={{ margin: '0 0 25px 0', fontSize: '1.5rem', color: '#10b981' }}>
              {editingId ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>Nombre del Producto</label>
              <input 
                value={formName} onChange={e => setFormName(e.target.value)}
                style={{ 
                  width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #333', 
                  background: '#111', color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.border = '1px solid #10b981'}
                onBlur={(e) => e.target.style.border = '1px solid #333'}
                placeholder="Ej. PIZZA HAWAIANA"
                autoFocus
              />
              <small style={{color: '#6b7280', display: 'block', marginTop: '8px'}}>El nombre se guardará en MAYÚSCULAS.</small>
            </div>
            
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>Precio ($)</label>
              <input 
                type="number"
                min="0"
                value={formPrice} onChange={e => setFormPrice(e.target.value)}
                style={{ 
                  width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #333', 
                  background: '#111', color: 'white', fontSize: '1rem', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.border = '1px solid #10b981'}
                onBlur={(e) => e.target.style.border = '1px solid #333'}
                placeholder="0.00"
              />
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button 
                onClick={() => setIsEditing(false)}
                style={{ flex: 1, padding: '14px', background: '#262626', color: '#9ca3af', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#262626'; e.currentTarget.style.color = '#9ca3af'; }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveClick}
                style={{ flex: 1, padding: '14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#059669'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#10b981'}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORMULARIO INSUMOS */}
      {isEditingInsumo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a1a1a', padding: '35px', borderRadius: '20px', width: '500px', color: 'white', border: '1px solid #333', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h2 style={{ margin: '0 0 25px 0', fontSize: '1.5rem', color: '#10b981' }}>
              {editingInsumoId ? 'Editar Insumo' : 'Nuevo Insumo'}
            </h2>
            
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>Código</label>
                <input 
                  value={formInsumoCodigo} onChange={e => setFormInsumoCodigo(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                  placeholder="Ej. INS-001"
                />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>Nombre</label>
                <input 
                  value={formInsumoNombre} onChange={e => setFormInsumoNombre(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                  placeholder="Ej. Masa para Pizza"
                />
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>Unidad de Medida</label>
              <select 
                value={formInsumoUnidad} onChange={e => setFormInsumoUnidad(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', appearance: 'none' }}
              >
                <option value="KG">Kilogramos (KG)</option>
                <option value="G">Gramos (G)</option>
                <option value="L">Litros (L)</option>
                <option value="ML">Mililitros (ML)</option>
                <option value="PZ">Piezas (PZ)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>Stock Actual</label>
                <input 
                  type="number" step="0.01" min="0"
                  value={formInsumoStock} onChange={e => setFormInsumoStock(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: 'white', fontSize: '1rem', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>Stock Mínimo (Alerta)</label>
                <input 
                  type="number" step="0.01" min="0"
                  value={formInsumoStockMinimo} onChange={e => setFormInsumoStockMinimo(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: 'white', fontSize: '1rem', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button 
                onClick={() => setIsEditingInsumo(false)}
                style={{ flex: 1, padding: '14px', background: '#262626', color: '#9ca3af', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#262626'; e.currentTarget.style.color = '#9ca3af'; }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveInsumoClick}
                style={{ flex: 1, padding: '14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#059669'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#10b981'}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SEGURIDAD (PIN) */}
      <PinPadModal 
        title="Autorización de Admin 🛡️"
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onVerify={handlePinVerified}
      />
    </div>
  )
}