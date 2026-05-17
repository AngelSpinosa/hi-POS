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
  // Pestañas
  const [activeTab, setActiveTab] = useState<'productos' | 'insumos' | 'historial'>('productos')
  
  const [products, setProducts] = useState<Producto[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoView[]>([]) 
  const [isLoading, setIsLoading] = useState(true)
  
  // Búsqueda
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
        window.electron.ipcRenderer.invoke('get-movimientos') 
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
    <div style={{ 
      height: '100%', display: 'flex', flexDirection: 'column', 
      boxSizing: 'border-box'
    }}>

      {/* BOTÓN VOLVER */}
      <div style={{ padding: '30px 40px 0 40px' }}>
        <button 
          onClick={onBack} 
          style={{ 
            background: 'transparent', color: 'white', border: 'none', 
            cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', 
            display: 'flex', alignItems: 'center', padding: 0, fontFamily: 'var(--font-heading, monospace)' 
          }}
        >
          ← Menú principal
        </button>
      </div>

      {/* TABS (Botonera hueca estilo Figma) */}
      <div style={{ margin: '20px 40px 30px 40px', border: '1px solid #ffffff', borderRadius: '16px', display: 'flex', padding: '10px' }}>
        <button 
          onClick={() => { setActiveTab('productos'); setSearchTerm(''); }} 
          style={{ 
            flex: 1, padding: '14px', background: 'transparent', 
            color: activeTab === 'productos' ? '#00E676' : 'white', 
            border: activeTab === 'productos' ? '1px solid #00E676' : '1px solid transparent', 
            borderRadius: '30px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', 
            transition: 'all 0.2s', fontFamily: 'inherit' 
          }}
        >
          Platillos/Productos
        </button>
        <button 
          onClick={() => { setActiveTab('insumos'); setSearchTerm(''); }} 
          style={{ 
            flex: 1, padding: '14px', background: 'transparent', 
            color: activeTab === 'insumos' ? '#00E676' : 'white', 
            border: activeTab === 'insumos' ? '1px solid #00E676' : '1px solid transparent', 
            borderRadius: '30px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', 
            transition: 'all 0.2s', fontFamily: 'inherit' 
          }}
        >
          Inventario/Insumos
        </button>
        <button 
          onClick={() => { setActiveTab('historial'); setSearchTerm(''); }} 
          style={{ 
            flex: 1, padding: '14px', background: 'transparent', 
            color: activeTab === 'historial' ? '#00E676' : 'white', 
            border: activeTab === 'historial' ? '1px solid #00E676' : '1px solid transparent', 
            borderRadius: '30px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', 
            transition: 'all 0.2s', fontFamily: 'inherit' 
          }}
        >
          Historial de movimientos
        </button>
      </div>

      {/* BÚSQUEDA Y ACCIONES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', padding: '0 40px' }}>
        <div style={{ width: '200px' }}>{/* Spacer visual */}</div>
        
        <div style={{ position: 'relative', width: '450px' }}>
          <svg style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder={searchPlaceholder} 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            style={{ 
              width: '100%', padding: '12px 20px 12px 45px', borderRadius: '30px', 
              background: 'transparent', border: '1px solid #555', color: 'white', 
              fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' 
            }} 
          />
        </div>
        
        <div style={{ width: '200px', display: 'flex', justifyContent: 'flex-end' }}>
          {activeTab === 'productos' && (
            <button onClick={handleOpenCreate} style={{ padding: '12px 20px', background: '#00E676', color: 'black', border: 'none', borderRadius: '30px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Nuevo producto
            </button>
          )}
          {activeTab === 'insumos' && (
            <button onClick={handleOpenCreateInsumo} style={{ padding: '12px 20px', background: '#00E676', color: 'black', border: 'none', borderRadius: '30px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Nuevo insumo
            </button>
          )}
          {activeTab === 'historial' && (
             <div style={{ width: '100%' }}></div> /* Empty spacer */
          )}
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL SCROLL */}
      <div style={{ flex: 1, padding: '0 40px 40px 40px', overflowY: 'auto' }}>
        
        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '50px' }}>Cargando datos...</div>
        ) : activeTab === 'productos' ? (
          
          /* PESTAÑA 1: PLATILLOS (GRID 2 COLUMNAS) */
          <>
            {filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6b7280', marginTop: '50px' }}>No hay productos.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '25px' }}>
                {filteredProducts.map(prod => (
                  <div key={prod.id} style={{ border: '1px solid #555', borderRadius: '16px', padding: '25px', background: '#161616', display: 'flex', justifyContent: 'space-between', transition: 'transform 0.2s' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>{prod.nombre}</div>
                      <div style={{ color: prod.active ? '#00E676' : '#ef4444', fontSize: '0.95rem' }}>
                        {prod.active ? 'Disponible' : 'No disponible'}
                      </div>
                      <div style={{ color: 'white', fontSize: '0.95rem', marginBottom: '15px' }}>
                        Cantidades disponibles
                      </div>
                      
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => handleOpenEdit(prod)} style={{ padding: '8px 25px', background: '#00B4D8', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', fontFamily: 'inherit' }}>
                          Editar
                        </button>
                        <button onClick={() => handleToggleStatusRequest(prod.id, prod.active)} style={{ padding: '8px 25px', background: prod.active ? '#FF0000' : '#555', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', fontFamily: 'inherit' }}>
                          {prod.active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onClick={() => handleOpenRecipe(prod)} style={{ padding: '8px 20px', background: 'transparent', color: 'white', border: '1px solid white', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', fontFamily: 'inherit' }}>
                          Receta
                        </button>
                      </div>
                    </div>
                    <div>
                      <div style={{ background: '#FCA311', color: 'white', padding: '6px 15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.2rem' }}>
                        ${Number(prod.precio).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>

        ) : activeTab === 'insumos' ? (
          
          /* PESTAÑA 2: INSUMOS (TABLA) */
          <div style={{ border: '1px solid #ffffff', borderRadius: '16px', overflow: 'hidden', background: 'transparent' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre del insumo</th>
                  <th>Unidad</th>
                  <th>Stock actual</th>
                  <th>Stock minimo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredInsumos.map(insumo => (
                  <tr key={insumo.id}>
                    <td>{insumo.codigo}</td>
                    <td>{insumo.nombre}</td>
                    <td>{insumo.unidad_medida}</td>
                    <td style={{ color: insumo.stock_actual <= insumo.stock_minimo ? '#ff0000' : 'white' }}>
                      {insumo.stock_actual}
                    </td>
                    <td>{insumo.stock_minimo}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => handleOpenMovement(insumo, 'ENTRADA')} style={{ background: '#00E676', color: 'black', border: 'none', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', fontFamily: 'inherit' }}>
                          + Stock
                        </button>
                        <button onClick={() => handleOpenMovement(insumo, 'MERMA')} style={{ background: '#FF0000', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', fontFamily: 'inherit' }}>
                          - Merma
                        </button>
                        <button onClick={() => handleOpenEditInsumo(insumo)} style={{ background: '#00B4D8', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', fontFamily: 'inherit' }}>
                          Editar
                        </button>
                        <button onClick={() => handleDeleteInsumoRequest(insumo.id)} style={{ background: '#FF0000', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', fontFamily: 'inherit' }}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredInsumos.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '40px' }}>No hay insumos.</td></tr>
                )}
              </tbody>
            </table>
          </div>

        ) : (
          
          /* PESTAÑA 3: HISTORIAL (TABLA) */
          <div style={{ border: '1px solid #ffffff', borderRadius: '16px', overflow: 'hidden', background: 'transparent' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Insumo</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Motivo/Justificación</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovimientos.map(mov => {
                  const fechaMov = new Date(mov.fecha).toLocaleString('es-MX', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: false
                  });
                  return (
                    <tr key={mov.id}>
                      <td>{fechaMov}</td>
                      <td>{mov.insumo_nombre}</td>
                      <td>{mov.tipo}</td>
                      <td style={{ color: mov.tipo === 'ENTRADA' ? '#00E676' : mov.tipo === 'MERMA' ? '#FF0000' : '#00B4D8' }}>
                        {mov.tipo === 'ENTRADA' ? '+' : '-'}{mov.cantidad}
                      </td>
                      <td>{mov.motivo}</td>
                    </tr>
                  )
                })}
                {filteredMovimientos.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '40px' }}>No hay historial.</td></tr>
                )}
              </tbody>
            </table>
          </div>

        )}
      </div>

      {/* ================= MODALES REDISEÑADOS ================= */}
      
      {/* MODAL MOVIMIENTO */}
      {isMovementModalOpen && movementInsumo && (
        <div className="modal-overlay" onClick={() => setIsMovementModalOpen(false)}>
          <div style={{ background: '#161616', padding: '35px', borderRadius: '16px', width: '450px', border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '20px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: movementType === 'ENTRADA' ? '#00E676' : '#FF0000' }}>
              {movementType === 'ENTRADA' ? 'Registrar Reabasto' : 'Registrar Merma'}
            </h2>
            <p style={{ margin: 0, color: 'white' }}>Insumo: <strong>{movementInsumo.nombre}</strong></p>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Cantidad</label>
              <input type="number" step="0.01" min="0.01" value={movementCantidad} onChange={e => setMovementCantidad(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #555', background: 'transparent', color: 'white', boxSizing: 'border-box', fontFamily: 'inherit' }} autoFocus />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Motivo</label>
              <input type="text" value={movementMotivo} onChange={e => setMovementMotivo(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #555', background: 'transparent', color: 'white', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
              <button onClick={() => setIsMovementModalOpen(false)} style={{ flex: 1, padding: '12px', background: 'transparent', color: 'white', border: '1px solid white', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={handleSaveMovement} style={{ flex: 1, padding: '12px', background: movementType === 'ENTRADA' ? '#00E676' : '#FF0000', color: movementType === 'ENTRADA' ? 'black' : 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECETAS */}
      {isRecipeModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRecipeModalOpen(false)}>
          <div style={{ background: '#161616', padding: '35px', borderRadius: '16px', width: '550px', border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '20px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'white' }}>Receta: {recipeProductName}</h2>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <select value={selectedInsumoId} onChange={e => setSelectedInsumoId(Number(e.target.value))} style={{ flex: 2, padding: '12px', borderRadius: '8px', border: '1px solid #555', background: '#111', color: 'white', fontFamily: 'inherit' }}>
                <option value="">-- Seleccionar Insumo --</option>
                {insumos.map(ins => <option key={ins.id} value={ins.id}>{ins.nombre} ({ins.unidad_medida})</option>)}
              </select>
              <input type="number" step="0.01" min="0" placeholder="Cant." value={recipeCantidad} onChange={e => setRecipeCantidad(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #555', background: 'transparent', color: 'white', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <button onClick={handleAddIngredient} style={{ padding: '0 20px', background: '#00E676', color: 'black', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>Añadir</button>
            </div>

            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #555', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                <thead style={{ background: '#222' }}>
                  <tr><th style={{ padding: '10px' }}>Insumo</th><th style={{ padding: '10px' }}>Cantidad</th><th style={{ padding: '10px' }}>Quitar</th></tr>
                </thead>
                <tbody>
                  {recipeItems.map(item => (
                    <tr key={item.insumo_id} style={{ borderBottom: '1px solid #333' }}>
                      <td style={{ padding: '10px' }}>{item.insumo_nombre}</td>
                      <td style={{ padding: '10px', color: '#00E676' }}>{item.cantidad_requerida} {item.unidad_medida}</td>
                      <td style={{ padding: '10px' }}><button onClick={() => handleRemoveIngredient(item.insumo_id)} style={{ background: 'transparent', color: '#FF0000', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
              <button onClick={() => setIsRecipeModalOpen(false)} style={{ flex: 1, padding: '12px', background: 'transparent', color: 'white', border: '1px solid white', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>Cerrar</button>
              <button onClick={handleSaveRecipe} style={{ flex: 1, padding: '12px', background: 'white', color: 'black', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO/EDITAR PRODUCTO */}
      {isEditing && (
        <div className="modal-overlay" onClick={() => setIsEditing(false)}>
          <div style={{ background: '#161616', padding: '35px', borderRadius: '16px', width: '420px', border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '20px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'white' }}>{editingId ? 'Editar Platillo' : 'Nuevo Platillo'}</h2>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Nombre</label>
              <input value={formName} onChange={e => setFormName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #555', background: 'transparent', color: 'white', boxSizing: 'border-box', fontFamily: 'inherit' }} autoFocus />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Precio ($)</label>
              <input type="number" min="0" value={formPrice} onChange={e => setFormPrice(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #555', background: 'transparent', color: 'white', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
              <button onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '12px', background: 'transparent', color: 'white', border: '1px solid white', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={handleSaveClick} style={{ flex: 1, padding: '12px', background: '#00E676', color: 'black', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO/EDITAR INSUMO */}
      {isEditingInsumo && (
        <div className="modal-overlay" onClick={() => setIsEditingInsumo(false)}>
          <div style={{ background: '#161616', padding: '35px', borderRadius: '16px', width: '500px', border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '20px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'white' }}>{editingInsumoId ? 'Editar Insumo' : 'Nuevo Insumo'}</h2>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Código</label>
                <input value={formInsumoCodigo} onChange={e => setFormInsumoCodigo(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #555', background: 'transparent', color: 'white', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Nombre</label>
                <input value={formInsumoNombre} onChange={e => setFormInsumoNombre(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #555', background: 'transparent', color: 'white', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Unidad de Medida</label>
              <select value={formInsumoUnidad} onChange={e => setFormInsumoUnidad(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #555', background: '#111', color: 'white', boxSizing: 'border-box', fontFamily: 'inherit' }}>
                <option value="KG">Kilogramos (KG)</option><option value="G">Gramos (G)</option><option value="L">Litros (L)</option><option value="ML">Mililitros (ML)</option><option value="PZ">Piezas (PZ)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Stock Actual</label>
                <input type="number" step="0.01" min="0" value={formInsumoStock} onChange={e => setFormInsumoStock(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #555', background: 'transparent', color: 'white', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Stock Mínimo</label>
                <input type="number" step="0.01" min="0" value={formInsumoStockMinimo} onChange={e => setFormInsumoStockMinimo(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #555', background: 'transparent', color: 'white', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
              <button onClick={() => setIsEditingInsumo(false)} style={{ flex: 1, padding: '12px', background: 'transparent', color: 'white', border: '1px solid white', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={handleSaveInsumoClick} style={{ flex: 1, padding: '12px', background: '#00E676', color: 'black', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <PinPadModal title="Autorización 🛡️" isOpen={isPinModalOpen} onClose={() => setIsPinModalOpen(false)} onVerify={handlePinVerified} />

      {/* ESTILOS INTERNOS PARA EVITAR DOBLES BORDES EN LA TABLA HUECA */}
      <style>{`
        .custom-table { width: 100%; border-collapse: collapse; text-align: center; }
        .custom-table th, .custom-table td { border: 1px solid #ffffff; padding: 15px; }
        .custom-table tr:first-child th { border-top: none; }
        .custom-table tr:last-child td { border-bottom: none; }
        .custom-table tr th:first-child, .custom-table tr td:first-child { border-left: none; }
        .custom-table tr th:last-child, .custom-table tr td:last-child { border-right: none; }
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

    </div>
  )
}