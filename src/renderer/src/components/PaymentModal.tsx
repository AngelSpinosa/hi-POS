import { useState, useEffect, useRef } from 'react'
import type { CartItem } from '../types/db'

export interface PaymentData {
  method: 'efectivo' | 'tarjeta';
  received: number;
  amountToPay: number; 
}

interface PaymentModalProps {
  totalOriginal: number;
  totalRestante: number;
  cart: CartItem[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmPayment: (data: PaymentData) => void;
}

// Estructura para cada persona en "Cuentas Separadas"
interface SeparateAccount {
  id: number;
  items: { cartItemId: number; nombre: string; precio: number; qty: number }[];
  method: 'efectivo' | 'tarjeta';
  received: string;
  isPaid: boolean;
}

export function PaymentModal({ totalOriginal, totalRestante, cart, isOpen, onClose, onConfirmPayment }: PaymentModalProps) {
  // Estados Generales
  const [method, setMethod] = useState<'efectivo' | 'tarjeta'>('efectivo')
  const [received, setReceived] = useState<string>('')
  
  // Estados División
  const [splitDropdownOpen, setSplitDropdownOpen] = useState(false)
  const [splitMode, setSplitMode] = useState<'none' | 'equal' | 'separate'>('none')
  const [numPeople, setNumPeople] = useState<string>('')

  // Estados Cuentas Separadas (CU-33)
  const [separateAccounts, setSeparateAccounts] = useState<SeparateAccount[]>([])
  const [activePopover, setActivePopover] = useState<number | null>(null) // Controla qué menú de platillos está abierto

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 1. Inicialización y reset
  useEffect(() => {
    if (isOpen) {
      setReceived('')
      
      if (totalOriginal === totalRestante) {
        setMethod('efectivo')
        setSplitMode('none')
        setNumPeople('')
        // Iniciar con 2 personas por defecto si cambian a modo separado
        setSeparateAccounts([
          { id: 1, items: [], method: 'efectivo', received: '', isPaid: false },
          { id: 2, items: [], method: 'efectivo', received: '', isPaid: false }
        ])
      }
      
      setTimeout(() => { if (inputRef.current) inputRef.current.focus() }, 50)
    }
  }, [isOpen, totalRestante, totalOriginal])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSplitDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!isOpen) return null;

  // ==========================================
  // LÓGICA: PARTES IGUALES Y PAGO NORMAL
  // ==========================================
  const parsedPeople = parseInt(numPeople) || 1;
  let amountToPay = totalRestante;

  if (splitMode === 'equal' && parsedPeople > 1) {
    const porcionPorPersona = Number((totalOriginal / parsedPeople).toFixed(2));
    amountToPay = (totalRestante - porcionPorPersona < 0.1) ? totalRestante : porcionPorPersona;
  }

  const numericReceived = parseFloat(received) || 0;
  const change = method === 'efectivo' ? numericReceived - amountToPay : 0;

  const handleGlobalConfirm = () => {
    if (method === 'efectivo' && numericReceived < amountToPay) return;
    const finalReceived = method === 'efectivo' ? numericReceived : amountToPay;
    
    onConfirmPayment({ method, received: finalReceived, amountToPay });
  }

  // ==========================================
  // LÓGICA: CUENTAS SEPARADAS (CU-33)
  // ==========================================
  
  const handleAddPerson = () => {
    setSeparateAccounts(prev => [
      ...prev, 
      { id: prev.length + 1, items: [], method: 'efectivo', received: '', isPaid: false }
    ])
  }

  // Calcula cuántos platillos quedan sin asignar en toda la mesa
  const getAvailableItems = () => {
    return cart.map(cItem => {
      const totalAssigned = separateAccounts.reduce((sum, acc) => {
        const found = acc.items.find(i => i.cartItemId === cItem.id);
        return sum + (found ? found.qty : 0);
      }, 0);
      return { ...cItem, availableQty: cItem.cantidad - totalAssigned };
    }).filter(item => item.availableQty > 0);
  }

  const assignItemToAccount = (accId: number, cartItem: CartItem) => {
    setSeparateAccounts(prev => prev.map(acc => {
      if (acc.id === accId) {
        const existing = acc.items.find(i => i.cartItemId === cartItem.id);
        if (existing) {
          return { ...acc, items: acc.items.map(i => i.cartItemId === cartItem.id ? { ...i, qty: i.qty + 1 } : i) };
        } else {
          return { ...acc, items: [...acc.items, { cartItemId: cartItem.id, nombre: cartItem.nombre, precio: cartItem.precio, qty: 1 }] };
        }
      }
      return acc;
    }));
  }

  const removeItemFromAccount = (accId: number, cartItemId: number) => {
    setSeparateAccounts(prev => prev.map(acc => {
      if (acc.id === accId) {
        const existing = acc.items.find(i => i.cartItemId === cartItemId);
        if (existing && existing.qty > 1) {
          return { ...acc, items: acc.items.map(i => i.cartItemId === cartItemId ? { ...i, qty: i.qty - 1 } : i) };
        } else {
          return { ...acc, items: acc.items.filter(i => i.cartItemId !== cartItemId) };
        }
      }
      return acc;
    }));
  }

  const updateAccountInput = (accId: number, field: 'method' | 'received', value: any) => {
    setSeparateAccounts(prev => prev.map(acc => acc.id === accId ? { ...acc, [field]: value } : acc));
  }

  const handleColumnPay = (acc: SeparateAccount) => {
    const totalAcc = acc.items.reduce((sum, item) => sum + (item.precio * item.qty), 0);
    if (totalAcc === 0) return; // No hay nada que cobrar
    
    const numReceived = parseFloat(acc.received) || 0;
    if (acc.method === 'efectivo' && numReceived < totalAcc) return; // Faltan fondos

    // Disparamos el pago parcial (El modal no se cierra gracias a nuestro Hook)
    onConfirmPayment({
      method: acc.method,
      received: acc.method === 'efectivo' ? numReceived : totalAcc,
      amountToPay: totalAcc
    });

    // Marcamos localmente como pagado para bloquear la columna
    setSeparateAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, isPaid: true } : a));
  }

  return (
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', 
        display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 5000, fontFamily: 'var(--font-heading, monospace)'
      }} 
      onClick={(e) => { 
        if (e.target === e.currentTarget) onClose();
        if (activePopover !== null) setActivePopover(null); // Cerrar popover al dar clic fuera
      }}
    >
      <div 
        style={{
          backgroundColor: '#161616', padding: '35px 40px', borderRadius: '16px', 
          width: splitMode === 'separate' ? '90%' : '480px', maxWidth: '1000px', 
          border: '1px solid #333', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', 
          display: 'flex', flexDirection: 'column', gap: '20px', transition: 'width 0.3s ease', animation: 'fadeIn 0.2s ease-out'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: '0', color: 'white', fontSize: '1.8rem', fontWeight: 'bold' }}>
            Cobrar ${totalRestante.toFixed(2)}
          </h2>
          {totalRestante < totalOriginal && (
             <span style={{ background: '#3b82f6', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
               Pago Parcial
             </span>
          )}
        </div>
        
        {/* Controles Superiores */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxWidth: '400px' }}>
          <button onClick={() => { setMethod('efectivo'); inputRef.current?.focus(); }} style={btnStyle(method === 'efectivo')}>Efectivo</button>
          <button onClick={() => setMethod('tarjeta')} style={btnStyle(method === 'tarjeta')}>Tarjeta</button>
          
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button onClick={() => setSplitDropdownOpen(!splitDropdownOpen)} style={btnStyle(splitMode !== 'none', true)}>
              {splitMode === 'equal' ? 'Partes iguales' : splitMode === 'separate' ? 'Cuentas separadas' : 'Dividir cuenta'} ▼
            </button>
            {splitDropdownOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 5px)', left: 0, width: '100%',
                background: '#1a1a1a', border: '1px solid #444', borderRadius: '8px', zIndex: 10, overflow: 'hidden'
              }}>
                <div className="dropdown-item" onClick={() => { setSplitMode('equal'); setSplitDropdownOpen(false); }}>Partes iguales</div>
                <div className="dropdown-item" onClick={() => { setSplitMode('separate'); setSplitDropdownOpen(false); }}>Cuentas separadas</div>
                {splitMode !== 'none' && (
                   <div className="dropdown-item" style={{ borderTop: '1px solid #333', color: '#ef4444' }} onClick={() => { setSplitMode('none'); setNumPeople(''); setSplitDropdownOpen(false); }}>Cancelar división</div>
                )}
              </div>
            )}
          </div>
          <button style={btnStyle(false, true)}>Descuentos ▼</button>
        </div>

        {/* ========================================== */}
        {/* UI CUENTAS SEPARADAS */}
        {/* ========================================== */}
        {splitMode === 'separate' && (
          <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px', minHeight: '350px' }}>
            {separateAccounts.map((acc, index) => {
              const totalAcc = acc.items.reduce((sum, item) => sum + (item.precio * item.qty), 0);
              const numReceived = parseFloat(acc.received) || 0;
              const changeAcc = acc.method === 'efectivo' ? numReceived - totalAcc : 0;
              
              return (
                <div key={acc.id} style={{ 
                  minWidth: '260px', border: '1px solid #444', borderRadius: '12px', padding: '20px', 
                  display: 'flex', flexDirection: 'column', position: 'relative',
                  background: acc.isPaid ? '#0a1910' : 'transparent', 
                  opacity: acc.isPaid ? 0.7 : 1, transition: 'all 0.3s'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px dashed #444', paddingBottom: '10px' }}>
                    <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem' }}>
                      Persona {index + 1} {acc.isPaid && '✅'}
                    </h3>
                    
                    {/* Botón Platillo+ y Popover */}
                    {!acc.isPaid && (
                      <div style={{ position: 'relative' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActivePopover(activePopover === acc.id ? null : acc.id); }}
                          style={{ background: '#00E676', color: 'black', border: 'none', borderRadius: '6px', padding: '4px 8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          Platillo +
                        </button>

                        {activePopover === acc.id && (
                          <div style={{
                            position: 'absolute', top: '100%', right: 0, marginTop: '5px', width: '220px',
                            background: '#222', border: '1px solid #444', borderRadius: '8px', zIndex: 100,
                            boxShadow: '0 10px 25px rgba(0,0,0,0.8)', overflow: 'hidden'
                          }}>
                            {getAvailableItems().length === 0 ? (
                              <div style={{ padding: '10px', color: '#9ca3af', fontSize: '0.8rem', textAlign: 'center' }}>No hay platillos disponibles</div>
                            ) : (
                              getAvailableItems().map(item => (
                                <div 
                                  key={item.id} 
                                  onClick={() => assignItemToAccount(acc.id, item)}
                                  className="dropdown-item" 
                                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}
                                >
                                  <span>{item.nombre}</span>
                                  <span style={{ color: '#00E676' }}>x{item.availableQty}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Lista de productos de la persona */}
                  <div style={{ flex: 1, overflowY: 'auto', marginBottom: '15px' }}>
                    {acc.items.length === 0 && <p style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', margin: '20px 0' }}>Sin productos asignados</p>}
                    {acc.items.map(item => (
                      <div key={item.cartItemId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#d1d5db', fontSize: '0.9rem', marginBottom: '8px' }}>
                        <span>{item.qty}x {item.nombre}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>${(item.precio * item.qty).toFixed(2)}</span>
                          {!acc.isPaid && (
                            <button onClick={() => removeItemFromAccount(acc.id, item.cartItemId)} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0 5px' }}>×</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Controles de Pago de la Columna */}
                  <div style={{ marginTop: 'auto', borderTop: '1px solid #333', paddingTop: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', color: 'white', marginBottom: '10px' }}>
                      <span>Total:</span>
                      <span>${totalAcc.toFixed(2)}</span>
                    </div>

                    {!acc.isPaid && totalAcc > 0 && (
                      <>
                        <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', marginBottom: '10px', border: '1px solid #444' }}>
                          <button onClick={() => updateAccountInput(acc.id, 'method', 'efectivo')} style={{ flex: 1, padding: '6px', background: acc.method === 'efectivo' ? '#333' : 'transparent', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>Efect</button>
                          <button onClick={() => updateAccountInput(acc.id, 'method', 'tarjeta')} style={{ flex: 1, padding: '6px', background: acc.method === 'tarjeta' ? '#333' : 'transparent', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>Tarj</button>
                        </div>
                        
                        {acc.method === 'efectivo' && (
                          <div style={{ marginBottom: '10px' }}>
                            <input 
                              type="number" placeholder="Monto" value={acc.received}
                              onChange={(e) => updateAccountInput(acc.id, 'received', e.target.value)}
                              style={{ width: '100%', padding: '8px', background: '#111', border: '1px solid #555', color: 'white', borderRadius: '6px', boxSizing: 'border-box', outline: 'none' }}
                            />
                            {changeAcc > 0 && <div style={{ color: '#eab308', fontSize: '0.8rem', marginTop: '4px', textAlign: 'right' }}>Cambio: ${changeAcc.toFixed(2)}</div>}
                          </div>
                        )}

                        <button 
                          onClick={() => handleColumnPay(acc)}
                          disabled={acc.method === 'efectivo' && numReceived < totalAcc}
                          style={{ 
                            width: '100%', padding: '10px', background: '#00E676', color: 'black', border: 'none', borderRadius: '6px', 
                            fontWeight: 'bold', cursor: (acc.method === 'efectivo' && numReceived < totalAcc) ? 'not-allowed' : 'pointer',
                            opacity: (acc.method === 'efectivo' && numReceived < totalAcc) ? 0.5 : 1
                          }}
                        >
                          Pagar Cuenta
                        </button>
                      </>
                    )}

                    {acc.isPaid && (
                      <div style={{ textAlign: 'center', color: '#00E676', fontWeight: 'bold', padding: '10px', background: '#00e67622', borderRadius: '6px' }}>
                        PAGADO ({acc.method})
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            
            {/* Botón para añadir persona */}
            <div style={{ minWidth: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <button 
                 onClick={handleAddPerson}
                 style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#333', color: 'white', border: '2px dashed #666', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
               >+</button>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* UI ESTÁNDAR (Partes Iguales / Completo) */}
        {/* ========================================== */}
        {splitMode !== 'separate' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', minHeight: '140px' }}>
            {splitMode === 'equal' && (
              <div style={{ animation: 'fadeIn 0.2s' }}>
                <label style={{ color: '#d1d5db', fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>Num. Personas (del total original)</label>
                <input type="number" min="2" value={numPeople} onChange={(e) => setNumPeople(e.target.value)} style={inputStyle} />
                <div style={{ color: '#eab308', fontWeight: 'bold', marginTop: '10px', fontSize: '1.1rem' }}>
                  ${amountToPay.toFixed(2)} Por persona
                </div>
              </div>
            )}

            {method === 'efectivo' ? (
              <div style={{ animation: 'fadeIn 0.2s' }}>
                <label style={{ color: '#d1d5db', fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>Monto recibido</label>
                <input ref={inputRef} type="number" min="0" value={received} onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') { setReceived(''); return; }
                  const parsed = parseFloat(val);
                  if (!isNaN(parsed) && parsed >= 0) setReceived(val);
                }} style={inputStyle} />
                <div style={{ marginTop: '10px', fontSize: '1.1rem', fontWeight: 'bold', color: change >= 0 ? '#eab308' : '#ef4444' }}>
                  Cambio: ${change >= 0 ? change.toFixed(2) : '0.00'}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: '#9ca3af', textAlign: 'center', margin: 0, fontSize: '0.95rem' }}>
                  Procesa el cobro por <b>${amountToPay.toFixed(2)}</b> en la terminal bancaria y confirma.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Botones de Acción (Ocultar Confirmar global si estamos en Cuentas Separadas) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
          <button onClick={onClose} style={actionBtnStyle('white', 'black')}>Cancelar</button>
          
          {splitMode !== 'separate' && (
            <button 
              onClick={handleGlobalConfirm}
              disabled={method === 'efectivo' && numericReceived < amountToPay}
              style={{
                ...actionBtnStyle('#00E676', 'black'),
                opacity: (method === 'efectivo' && numericReceived < amountToPay) ? 0.5 : 1,
                cursor: (method === 'efectivo' && numericReceived < amountToPay) ? 'not-allowed' : 'pointer'
              }}
            >
              Confirmar
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .dropdown-item { padding: 12px 15px; color: white; cursor: pointer; transition: background 0.2s; font-size: 0.95rem; }
        .dropdown-item:hover { background: #333; }
        ::-webkit-scrollbar { height: 8px; }
        ::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
      `}</style>
    </div>
  )
}

const btnStyle = (isActive: boolean, isSecondary: boolean = false) => ({
  padding: '12px', background: isActive ? '#333' : 'transparent', color: 'white', 
  border: '1px solid #555', borderRadius: '6px', cursor: 'pointer', fontSize: '0.95rem', 
  fontWeight: isActive ? 'bold' : 'normal', fontFamily: 'inherit', transition: 'all 0.2s'
} as React.CSSProperties);

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 15px', fontSize: '1.2rem', background: 'transparent', 
  border: '1px solid #555', color: 'white', borderRadius: '6px', boxSizing: 'border-box',
  outline: 'none', fontFamily: 'inherit'
};

const actionBtnStyle = (bg: string, color: string): React.CSSProperties => ({
  width: '140px', padding: '12px', background: bg, border: 'none', 
  borderRadius: '8px', color: color, fontWeight: 'bold', fontFamily: 'inherit', fontSize: '1rem'
});