import { useState, useEffect } from 'react'

// Reloj compartido: antes cada pantalla que necesitaba fecha/hora (solo el
// Dashboard) reimplementaba su propio setInterval. Ahora los dos headers
// (DashboardHeader y ScreenHeader) lo usan sin duplicar código.
export function useClock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formattedTime = time.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  const formattedDate = time.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return { formattedTime, formattedDate }
}