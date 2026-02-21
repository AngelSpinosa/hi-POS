import { useState, useEffect } from 'react'
import type { Producto } from '../types/db'
import { PinPadModal } from './PinPadModal'

interface ProductManagementProps {
  onBack: () => void;
}

export function ProductManagement({ onBack }: ProductManagementProps) {
  const [products, setProducts] = useState<Producto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Formulario
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formName, setFormName] = useState('')
  const [formPrice, setFormPrice] = useState('')

  // Seguridad
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null)

  const fetchProducts = async () => {
    setIsLoading(true)
    try {
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke('get-products')
      // Validación segura para evitar crasheos (pantalla blanca)
      if (Array.isArray(res)) {
        setProducts(res)
      } else {
        setProducts([])
      }
    } catch (e) { 
      console.error(e) 
      setProducts([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchProducts() }, [])

  // --- MÉTODOS DEL FORMULARIO ---

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
    
    // Guardamos la acción que se ejecutará si el PIN es correcto
    const actionToExecute = async () => {
      const channel = editingId ? 'update-product' : 'create-product'
      const payload = editingId 
        ? { id: editingId, nombre: formName, precio: Number(formPrice) }
        : { nombre: formName, precio: Number(formPrice) }
      
      // @ts-ignore
      const res = await window.electron.ipcRenderer.invoke(channel, payload)
      
      if (res.success) {
        setIsEditing(false)
        await fetchProducts()
        alert('✅ Producto guardado correctamente en la base de datos.') // Feedback de éxito
      } else {
        alert('❌ Ocurrió un error al guardar: ' + res.error)
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
        await fetchProducts()
        alert(currentStatus ? '🔴 Producto Desactivado' : '🟢 Producto Activado')
      }
    }
    setPendingAction(() => action)
    setIsPinModalOpen(true)
  }

  const handlePinVerified = async (pin: string) => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('verify-pin', { pin })
    
    if (res.success && res.user.rol === 'admin') {
      setIsPinModalOpen(false)
      if (pendingAction) {
        await pendingAction() // Ejecutamos la inserción/actualización
      }
      setPendingAction(null)
    } else {
      alert('⛔ PIN Incorrecto o no cuentas con permisos de Administrador.')
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1a1a1a' }}>
      {/* HEADER */}
      <div style={{ padding: '15px 30px', display: 'flex', justifyContent: 'space-between', background: '#2d2d2d', alignItems: 'center', color: 'white', borderBottom: '1px solid #404040' }}>
        <button onClick={onBack} style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}>
          ← Volver
        </button>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#22c55e' }}>INVENTARIO DE PRODUCTOS</div>
        <div style={{ width: '60px' }}></div>
      </div>

      <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
        
        {/* BOTÓN CREAR */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <button 
            onClick={handleOpenCreate}
            style={{ 
              padding: '12px 25px', background: '#22c55e', color: 'white', 
              border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', 
              fontSize: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}
          >
            + Nuevo Producto
          </button>
        </div>

        {/* LISTA DE PRODUCTOS */}
        {isLoading ? (
          <div style={{ textAlign: 'center', color: 'white', marginTop: '50px' }}>Cargando productos...</div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '50px' }}>No hay productos registrados aún.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {products.map(prod => (
              <div key={prod.id} style={{ 
                background: '#2d2d2d', padding: '20px', borderRadius: '12px',
                display: 'flex', flexDirection: 'column', gap: '15px', 
                borderLeft: prod.active ? '5px solid #22c55e' : '5px solid #ef4444',
                color: 'white', opacity: prod.active ? 1 : 0.6
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{prod.nombre}</div>
                    <div style={{ fontSize: '0.85rem', color: prod.active ? '#22c55e' : '#ef4444', marginTop: '4px' }}>
                      {prod.active ? 'Activo' : 'Inactivo'}
                    </div>
                  </div>
                  <div style={{ color: '#f97316', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '1.3rem' }}>
                    ${Number(prod.precio).toFixed(2)}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                  <button 
                    onClick={() => handleOpenEdit(prod)}
                    style={{ flex: 1, padding: '8px', background: '#3b82f6', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Editar
                  </button>
                  <button 
                    onClick={() => handleToggleStatusRequest(prod.id, prod.active)}
                    style={{ 
                      flex: 1, padding: '8px', 
                      background: prod.active ? '#7f1d1d' : '#14532d', 
                      color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                    }}
                  >
                    {prod.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL FORMULARIO */}
      {isEditing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#2d2d2d', padding: '30px', borderRadius: '15px', width: '400px', color: 'white', border: '1px solid #404040' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.5rem', color: '#22c55e' }}>
              {editingId ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>Nombre del Producto</label>
              <input 
                value={formName} onChange={e => setFormName(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #404040', background: '#1a1a1a', color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                placeholder="Ej. Pizza Peperoni"
                autoFocus
              />
            </div>
            
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontWeight: 'bold', fontSize: '0.9rem' }}>Precio ($)</label>
              <input 
                type="number"
                value={formPrice} onChange={e => setFormPrice(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #404040', background: '#1a1a1a', color: 'white', fontSize: '1rem', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                placeholder="0.00"
              />
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button 
                onClick={() => setIsEditing(false)}
                style={{ flex: 1, padding: '12px', background: '#404040', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveClick}
                style={{ flex: 1, padding: '12px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
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