import { useEffect, useState } from 'react'
import type { ShippingData } from '../hooks/useDeliveryOrder'

interface CanalDelivery {
  id: number;
  nombre: string;
}

interface ShippingInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: ShippingData) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  background: '#1a1a1a',
  border: '1px solid #444',
  borderRadius: '8px',
  color: 'white',
  fontSize: '1rem',
  marginBottom: '15px',
  fontFamily: 'inherit'
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.9rem',
  marginBottom: '6px',
  color: '#ccc'
}

export function ShippingInfoModal({ isOpen, onClose, onConfirm }: ShippingInfoModalProps) {
  const [canales, setCanales] = useState<CanalDelivery[]>([])
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [direccionEnvio, setDireccionEnvio] = useState('')
  const [canalDeliveryId, setCanalDeliveryId] = useState('')
  const [costoEnvio, setCostoEnvio] = useState('0')

  useEffect(() => {
    if (!isOpen) return
    // @ts-ignore
    window.electron.ipcRenderer.invoke('get-canales-delivery').then((res: any) => {
      if (Array.isArray(res)) setCanales(res)
    })
  }, [isOpen])

  const resetForm = () => {
    setClienteNombre('')
    setClienteTelefono('')
    setDireccionEnvio('')
    setCanalDeliveryId('')
    setCostoEnvio('0')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleConfirm = () => {
    if (!clienteNombre.trim()) { alert('⚠️ Ingresa el nombre del cliente'); return; }
    if (!direccionEnvio.trim()) { alert('⚠️ Ingresa la dirección de envío'); return; }
    if (!canalDeliveryId) { alert('⚠️ Selecciona el canal de delivery'); return; }

    onConfirm({
      clienteNombre: clienteNombre.trim(),
      clienteTelefono: clienteTelefono.trim(),
      direccionEnvio: direccionEnvio.trim(),
      canalDeliveryId: Number(canalDeliveryId),
      costoEnvio: Number(costoEnvio) || 0
    })
    resetForm()
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 5000, display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace' }}>
      <div style={{ backgroundColor: '#111', color: 'white', padding: '30px', width: '380px', borderRadius: '12px', border: '1px solid #333' }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 20px 0' }}>Datos de envío</h2>

        <label style={labelStyle}>Nombre del cliente</label>
        <input style={inputStyle} value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} placeholder="Ej. Juan Pérez" />

        <label style={labelStyle}>Teléfono</label>
        <input style={inputStyle} value={clienteTelefono} onChange={e => setClienteTelefono(e.target.value)} placeholder="Ej. 2281234567" />

        <label style={labelStyle}>Dirección de envío</label>
        <textarea
          style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }}
          value={direccionEnvio}
          onChange={e => setDireccionEnvio(e.target.value)}
          placeholder="Calle, número, colonia, referencias..."
        />

        <label style={labelStyle}>Canal de delivery</label>
        <select style={inputStyle} value={canalDeliveryId} onChange={e => setCanalDeliveryId(e.target.value)}>
          <option value="">Selecciona una plataforma</option>
          {canales.map(c => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>

        <label style={labelStyle}>Costo de envío ($)</label>
        <input
          type="number"
          min="0"
          style={inputStyle}
          value={costoEnvio}
          onChange={e => setCostoEnvio(e.target.value)}
        />

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button onClick={handleClose} style={{ flex: 1, padding: '12px', background: '#333', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleConfirm} style={{ flex: 1, padding: '12px', background: '#00E676', color: 'black', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}