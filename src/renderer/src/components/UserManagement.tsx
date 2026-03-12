import { useState, useEffect } from 'react'
import type { User } from '../types/db'
import { PinPadModal } from './PinPadModal'

interface UserManagementProps {
  onBack: () => void; // <-- 1. Asegúrate de tener esto declarado
}

export function UserManagement({ onBack }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([])
  
  // Estado del formulario (Crear/Editar)
  const [isEditing, setIsEditing] = useState(false) // false = cerrado, true = modo edición
  const [editingId, setEditingId] = useState<number | null>(null) // ID del usuario a editar
  const [formName, setFormName] = useState('')
  const [formPin, setFormPin] = useState('')
  const [formRol, setFormRol] = useState('cajero') // Por defecto

  // Estado para la confirmación de seguridad
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  // CORRECCIÓN 1: Tipado correcto para guardar una función asíncrona o null
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null)

  // Cargar usuarios
  const fetchUsers = async () => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('get-users')
    if (Array.isArray(res)) setUsers(res)
  }

  useEffect(() => { fetchUsers() }, [])

  // --- LÓGICA DE FORMULARIO ---

  const handleOpenCreate = () => {
    setEditingId(null) // null = creando nuevo
    setFormName('')
    setFormPin('')
    setFormRol('cajero')
    setIsEditing(true)
  }

  const handleOpenEdit = (user: User) => {
    setEditingId(user.id) // ID = editando existente
    setFormName(user.nombre)
    setFormPin(user.pin)
    setFormRol(user.rol)
    setIsEditing(true)
  }

  const handleSaveClick = () => {
    if (!formName.trim() || formPin.length < 4) {
      alert('Nombre requerido y PIN de mínimo 4 dígitos')
      return
    }

    if (editingId) {
      // Si es EDICIÓN, pedimos PIN de Admin para confirmar
      // CORRECCIÓN 2: Envolvemos la función para que React la guarde y no la ejecute
      setPendingAction(() => executeUpdate) 
      setIsPinModalOpen(true)
    } else {
      // Si es CREACIÓN, guardamos directo
      executeCreate()
    }
  }

  const executeCreate = async () => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('create-user', { 
      nombre: formName, pin: formPin 
    })
    if (res.success) {
      setIsEditing(false)
      fetchUsers()
    } else { alert('Error: ' + res.error) }
  }

  const executeUpdate = async () => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('update-user', { 
      userId: editingId,
      nombre: formName, 
      pin: formPin,
      rol: formRol
    })
    if (res.success) {
      setIsEditing(false)
      fetchUsers()
    } else { alert('Error: ' + res.error) }
  }

  // Verificación de PIN de Admin para guardar cambios
  const handlePinVerify = async (pin: string) => {
    // @ts-ignore
    const result = await window.electron.ipcRenderer.invoke('verify-pin', { pin })
    
    if (result.success && result.user.rol === 'admin') {
      setIsPinModalOpen(false)
      if (pendingAction) {
        await pendingAction() // Ejecutamos la acción guardada
        setPendingAction(null) // Limpiamos
      }
    } else {
      alert('Se requiere PIN de Administrador para guardar cambios.')
    }
  }

  // Activar/Desactivar
  const handleToggleStatus = async (userId: number, currentStatus: number) => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('toggle-user-status', { 
      userId, active: currentStatus === 1 ? 0 : 1 
    })
    if (res.success) fetchUsers()
    else alert('Error: ' + res.error)
  }

  return (
    <div style={{ padding: '20px', color: 'white', height: '100%', overflowY: 'auto' }}>
      
      <div style={{ padding: '15px 30px', display: 'flex', justifyContent: 'space-between', background: '#2d2d2d', alignItems: 'center', color: 'white', borderBottom: '1px solid #404040' }}>
        <button onClick={onBack} style={{ background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}>
          ← Volver al Menú
        </button>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#a855f7' }}>GESTIÓN DE PERSONAL 👥</div>
        <div style={{ width: '130px' }}></div> {/* Espaciador para centrar el título */}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ margin: 0 }}>Gestión de Personal 👥</h1>
        {!isEditing && (
          <button 
            onClick={handleOpenCreate}
            style={{ padding: '10px 20px', background: '#2563eb', border: 'none', color: 'white', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + Nuevo Empleado
          </button>
        )}
      </div>

      {/* FORMULARIO DE CREACIÓN / EDICIÓN */}
      {isEditing && (
        <div style={{ marginBottom: '30px', padding: '20px', background: '#2d2d2d', borderRadius: '10px', border: '1px solid #3b82f6', boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)' }}>
          <h3 style={{ marginTop: 0, color: '#3b82f6' }}>
            {editingId ? 'Editar Empleado' : 'Registrar Nuevo Empleado'}
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div>
              <label style={{ display: 'block', color: '#9ca3af', marginBottom: '5px' }}>Nombre Completo</label>
              <input 
                type="text" value={formName} onChange={e => setFormName(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#1a1a1a', border: '1px solid #404040', color: 'white', borderRadius: '5px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#9ca3af', marginBottom: '5px' }}>PIN de Acceso</label>
              <input 
                type="text" value={formPin} onChange={e => setFormPin(e.target.value.replace(/\D/g,''))}
                maxLength={4}
                style={{ width: '100%', padding: '10px', background: '#1a1a1a', border: '1px solid #404040', color: 'white', borderRadius: '5px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#9ca3af', marginBottom: '5px' }}>Rol</label>
              <select 
                value={formRol} onChange={e => setFormRol(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#1a1a1a', border: '1px solid #404040', color: 'white', borderRadius: '5px' }}
              >
                <option value="cajero">Cajero</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button 
              onClick={() => setIsEditing(false)}
              style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #666', color: '#ccc', borderRadius: '5px', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button 
              onClick={handleSaveClick}
              style={{ padding: '10px 20px', background: '#22c55e', border: 'none', color: 'white', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {editingId ? 'Guardar Cambios' : 'Crear Usuario'}
            </button>
          </div>
        </div>
      )}

      {/* LISTA DE USUARIOS */}
      <div style={{ display: 'grid', gap: '15px' }}>
        {users.map(user => (
          <div key={user.id} style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: '20px', background: '#2d2d2d', borderRadius: '10px',
            opacity: user.active ? 1 : 0.6,
            borderLeft: user.active ? (user.rol === 'admin' ? '4px solid #fbbf24' : '4px solid #22c55e') : '4px solid #666'
          }}>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {user.nombre}
                {user.rol === 'admin' && <span style={{ fontSize: '0.7rem', background: '#fbbf24', color: 'black', padding: '2px 6px', borderRadius: '4px' }}>ADMIN</span>}
              </div>
              <div style={{ color: '#9ca3af', fontSize: '0.9rem', marginTop: '5px' }}>
                PIN: ••••
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button 
                onClick={() => handleOpenEdit(user)}
                style={{ padding: '8px 15px', background: '#3b82f6', border: 'none', color: 'white', borderRadius: '5px', cursor: 'pointer' }}
              >
                Editar
              </button>
              
              {user.id !== 1 && (
                <button 
                  onClick={() => handleToggleStatus(user.id, user.active)}
                  style={{ 
                    padding: '8px 15px', 
                    background: user.active ? '#ef4444' : '#10b981', 
                    border: 'none', color: 'white', borderRadius: '5px', cursor: 'pointer', minWidth: '90px'
                  }}
                >
                  {user.active ? 'Desactivar' : 'Activar'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL DE SEGURIDAD PARA CONFIRMAR EDICIÓN */}
      <PinPadModal 
        title="Autorización de Admin Requerida 🛡️"
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onVerify={handlePinVerify}
      />

    </div>
  )
}