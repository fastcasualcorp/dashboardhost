import { motion } from 'motion/react'
import { reduceMotion } from '../lib/data'

/* Medidor de combustible (idea de Juan, 27-jun): un % se siente como una aguja de coche.
   Zonas de color (verde sano / ámbar ajustado / rojo alto) + aguja con SPRING que se mueve
   cada vez que cambia el dato (p.ej. al tocar un turno y subir el coste). Sombra neutra,
   respeta reduced-motion. Reutilizable para cualquier ratio con umbrales. */

export type GaugeZone = { to: number; color: string }
const R = 84
const CX = 100
const CY = 100

// punto del arco para una fracción 0..1 (izquierda → derecha, semicírculo superior)
function pt(frac: number): [number, number] {
  const th = ((180 - frac * 180) * Math.PI) / 180
  return [CX + R * Math.cos(th), CY - R * Math.sin(th)]
}
// arco por MUESTREO de puntos (a prueba de los flags de <path A>: siempre el semicírculo de arriba)
function arcPath(f0: number, f1: number) {
  const steps = Math.max(2, Math.round((f1 - f0) * 60))
  let dd = ''
  for (let i = 0; i <= steps; i++) {
    const f = f0 + (f1 - f0) * (i / steps)
    const [x, y] = pt(f)
    dd += (i ? 'L' : 'M') + ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' '
  }
  return dd.trim()
}

export default function FuelGauge({
  value,
  max = 100,
  zones,
  label = '',
  status,
}: {
  value: number
  max?: number
  zones: GaugeZone[]
  label?: string
  status?: { text: string; color: string }
}) {
  const frac = Math.max(0, Math.min(1, value / max))
  const deg = frac * 180 - 90 // -90 izq · 0 arriba · +90 der
  const rm = reduceMotion()

  let prev = 0
  const segs = zones.map((z) => {
    const a = prev / max
    const b = Math.min(z.to, max) / max
    prev = z.to
    return { a, b, color: z.color }
  })

  return (
    <div className="fg">
      <svg viewBox="0 0 200 110" className="fg-svg" role="img" aria-label={`${Math.round(value)}% ${label}`}>
        <path d={arcPath(0, 1)} className="fg-track" />
        {segs.map((s, i) => (
          <path key={i} d={arcPath(s.a, s.b)} stroke={s.color} className="fg-zone" />
        ))}
        {/* arco de VALOR encendido (0 → valor) en el color de la zona, con glow tipo cuentakm moderno */}
        <path d={arcPath(0, Math.max(0.001, frac))} stroke={status?.color || 'var(--gold)'} className="fg-value-arc" style={{ ['--gc' as string]: status?.color || 'var(--gold)' }} />
        <motion.g
          style={{ transformBox: 'view-box', transformOrigin: '100px 100px', ['--gc' as string]: status?.color || 'var(--gold)' }}
          initial={{ rotate: deg }}
          animate={{ rotate: deg }}
          transition={rm ? { duration: 0 } : { type: 'spring', stiffness: 80, damping: 11, mass: 0.9 }}
        >
          <line x1="100" y1="100" x2="100" y2="24" className="fg-needle" />
          <circle cx="100" cy="24" r="3.4" className="fg-needle-tip" />
          <circle cx="100" cy="100" r="8" className="fg-hub" />
          <circle cx="100" cy="100" r="3" className="fg-hub-dot" />
        </motion.g>
      </svg>
      <div className="fg-read">
        <b className="fg-val tnum">
          {Math.round(value)}
          <i>%</i>
        </b>
        {label && <span className="fg-lbl">{label}</span>}
        {status && (
          <span className="fg-status" style={{ color: status.color }}>
            {status.text}
          </span>
        )}
      </div>
    </div>
  )
}
