interface ComandaItem {
  cantidad: number;
  nombre: string;
}

interface ComandaReceiptProps {
  label: string;        // Ej. "Mesa 1", "Domicilio #0012", "Para llevar #0003"
  orderId?: number;
  items: ComandaItem[];
  onClose: () => void;
  onPrint: () => void;
}

export function ComandaReceipt({ label, orderId, items, onClose, onPrint }: ComandaReceiptProps) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace' }}>
      <div style={{ backgroundColor: '#f3f4f6', color: '#000', padding: '25px', width: '280px', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>

        <h3 style={{ textAlign: 'center', margin: '0 0 10px 0', fontSize: '1.2rem' }}>COCINA - {label}</h3>
        {orderId ? (
          <div style={{ textAlign: 'center', marginBottom: '10px', fontSize: '0.85rem' }}>
            Orden #{orderId}
          </div>
        ) : null}

        <div style={{ borderTop: '2px dashed #000', paddingTop: '10px', marginTop: '10px' }}>
          {items.map((item, idx) => (
            <div key={idx} style={{ fontSize: '1.15rem', margin: '12px 0', fontWeight: 'bold' }}>
              [&nbsp;&nbsp;] {item.cantidad} x {item.nombre}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: '#111', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
            Cerrar
          </button>
          <button onClick={onPrint} style={{ flex: 1, padding: '12px', background: '#00B4D8', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
            Imprimir
          </button>
        </div>

      </div>
    </div>
  )
}