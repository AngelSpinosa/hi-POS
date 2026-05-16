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
    <div style={{ height: '100%', padding: '40px 60px', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '850px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0, color: 'white' }}>
            Gestión del personal
          </h2>
          {!isEditing && (
            <button 
              onClick={handleOpenCreate}
              style={{ padding: '12px 25px', background: '#0022ff', color: 'white', border: 'none', borderRadius: '30px', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              + Nuevo empleado
            </button>
          )}
        </div>

        {/* FORMULARIO DE CREACIÓN / EDICIÓN TIPO HOLLOW */}
        {isEditing && (
          <div style={{ marginBottom: '40px', padding: '35px', background: 'transparent', borderRadius: '20px', border: '1px solid #555' }}>
            <h3 style={{ marginTop: 0, marginBottom: '25px', fontSize: '1.4rem', color: 'white' }}>
              {editingId ? 'Editar empleado' : 'Registrar nuevo empleado'}
            </h3>
            
            <div style={{ display: 'flex', gap: '20px', marginBottom: '25px' }}>
              <div style={{ flex: 2 }}>
                <input 
                  type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="Nombre"
                  style={{ width: '100%', padding: '14px 20px', background: 'transparent', border: '1px solid #555', color: 'white', borderRadius: '30px', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '1rem', outline: 'none' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <input 
                  type="password" value={formPin} onChange={e => setFormPin(e.target.value.replace(/\D/g,''))}
                  maxLength={4}
                  placeholder="PIN"
                  style={{ width: '100%', padding: '14px 20px', background: 'transparent', border: '1px solid #555', color: 'white', borderRadius: '30px', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '1rem', outline: 'none', textAlign: 'center', letterSpacing: '3px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <select 
                  value={formRol} onChange={e => setFormRol(e.target.value)}
                  style={{ width: '100%', padding: '14px 20px', background: 'transparent', border: '1px solid #555', color: 'white', borderRadius: '30px', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '1rem', outline: 'none', appearance: 'none' }}
                >
                  <option value="cajero" style={{ background: '#111' }}>Cajero</option>
                  <option value="admin" style={{ background: '#111' }}>Administrador</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setIsEditing(false)}
                style={{ padding: '12px 30px', background: 'transparent', border: '1px solid #555', color: 'white', borderRadius: '30px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold', fontSize: '0.95rem' }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveClick}
                style={{ padding: '12px 30px', background: '#00E676', border: 'none', color: 'black', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit', fontSize: '0.95rem' }}
              >
                {editingId ? 'Guardar cambios' : 'Crear usuario'}
              </button>
            </div>
          </div>
        )}

        {/* LISTA DE USUARIOS (TARJETAS HOLLOW CON BORDES DE COLOR) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {users.map(user => {
            const isAdmin = user.rol === 'admin';
            const borderColor = !user.active ? '#555555' : (isAdmin ? '#FFFF00' : '#0022ff');

            return (
              <div key={user.id} style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                padding: '20px 30px', background: 'transparent', borderRadius: '30px',
                opacity: user.active ? 1 : 0.6,
                border: `2px solid ${borderColor}`,
                transition: 'all 0.2s ease'
              }}>
                <div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'white', marginBottom: '5px' }}>
                    {user.nombre}
                  </div>
                  <div style={{ color: 'white', fontSize: '0.9rem' }}>
                    Rol: {isAdmin ? 'Administrador' : 'Cajero'}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <button 
                    onClick={() => handleOpenEdit(user)}
                    style={{ padding: '8px 25px', background: '#00B4D8', border: 'none', color: 'black', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit', fontSize: '0.85rem' }}
                  >
                    Editar
                  </button>
                  
                  {user.id !== 1 && (
                    <button 
                      onClick={() => handleToggleStatus(user.id, user.active)}
                      style={{ 
                        padding: '8px 25px', 
                        background: user.active ? '#FF0000' : '#555555', 
                        border: 'none', color: 'white', borderRadius: '20px', cursor: 'pointer', minWidth: '100px', fontWeight: 'bold', fontFamily: 'inherit', fontSize: '0.85rem'
                      }}
                    >
                      {user.active ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

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