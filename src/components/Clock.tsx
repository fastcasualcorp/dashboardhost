import { useEffect, useState } from 'react'

/* Reloj de la cabecera AISLADO (perf · auditoría 28-jun). Antes el `now` vivía en Shell y su tick
   re-renderizaba TODA la app + la sección activa cada 30 s. Ahora el tick vive aquí → solo se repinta
   este componente diminuto, no el dashboard entero. */

const _DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const _MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtReloj = (d: Date) =>
  `${_DOW[d.getDay()]} ${d.getDate()} ${_MES[d.getMonth()]} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export default function Clock() {
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const iv = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(iv)
  }, [])
  return (
    <span className="daypill only-wide">
      <span className="dot" />
      {fmtReloj(now)}
    </span>
  )
}
