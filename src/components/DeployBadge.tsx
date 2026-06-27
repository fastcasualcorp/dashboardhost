import { useEffect, useState } from 'react'

/* Badge "● en vivo · hace X min": lee el sello de versión que Vite inyecta en build
   (__BUILD_TIME__ = momento de compilación, __BUILD_SHA__ = commit desplegado). Como el
   deploy es automático en cada push, esto dice SIEMPRE qué versión hay publicada. (Juan 27-jun) */

const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 0
const BUILD_SHA = typeof __BUILD_SHA__ !== 'undefined' ? __BUILD_SHA__ : 'dev'

function desde(ms: number): string {
  if (!ms) return 'local'
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (s < 60) return 'ahora'
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} d`
}

export default function DeployBadge() {
  const [, tick] = useState(0)
  // refresca el "hace X" cada 30 s sin recargar
  useEffect(() => {
    const iv = window.setInterval(() => tick((n) => n + 1), 30_000)
    return () => window.clearInterval(iv)
  }, [])
  const fecha = BUILD_TIME ? new Date(BUILD_TIME).toLocaleString('es-ES') : ''
  return (
    <div className="deploy-badge" title={`Versión ${BUILD_SHA}${fecha ? ' · ' + fecha : ''}`}>
      <span className="db-dot" aria-hidden />
      <span className="db-txt">en vivo · {desde(BUILD_TIME)}</span>
      <span className="db-sha tnum">{BUILD_SHA}</span>
    </div>
  )
}
