import { useState, useEffect } from 'react'
import type { User } from '../types/db'

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  
  // Estado para formulario de nuevo usuario
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPin, setNewPin] = useState('')

  // Cargar usuarios
  const fetchUsers = async () => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('get-users')
    if (Array.isArray(res)) {
      setUsers(res)
    } else {
      console.error('Error fetching users')
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Crear Usuario
  const handleCreateUser = async () => {
    if (!newName.trim() || newPin.length < 4) {
      alert('Nombre requerido y PIN de mínimo 4 dígitos')
      return
    }

    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('create-user', { 
      nombre: newName, 
      pin: newPin 
    })

    if (res.success) {
      setIsCreating(false)
      setNewName('')
      setNewPin('')
      fetchUsers()
    } else {
      alert('Error: ' + res.error)
    }
  }

  // Activar/Desactivar
  const handleToggleStatus = async (userId: number, currentStatus: number) => {
    // @ts-ignore
    const res = await window.electron.ipcRenderer.invoke('toggle-user-status', { 
      userId, 
      active: currentStatus === 1 ? 0 : 1 
    })

    if (res.success) {
      fetchUsers()
    } else {
      alert('Error: ' + res.error)
    }
  }

  return (
    <div style={{ padding: '20px', color: 'white', height: '100%', overflowY: 'auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ margin: 0 }}>Gestión de Personal 👥</h1>
        <button 
          onClick={() => setIsCreating(true)}
          style={{ padding: '10px 20px', background: '#2563eb', border: 'none', color: 'white', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          + Nuevo Empleado
        </button>
      </div>

      {/* FORMULARIO DE CREACIÓN (MODAL EN LINEA) */}
      {isCreating && (
        <div style={{ marginBottom: '30px', padding: '20px', background: '#2d2d2d', borderRadius: '10px', border: '1px solid #404040' }}>
          <h3 style={{ marginTop: 0 }}>Registrar Nuevo Empleado</h3>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', color: '#9ca3af', marginBottom: '5px' }}>Nombre Completo</label>
              <input 
                type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Ej. Juan Pérez"
                style={{ width: '100%', padding: '10px', background: '#1a1a1a', border: '1px solid #404040', color: 'white', borderRadius: '5px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: '#9ca3af', marginBottom: '5px' }}>PIN de Acceso</label>
              <input 
                type="text" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,''))} // Solo números
                placeholder="4 dígitos" maxLength={4}
                style={{ width: '100%', padding: '10px', background: '#1a1a1a', border: '1px solid #404040', color: 'white', borderRadius: '5px' }}
              />
            </div>
            <button 
              onClick={handleCreateUser}
              style={{ padding: '10px 20px', background: '#22c55e', border: 'none', color: 'white', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Guardar
            </button>
            <button 
              onClick={() => setIsCreating(false)}
              style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #666', color: '#ccc', borderRadius: '5px', cursor: 'pointer' }}
            >
              Cancelar
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
            opacity: user.active ? 1 : 0.5,
            borderLeft: user.active ? '4px solid #22c55e' : '4px solid #666'
          }}>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{user.nombre}</div>
              <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                Rol: <span style={{ textTransform: 'capitalize' }}>{user.rol}</span> • 
                PIN: ••••
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {user.active === 0 && <span style={{ color: '#ef4444', marginRight: '10px', fontWeight: 'bold' }}>INACTIVO</span>}
              
              {user.id !== 1 ? (
                <button 
                  onClick={() => handleToggleStatus(user.id, user.active)}
                  style={{ 
                    padding: '8px 15px', 
                    background: user.active ? '#ef4444' : '#22c55e', 
                    border: 'none', color: 'white', borderRadius: '5px', cursor: 'pointer' 
                  }}
                >
                  {user.active ? 'Desactivar' : 'Activar'}
                </button>
              ) : (
                <span style={{ color: '#fbbf24', fontSize: '0.8rem', fontStyle: 'italic' }}>Super Admin</span>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}