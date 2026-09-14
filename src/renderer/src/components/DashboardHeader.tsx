import type { AppConfig } from '../types/db'
import { useClock } from '../hooks/useClock'

interface DashboardHeaderProps {
  appConfig?: AppConfig | null;
  licenseInfo?: { type: string; remainingDays?: number } | null;
}

export function DashboardHeader({ appConfig, licenseInfo }: DashboardHeaderProps) {
  const { formattedTime, formattedDate } = useClock()
  const displayBusinessName = appConfig?.business_name ? appConfig.business_name : 'NOMBRE DEL\nNEGOCIO'

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '20px 30px', borderBottom: '1px solid #333', backgroundColor: '#111',
      fontFamily: 'var(--font-heading, monospace)'
    }}>
      {/* Izquierda: logo (si existe) o nombre del negocio + pill de licencia demo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {appConfig?.logo_path ? (
          <img src={appConfig.logo_path} alt={appConfig.business_name || 'Logo'} style={{ height: '36px', objectFit: 'contain' }} />
        ) : (
          <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#f5eeda', whiteSpace: 'pre-line', lineHeight: 1.1 }}>
            {displayBusinessName}
          </h1>
        )}

        {licenseInfo?.type === 'DEMO' && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px', width: 'fit-content',
            background: '#dc2626', color: 'white', padding: '6px 14px', borderRadius: '20px',
            fontSize: '0.8rem', fontWeight: 'bold'
          }}>
            <span>⚠</span>
            Modo Demo, le quedan {licenseInfo.remainingDays} días de prueba
          </div>
        )}
      </div>

      {/* Derecha: hora y fecha */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>HORA : {formattedTime}</div>
        <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '2px' }}>{formattedDate}</div>
      </div>
    </div>
  )
}