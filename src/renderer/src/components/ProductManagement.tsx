import { useState, useEffect } from 'react'
import type { Producto, Insumo, movimiento_inventario } from '../types/db'
import { PinPadModal } from './PinPadModal'

interface ProductManagementProps {
  onBack: () => void;
}

// Tipo local para el UI de la receta
interface RecipeItem {
  insumo_id: number;
  insumo_nombre: string;
  unidad_medida: string;
  cantidad_requerida: number;
}

// Tipo local para visualizar movimientos unidos con insumos
interface MovimientoView extends movimiento_inventario {
  insumo_nombre: string;
  codigo: string;
  unidad_medida: string;
}

export function ProductManagement({ onBack }: ProductManagementProps) {
  // NUEVO: Añadida la pestaña 'historial'
  const [activeTab, setActiveTab] = useState<'productos' | 'insumos' | 'historial'>('productos')
  
  const [products, setProducts] = useState<Producto[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoView[]>([]) // NUEVO ESTADO
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

  // Formulario de Recetas (CU-44)
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false)
  const [recipeProductId, setRecipeProductId] = useState<number | null>(null)
  const [recipeProductName, setRecipeProductName] = useState('')
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([])
  const [selectedInsumoId, setSelectedInsumoId] = useState<number | ''>('')
  const [recipeCantidad, setRecipeCantidad] = useState('')

  // Formulario de Movimientos de Inventario (CU-45 y CU-46)
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)
  const [movementType, setMovementType] = useState<'ENTRADA' | 'MERMA'>('ENTRADA')
  const [movementInsumo, setMovementInsumo] = useState<Insumo | null>(null)
  const [movementCantidad, setMovementCantidad] = useState('')
  const [movementMotivo, setMovementMotivo] = useState('')

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
      const [resProducts, resInsumos, resMovimientos] = await Promise.all([
        // @ts-ignore
        window.electron.ipcRenderer.invoke('get-products'),
        // @ts-ignore
        window.electron.ipcRenderer.invoke('get-insumos'),
        // @ts-ignore
        window.electron.ipcRenderer.invoke('get-movimientos') // NUEVA LLAMADA
      ])

      if (Array.isArray(resProducts)) setProducts(resProducts)
      else setProducts([])

      if (Array.isArray(resInsumos)) setInsumos(resInsumos)
      else setInsumos([])

      if (resMovimientos && resMovimientos.success) setMovimientos(resMovimientos.data)
      else setMovimientos([])

    } catch (e) { 
      console.error(e) 
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Filtrados dinámicos
  const filteredProducts = products.filter(product =>
    product.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredInsumos = insumos.filter(insumo =>
    insumo.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    insumo.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Búsqueda en el historial
  const filteredMovimientos = movimientos.filter(mov =>
    mov.insumo_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mov.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mov.motivo.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const timeString = currentTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
  const dateString = currentTime.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const formattedDate = dateString.replace(/\b\w/g, l => l.toUpperCase())

  // Placeholder dinámico para la barra de búsqueda
  let searchPlaceholder = 'Buscar...';
  if (activeTab === 'productos') searchPlaceholder = 'Buscar platillo o producto...';
  if (activeTab === 'insumos') searchPlaceholder = 'Buscar insumo por nombre o código...';
  if (activeTab === 'historial') searchPlaceholder = 'Buscar en historial por insumo o motivo...';

  // --- MÉTODOS DEL FORMULARIO (Productos) ---

  const handleOpenCreate = () => {
    setEditingId(null); setFormName(''); setFormPrice(''); setIsEditing(true);
  }

  const handleOpenEdit = (prod: Producto) => {
    setEditingId(prod.id); setFormName(prod.nombre); setFormPrice(prod.precio?.toString() || '0'); setIsEditing(true);
  }

  const handleSaveClick = () => {
    if (!formName.trim() || formPrice === '') { alert('⚠️ Por favor ingresa el nombre y el precio.'); return; }
    if (Number(formPrice) < 0) { alert('⚠️ El precio no puede ser negativo.'); return; }
    
    const actionToExecute = async () => {
      const channel = editingId ? 'update-product' : 'create-product'
      const payload = editingId ? { id: editingId, nombre: formName, precio: Number(formPrice) } : { nombre: formName, precio: Number(formPrice) }
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke(channel, payload)
      if (res.success) { setIsEditing(false); await fetchData(); alert('✅ Guardado.'); } 
      else { alert('❌ Error: ' + res.error); }
    }
    setPendingAction(() => actionToExecute); setIsPinModalOpen(true);
  }

  const handleToggleStatusRequest = (id: number, currentStatus: number) => {
    const action = async () => {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('toggle-product-status', { id, active: currentStatus ? 0 : 1 })
      if (res.success) { await fetchData(); alert(currentStatus ? '🔴 Desactivado' : '🟢 Activado'); }
    }
    setPendingAction(() => action); setIsPinModalOpen(true);
  }

  // --- MÉTODOS DEL FORMULARIO (Insumos) ---

  const handleOpenCreateInsumo = () => {
    setEditingInsumoId(null); setFormInsumoCodigo(''); setFormInsumoNombre(''); setFormInsumoUnidad('KG'); setFormInsumoStock('0'); setFormInsumoStockMinimo('0'); setIsEditingInsumo(true);
  }

  const handleOpenEditInsumo = (insumo: Insumo) => {
    setEditingInsumoId(insumo.id); setFormInsumoCodigo(insumo.codigo); setFormInsumoNombre(insumo.nombre); setFormInsumoUnidad(insumo.unidad_medida); setFormInsumoStock(insumo.stock_actual.toString()); setFormInsumoStockMinimo(insumo.stock_minimo.toString()); setIsEditingInsumo(true);
  }

  const handleSaveInsumoClick = () => {
    if (!formInsumoCodigo.trim() || !formInsumoNombre.trim() || formInsumoStock === '' || formInsumoStockMinimo === '') { alert('⚠️ Completa los campos.'); return; }
    const actionToExecute = async () => {
      const payload = { id: editingInsumoId, codigo: formInsumoCodigo.toUpperCase(), nombre: formInsumoNombre, unidad_medida: formInsumoUnidad, stock_actual: Number(formInsumoStock), stock_minimo: Number(formInsumoStockMinimo) }
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke(editingInsumoId ? 'update-insumo' : 'create-insumo', payload)
      if (res.success) { setIsEditingInsumo(false); await fetchData(); alert('✅ Guardado.'); } 
      else { alert('❌ Error: ' + res.error); }
    }
    setPendingAction(() => actionToExecute); setIsPinModalOpen(true);
  }

  const handleDeleteInsumoRequest = (id: number) => {
    const action = async () => {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('delete-insumo', { id })
      if (res.success) { await fetchData(); alert('🗑️ Eliminado.'); }
    }
    setPendingAction(() => action); setIsPinModalOpen(true);
  }

  // --- MÉTODOS DE RECETA (CU-44) ---
  
  const handleOpenRecipe = async (prod: Producto) => {
    setRecipeProductId(prod.id); setRecipeProductName(prod.nombre); setSelectedInsumoId(''); setRecipeCantidad(''); setIsRecipeModalOpen(true);
    try {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('get-receta', prod.id);
      if (res.success) { setRecipeItems(res.data); }
    } catch (e) { console.error(e); }
  }

  const handleAddIngredient = () => {
    if (!selectedInsumoId || !recipeCantidad || Number(recipeCantidad) <= 0) return;
    const insumoRef = insumos.find(i => i.id === Number(selectedInsumoId));
    if (!insumoRef) return;
    if (recipeItems.find(r => r.insumo_id === insumoRef.id)) { alert("Este insumo ya está en la receta."); return; }
    setRecipeItems([...recipeItems, { insumo_id: insumoRef.id, insumo_nombre: insumoRef.nombre, unidad_medida: insumoRef.unidad_medida, cantidad_requerida: Number(recipeCantidad) }]);
    setSelectedInsumoId(''); setRecipeCantidad('');
  }

  const handleRemoveIngredient = (insumoId: number) => { setRecipeItems(recipeItems.filter(item => item.insumo_id !== insumoId)); }

  const handleSaveRecipe = () => {
    const actionToExecute = async () => {
      const payload = { productoId: recipeProductId, ingredientes: recipeItems.map(item => ({ insumo_id: item.insumo_id, cantidad_requerida: item.cantidad_requerida })) };
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('save-receta', payload);
      if (res.success) { setIsRecipeModalOpen(false); alert('✅ Receta guardada y lista para automatización.'); } else { alert('❌ Error: ' + res.error); }
    }
    setPendingAction(() => actionToExecute); setIsPinModalOpen(true);
  }

  // --- MÉTODOS DE MOVIMIENTOS (CU-45 y CU-46) ---
  
  const handleOpenMovement = (insumo: Insumo, type: 'ENTRADA' | 'MERMA') => {
    setMovementInsumo(insumo);
    setMovementType(type);
    setMovementCantidad('');
    setMovementMotivo(type === 'ENTRADA' ? 'Compra a proveedor' : 'Producto dañado/caducado');
    setIsMovementModalOpen(true);
  }

  const handleSaveMovement = () => {
    if (!movementCantidad || Number(movementCantidad) <= 0 || !movementMotivo.trim()) {
      alert('⚠️ Por favor ingresa una cantidad válida y un motivo.');
      return;
    }
    
    if (movementType === 'MERMA' && movementInsumo && Number(movementCantidad) > movementInsumo.stock_actual) {
      alert('⚠️ No puedes mermar más del stock actual.');
      return;
    }

    const actionToExecute = async () => {
      const payload = {
        insumo_id: movementInsumo?.id,
        tipo: movementType,
        cantidad: Number(movementCantidad),
        motivo: movementMotivo
      };
      
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('register-movement', payload);
      
      if (res.success) {
        setIsMovementModalOpen(false);
        await fetchData(); // Al recargar la data, se refrescará el historial también
        alert(`✅ ${movementType === 'ENTRADA' ? 'Reabasto' : 'Merma'} registrado correctamente.`);
      } else {
        alert('❌ Error al registrar movimiento: ' + res.error);
      }
    }
    
    setPendingAction(() => actionToExecute);
    setIsPinModalOpen(true); 
  }

  // --- CONFIRMACIÓN PIN ---
  const handlePinVerified = async (pin: string) => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('verify-pin', { pin })
    if (res.success && res.user.rol === 'admin') {
      setIsPinModalOpen(false)
      if (pendingAction) { await pendingAction() }
      setPendingAction(null)
    } else { alert('⛔ PIN Incorrecto o sin permisos.') }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#111', fontFamily: 'sans-serif' }}>
      {/* HEADER */}
      <div style={{ padding: '20px 30px', display: 'flex', justifyContent: 'space-between', background: '#1a1a1a', alignItems: 'center', borderBottom: '1px solid #333' }}>
        <button onClick={onBack} style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}>← Menú principal</button>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>Almacén y Menú</div>
        <div style={{ textAlign: 'right', color: '#9ca3af' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>{timeString}</div>
          <div style={{ fontSize: '0.8rem' }}>{formattedDate}</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
        {/* TABS (Ahora con 3 opciones) */}
        <div style={{ display: 'flex', maxWidth: '850px', marginBottom: '30px', background: '#1a1a1a', borderRadius: '12px', padding: '5px', border: '1px solid #333' }}>
          <button onClick={() => { setActiveTab('productos'); setSearchTerm(''); }} style={{ flex: 1, padding: '12px', background: activeTab === 'productos' ? '#262626' : 'transparent', color: activeTab === 'productos' ? '#10b981' : '#6b7280', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: activeTab === 'productos' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none' }}>Platillos / Productos</button>
          <button onClick={() => { setActiveTab('insumos'); setSearchTerm(''); }} style={{ flex: 1, padding: '12px', background: activeTab === 'insumos' ? '#262626' : 'transparent', color: activeTab === 'insumos' ? '#10b981' : '#6b7280', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: activeTab === 'insumos' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none' }}>Inventario / Insumos</button>
          <button onClick={() => { setActiveTab('historial'); setSearchTerm(''); }} style={{ flex: 1, padding: '12px', background: activeTab === 'historial' ? '#262626' : 'transparent', color: activeTab === 'historial' ? '#10b981' : '#6b7280', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: activeTab === 'historial' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none' }}>Historial de Movimientos</button>
        </div>

        {/* BÚSQUEDA COMÚN Y ACCIONES PRINCIPALES */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
            <span style={{ position: 'absolute', left: '15px', top: '12px', fontSize: '1.1rem' }}>🔍</span>
            <input type="text" placeholder={searchPlaceholder} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '12px 20px 12px 45px', borderRadius: '25px', background: '#1a1a1a', border: '1px solid #333', color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.border = '1px solid #10b981'} onBlur={(e) => e.target.style.border = '1px solid #333'} />
          </div>
          
          {activeTab === 'productos' && (
            <button onClick={handleOpenCreate} style={{ padding: '12px 25px', background: '#10b981', color: 'white', border: 'none', borderRadius: '25px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#059669'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#10b981'}>+ Nuevo producto</button>
          )}
          {activeTab === 'insumos' && (
            <button onClick={handleOpenCreateInsumo} style={{ padding: '12px 25px', background: '#10b981', color: 'white', border: 'none', borderRadius: '25px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#059669'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#10b981'}>+ Nuevo insumo</button>
          )}
        </div>

        {/* CONTENIDO DE LAS PESTAÑAS */}
        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '50px', fontSize: '1.2rem' }}>Cargando datos...</div>
        ) : activeTab === 'productos' ? (
          <>
            {filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6b7280', marginTop: '50px', fontSize: '1.2rem' }}>{searchTerm ? `No se encontraron productos con "${searchTerm}"` : 'No hay productos registrados.'}</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                {filteredProducts.map(prod => (
                  <div key={prod.id} style={{ background: '#1a1a1a', padding: '25px', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', border: '1px solid #333', color: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', transition: 'transform 0.2s, border-color 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = '#404040'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = '#333'; }}>
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px' }}>{prod.nombre}</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: prod.active ? '#10b981' : '#ef4444', marginBottom: '20px', padding: '2px 8px', background: prod.active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', display: 'inline-block' }}>{prod.active ? 'Activo' : 'Inactivo'}</div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => handleOpenRecipe(prod)} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid #f59e0b', color: '#f59e0b', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#f59e0b'; e.currentTarget.style.color = 'black'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#f59e0b'; }}>📋 Receta</button>
                        <button onClick={() => handleOpenEdit(prod)} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = 'white'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#3b82f6'; }}>Editar</button>
                        <button onClick={() => handleToggleStatusRequest(prod.id, prod.active)} style={{ padding: '8px 12px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}>{prod.active ? 'Ocultar' : 'Activar'}</button>
                      </div>
                    </div>
                    <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.4rem' }}>${Number(prod.precio).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : activeTab === 'insumos' ? (
          <>
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
                        <td style={{ padding: '15px 20px', fontWeight: '500' }}>{insumo.nombre} {isLowStock && <span style={{ marginLeft: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>Alerta Stock</span>}</td>
                        <td style={{ padding: '15px 20px', color: '#9ca3af' }}>{insumo.unidad_medida}</td>
                        <td style={{ padding: '15px 20px', textAlign: 'right', fontWeight: 'bold', color: isLowStock ? '#ef4444' : '#10b981', fontSize: '1.1rem' }}>{insumo.stock_actual}</td>
                        <td style={{ padding: '15px 20px', textAlign: 'right', color: '#6b7280' }}>{insumo.stock_minimo}</td>
                        <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                          <button onClick={() => handleOpenMovement(insumo, 'ENTRADA')} style={{ background: 'transparent', color: '#10b981', border: 'none', cursor: 'pointer', marginRight: '15px', fontWeight: 'bold' }} title="Agregar Stock">+ Stock</button>
                          <button onClick={() => handleOpenMovement(insumo, 'MERMA')} style={{ background: 'transparent', color: '#f59e0b', border: 'none', cursor: 'pointer', marginRight: '20px', fontWeight: 'bold' }} title="Registrar Pérdida/Merma">- Merma</button>
                          <button onClick={() => handleOpenEditInsumo(insumo)} style={{ background: 'transparent', color: '#3b82f6', border: 'none', cursor: 'pointer', marginRight: '15px', fontWeight: 'bold' }}>Editar</button>
                          <button onClick={() => handleDeleteInsumoRequest(insumo.id)} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Eliminar</button>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredInsumos.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>{searchTerm ? 'No se encontraron insumos' : 'No hay insumos registrados.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          // NUEVA PESTAÑA: HISTORIAL DE MOVIMIENTOS
          <div style={{ background: '#1a1a1a', borderRadius: '15px', border: '1px solid #333', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#262626', borderBottom: '1px solid #333', color: '#9ca3af', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '18px 20px', fontWeight: '600' }}>Fecha y Hora</th>
                  <th style={{ padding: '18px 20px', fontWeight: '600' }}>Insumo</th>
                  <th style={{ padding: '18px 20px', fontWeight: '600' }}>Tipo</th>
                  <th style={{ padding: '18px 20px', fontWeight: '600', textAlign: 'right' }}>Cantidad</th>
                  <th style={{ padding: '18px 20px', fontWeight: '600' }}>Motivo / Justificación</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovimientos.map(mov => {
                  // Colores dinámicos según el tipo de movimiento
                  let colorTipo = '#10b981'; // Verde para Entrada
                  if (mov.tipo === 'SALIDA') colorTipo = '#3b82f6'; // Azul para Salida POS
                  if (mov.tipo === 'MERMA') colorTipo = '#ef4444'; // Rojo para Merma
                  
                  // Formateo simple de fecha
                  const fechaMov = new Date(mov.fecha).toLocaleString('es-MX', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: true
                  });

                  return (
                    <tr key={mov.id} style={{ borderBottom: '1px solid #262626', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '15px 20px', color: '#9ca3af', fontSize: '0.9rem' }}>{fechaMov}</td>
                      <td style={{ padding: '15px 20px', fontWeight: '500' }}>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', fontFamily: 'monospace', marginBottom: '2px' }}>{mov.codigo}</div>
                        {mov.insumo_nombre}
                      </td>
                      <td style={{ padding: '15px 20px' }}>
                        <span style={{ border: `1px solid ${colorTipo}`, color: colorTipo, padding: '4px 10px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          {mov.tipo}
                        </span>
                      </td>
                      <td style={{ padding: '15px 20px', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem', color: colorTipo }}>
                        {mov.tipo === 'ENTRADA' ? '+' : '-'}{mov.cantidad} <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 'normal' }}>{mov.unidad_medida}</span>
                      </td>
                      <td style={{ padding: '15px 20px', color: '#d1d5db' }}>{mov.motivo}</td>
                    </tr>
                  )
                })}
                {filteredMovimientos.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>{searchTerm ? 'No se encontraron movimientos' : 'No hay historial de movimientos.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL MOVIMIENTO (REABASTO O MERMA) - CU-45 y CU-46 */}
      {isMovementModalOpen && movementInsumo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a1a1a', padding: '35px', borderRadius: '20px', width: '450px', color: 'white', border: '1px solid #333', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', color: movementType === 'ENTRADA' ? '#10b981' : '#f59e0b' }}>
              {movementType === 'ENTRADA' ? '📥 Registrar Reabasto' : '⚠️ Registrar Merma'}
            </h2>
            <p style={{ margin: '0 0 25px 0', color: '#9ca3af' }}>
              Insumo: <strong style={{color: 'white'}}>{movementInsumo.nombre} ({movementInsumo.unidad_medida})</strong><br/>
              Stock Actual: <strong style={{color: 'white'}}>{movementInsumo.stock_actual}</strong>
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>
                Cantidad a {movementType === 'ENTRADA' ? 'Sumar' : 'Restar'}
              </label>
              <input 
                type="number" step="0.01" min="0.01"
                value={movementCantidad} onChange={e => setMovementCantidad(e.target.value)}
                style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: 'white', fontSize: '1.2rem', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                placeholder="0.00"
                autoFocus
              />
            </div>
            
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>
                Motivo / Justificación
              </label>
              <input 
                type="text"
                value={movementMotivo} onChange={e => setMovementMotivo(e.target.value)}
                style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => setIsMovementModalOpen(false)} style={{ flex: 1, padding: '14px', background: '#262626', color: '#9ca3af', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
              <button 
                onClick={handleSaveMovement} 
                style={{ flex: 1, padding: '14px', background: movementType === 'ENTRADA' ? '#10b981' : '#f59e0b', color: movementType === 'ENTRADA' ? 'white' : 'black', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Confirmar {movementType === 'ENTRADA' ? 'Reabasto' : 'Merma'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECETAS (CU-44) */}
      {isRecipeModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a1a1a', padding: '35px', borderRadius: '20px', width: '550px', color: 'white', border: '1px solid #333', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', color: '#f59e0b' }}>Receta del Producto</h2>
            <p style={{ margin: '0 0 25px 0', color: '#9ca3af' }}>Define qué insumos se descontarán al vender: <strong style={{color: 'white'}}>{recipeProductName}</strong></p>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: '#111', padding: '15px', borderRadius: '10px', border: '1px solid #333' }}>
              <div style={{ flex: 2 }}>
                <select value={selectedInsumoId} onChange={e => setSelectedInsumoId(Number(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #333', background: '#1a1a1a', color: 'white', outline: 'none' }}>
                  <option value="">-- Seleccionar Insumo --</option>
                  {insumos.map(ins => <option key={ins.id} value={ins.id}>{ins.nombre} ({ins.unidad_medida})</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <input type="number" step="0.01" min="0" placeholder="Cantidad" value={recipeCantidad} onChange={e => setRecipeCantidad(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #333', background: '#1a1a1a', color: 'white', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <button onClick={handleAddIngredient} style={{ padding: '0 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Añadir</button>
            </div>

            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '25px', background: '#111', borderRadius: '10px', border: '1px solid #333' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#262626', color: '#9ca3af', fontSize: '0.85rem' }}>
                    <th style={{ padding: '10px 15px' }}>Insumo</th>
                    <th style={{ padding: '10px 15px', textAlign: 'right' }}>Cantidad Requerida</th>
                    <th style={{ padding: '10px 15px', textAlign: 'center' }}>-</th>
                  </tr>
                </thead>
                <tbody>
                  {recipeItems.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>Sin ingredientes definidos.</td></tr>
                  ) : (
                    recipeItems.map(item => (
                      <tr key={item.insumo_id} style={{ borderBottom: '1px solid #262626' }}>
                        <td style={{ padding: '10px 15px' }}>{item.insumo_nombre}</td>
                        <td style={{ padding: '10px 15px', textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>{item.cantidad_requerida} {item.unidad_medida}</td>
                        <td style={{ padding: '10px 15px', textAlign: 'center' }}><button onClick={() => handleRemoveIngredient(item.insumo_id)} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>X</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => setIsRecipeModalOpen(false)} style={{ flex: 1, padding: '14px', background: '#262626', color: '#9ca3af', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleSaveRecipe} style={{ flex: 1, padding: '14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar Receta</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORMULARIO PRODUCTOS */}
      {isEditing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a1a1a', padding: '35px', borderRadius: '20px', width: '420px', color: 'white', border: '1px solid #333', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h2 style={{ margin: '0 0 25px 0', fontSize: '1.5rem', color: '#10b981' }}>{editingId ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>Nombre del Producto</label>
              <input value={formName} onChange={e => setFormName(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} placeholder="Ej. PIZZA HAWAIANA" autoFocus />
            </div>
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>Precio ($)</label>
              <input type="number" min="0" value={formPrice} onChange={e => setFormPrice(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: 'white', fontSize: '1rem', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} placeholder="0.00" />
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '14px', background: '#262626', color: '#9ca3af', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleSaveClick} style={{ flex: 1, padding: '14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORMULARIO INSUMOS */}
      {isEditingInsumo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a1a1a', padding: '35px', borderRadius: '20px', width: '500px', color: 'white', border: '1px solid #333', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h2 style={{ margin: '0 0 25px 0', fontSize: '1.5rem', color: '#10b981' }}>{editingInsumoId ? 'Editar Insumo' : 'Nuevo Insumo'}</h2>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>Código</label>
                <input value={formInsumoCodigo} onChange={e => setFormInsumoCodigo(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} placeholder="Ej. INS-001" />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>Nombre</label>
                <input value={formInsumoNombre} onChange={e => setFormInsumoNombre(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} placeholder="Ej. Masa para Pizza" />
              </div>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>Unidad de Medida</label>
              <select value={formInsumoUnidad} onChange={e => setFormInsumoUnidad(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', appearance: 'none' }}>
                <option value="KG">Kilogramos (KG)</option><option value="G">Gramos (G)</option><option value="L">Litros (L)</option><option value="ML">Mililitros (ML)</option><option value="PZ">Piezas (PZ)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>Stock Actual</label>
                <input type="number" step="0.01" min="0" value={formInsumoStock} onChange={e => setFormInsumoStock(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: 'white', fontSize: '1rem', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>Stock Mínimo (Alerta)</label>
                <input type="number" step="0.01" min="0" value={formInsumoStockMinimo} onChange={e => setFormInsumoStockMinimo(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: 'white', fontSize: '1rem', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => setIsEditingInsumo(false)} style={{ flex: 1, padding: '14px', background: '#262626', color: '#9ca3af', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleSaveInsumoClick} style={{ flex: 1, padding: '14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SEGURIDAD (PIN) */}
      <PinPadModal title="Autorización de Admin 🛡️" isOpen={isPinModalOpen} onClose={() => setIsPinModalOpen(false)} onVerify={handlePinVerified} />
    </div>
  )
}