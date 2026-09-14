import { useClock } from '../hooks/useClock'

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  backLabel?: string; // Por defecto "Menú principal", pero se puede sobreescribir (ej. "Volver a Pedidos")
}

export function ScreenHeader({ title, onBack, backLabel = 'Menú principal' }: ScreenHeaderProps) {
  const { formattedTime, formattedDate } = useClock()

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '20px 30px', borderBottom: '1px solid #333', backgroundColor: '#111',
      fontFamily: 'var(--font-heading, monospace)'
    }}>
      <button
        onClick={onBack}
        style={{ background: 'transparent', color: '#d1d5db', border: 'none', cursor: 'pointer', fontSize: '1.05rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', padding: 0, fontFamily: 'inherit' }}
      >
        <span>←</span> {backLabel}
      </button>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white', letterSpacing: '0.05em' }}>{title.toUpperCase()}</div>
        <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'white', marginTop: '2px' }}>HORA : {formattedTime}</div>
        <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '2px' }}>{formattedDate}</div>
      </div>
    </div>
  )
}