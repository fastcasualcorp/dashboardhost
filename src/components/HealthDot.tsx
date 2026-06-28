import { useEffect, useState } from 'react'
import { supabase, isCentral } from '../lib/supabase'

/* SEMÁFORO DE SALUD (solo cuentas CENTRAL/admin). Un puntito junto al reloj que mide la latencia REAL de la
   base de datos cada 30 s: verde (rápida) · ámbar (lenta) · rojo (caída/error). Así el propietario ve la
   salud del sistema de un vistazo, como ve la caja del día. Solo lectura, ligero. (idea de Juan, 28-jun) */

type Estado = 'ok' | 'slow' | 'down' | 'idle'
const LABEL: Record<Estado, string> = {
  ok: 'Base de datos: rápida',
  slow: 'Base de datos: lenta',
  down: 'Base de datos: sin respuesta',
  idle: 'Comprobando base de datos…',
}

export default function HealthDot() {
  const [estado, setEstado] = useState<Estado>('idle')
  const [ms, setMs] = useState<number | null>(null)

  useEffect(() => {
    if (!supabase || !isCentral()) return
    let alive = true
    const ping = async () => {
      const t0 = performance.now()
      try {
        // round-trip real a la BD (HEAD + count): mide latencia aunque la RLS no devuelva filas.
        const { error } = await supabase!.from('locales').select('id', { head: true, count: 'exact' }).limit(1)
        if (!alive) return
        const dt = Math.round(performance.now() - t0)
        setMs(dt)
        setEstado(error ? 'down' : dt < 350 ? 'ok' : dt < 1000 ? 'slow' : 'down')
      } catch {
        if (alive) { setEstado('down'); setMs(null) }
      }
    }
    void ping()
    const iv = window.setInterval(ping, 30_000)
    return () => { alive = false; window.clearInterval(iv) }
  }, [])

  if (!isCentral()) return null
  return (
    <span className={'health-dot only-wide health-' + estado} title={LABEL[estado] + (ms != null ? ` · ${ms} ms` : '')} aria-label={LABEL[estado]}>
      <span className="hd-led" />
    </span>
  )
}
