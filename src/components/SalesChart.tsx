import { useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { SALES, salesMedian, eur, eur0, reduceMotion, SALES_RANGE, useRealAgg } from '../lib/data'

type Pt = { x: number; y: number }

/* catmull-rom → curva bézier suave */
function smooth(p: Pt[]): string {
  if (p.length < 2) return p.length ? `M ${p[0].x} ${p[0].y}` : ''
  let d = `M ${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i],
      p1 = p[i],
      p2 = p[i + 1],
      p3 = p[i + 2] || p2
    const c1x = p1.x + (p2.x - p0.x) / 6,
      c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6,
      c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

const H = 240
const PAD_X = 12
const TOP = 20
const BOTTOM = 26 // banda de la línea; el área baja hasta H (base del "monte")
const GRID = 3 // líneas de referencia horizontales

export default function SalesChart() {
  useRealAgg() // en REAL repinta con las ventas reales (RPC) cuando aterrizan; en DEMO no hace nada
  const areaRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(e.contentRect.width)
    })
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const values = SALES.map((s) => s.value)
  const hasData = values.some((v) => v > 0) // sin ventas → estado vacío limpio (no la línea con degradado fea). Juan
  const vmax = Math.max(...values)
  const vmin = Math.min(...values)
  const span = vmax - vmin || 1
  const yOf = (v: number) => TOP + (1 - (v - vmin) / span) * (H - TOP - BOTTOM)
  const xOf = (i: number) => PAD_X + (i * (w - 2 * PAD_X)) / (SALES.length - 1)

  const pts: Pt[] = SALES.map((s, i) => ({ x: xOf(i), y: yOf(s.value) }))
  const line = w ? smooth(pts) : ''
  const area = w ? `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z` : ''
  const last = pts[pts.length - 1]
  // niveles de la rejilla (para leer los importes de un vistazo)
  const gridYs = Array.from({ length: GRID }, (_, k) => TOP + ((k + 1) * (H - TOP - BOTTOM)) / (GRID + 1))

  useGSAP(
    () => {
      if (!w || !hasData) return
      const lineEl = areaRef.current?.querySelector('.dc-line') as SVGPathElement | null
      if (!lineEl) return
      if (reduceMotion()) {
        gsap.set('.dc-area', { opacity: 1 })
        gsap.set('.dc-dot, .dc-dot-ring, .dc-dot-ring2', { scale: 1 })
        gsap.set('.dc-dot-pulse', { opacity: 0 })
        return
      }
      const len = lineEl.getTotalLength ? lineEl.getTotalLength() : 500
      gsap.set('.dc-line', { strokeDasharray: len, strokeDashoffset: len })
      gsap.set('.dc-area', { opacity: 0 })
      gsap.set('.dc-dot, .dc-dot-ring, .dc-dot-ring2', { scale: 0, transformOrigin: 'center' })
      gsap.set('.dc-dot-pulse', { scale: 1, opacity: 0, transformOrigin: 'center' })
      const tl = gsap.timeline({ delay: 0.1 })
      tl.to('.dc-line', {
        strokeDashoffset: 0,
        duration: 1,
        ease: 'power2.inOut',
        onComplete: () => gsap.set('.dc-line', { clearProps: 'strokeDasharray,strokeDashoffset' }),
      })
        .to('.dc-area', { opacity: 1, duration: 0.7, ease: 'power2.out' }, '-=0.75')
        .to('.dc-dot, .dc-dot-ring, .dc-dot-ring2', { scale: 1, duration: 0.5, ease: 'back.out(2.2)', stagger: 0.04 }, '-=0.35')
        .fromTo('.dc-dot-pulse', { scale: 1, opacity: 0.7 }, { scale: 2.7, opacity: 0, duration: 0.9, ease: 'power2.out' }, '-=0.15')
    },
    { scope: areaRef, dependencies: [w > 0, hasData] },
  )

  function onMove(e: React.PointerEvent) {
    if (!w || !hasData) return
    const rect = areaRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    let idx = 0,
      best = Infinity
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - x)
      if (d < best) {
        best = d
        idx = i
      }
    }
    if (idx !== hover) setHover(idx)
  }

  const hp = hover != null ? SALES[hover] : null
  const hpt = hover != null ? pts[hover] : null
  const tipLeft = hpt ? Math.min(Math.max(hpt.x, 84), Math.max(84, w - 84)) : 0
  const tipAbove = hpt ? hpt.y > H * 0.42 : true
  const tipTop = hpt ? (tipAbove ? hpt.y - 12 : hpt.y + 14) : 0
  const tipTransform = tipAbove ? 'translate(-50%,-100%)' : 'translate(-50%,0)'

  return (
    <section className="chartcard">
      <div className="ch-head">
        <div>
          <div className="ch-title">
            <span className="ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M19 9l-5 5-4-4-4 4" />
              </svg>
            </span>
            Ventas · últimos 10 días
          </div>
          <div className="ch-sub">{SALES_RANGE} · Bertamiráns</div>
        </div>
        <div className="ch-stat">
          <b className="tnum">{eur0(salesMedian)} €</b>
          <small>media diaria</small>
        </div>
      </div>

      <div className="chart-area" ref={areaRef} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {/* sin ventas en el rango → vacío honesto, SIN la línea con degradado. (Juan, 29-jun) */}
        {w > 0 && !hasData && (
          <svg viewBox={`0 0 ${w} ${H}`} preserveAspectRatio="none">
            {gridYs.map((gy, i) => (
              <line key={i} className="dc-grid" x1={PAD_X} x2={w - PAD_X} y1={gy} y2={gy} />
            ))}
          </svg>
        )}
        {w > 0 && !hasData && (
          <div className="dc-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M7 15l4-4 3 3 5-6" />
            </svg>
            <span>Sin ventas registradas estos días</span>
          </div>
        )}
        {w > 0 && hasData && (
          <svg viewBox={`0 0 ${w} ${H}`} preserveAspectRatio="none">
            <defs>
              {/* línea: oro pleno que brilla a blanco cálido hacia la punta (cometa premium) */}
              <linearGradient id="dcl" x1="0" x2={w} y1="0" y2="0">
                <stop offset="0" style={{ stopColor: 'var(--gold)', stopOpacity: 0.85 }} />
                <stop offset="0.55" style={{ stopColor: 'var(--gold-soft)' }} />
                <stop offset="0.88" style={{ stopColor: 'var(--gold)' }} />
                <stop offset="1" style={{ stopColor: '#fff7e0' }} />
              </linearGradient>
              {/* relleno de área: el "monte" — profundidad premium SIN desenfoque */}
              <linearGradient id="dca" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: 'var(--gold)', stopOpacity: 0.26 }} />
                <stop offset="0.55" style={{ stopColor: 'var(--gold)', stopOpacity: 0.07 }} />
                <stop offset="1" style={{ stopColor: 'var(--gold)', stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {/* rejilla de referencia (clara visualmente, no decorativa) */}
            {gridYs.map((gy, i) => (
              <line key={i} className="dc-grid" x1={PAD_X} x2={w - PAD_X} y1={gy} y2={gy} />
            ))}
            {/* área + línea NÍTIDA (sin glow borroso) */}
            <path className="dc-area" d={area} fill="url(#dca)" stroke="none" />
            <path className="dc-line" d={line} stroke="url(#dcl)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* punto VIVO de hoy — se OCULTA al pasar por otro punto (si no, parecen 2 seleccionados). Juan */}
            <g style={{ opacity: hover == null ? 1 : 0, transition: 'opacity .15s ease' }}>
              <circle className="dc-dot-pulse" cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="6.5" fill="none" />
              <circle className="dc-dot-ring2" cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="10" fill="none" />
              <circle className="dc-dot-ring" cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="6.5" fill="none" />
              <circle className="dc-dot" cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="4.2" />
            </g>
          </svg>
        )}

        {/* (sin etiqueta fija de HOY: la info aparece SOLO al pasar por encima — Juan, 27-jun) */}

        {/* crosshair + punto + tooltip al hover */}
        <div className="ch-cross" style={{ left: hpt?.x ?? 0, opacity: hpt ? 1 : 0 }} />
        <div className="ch-hoverdot" style={{ left: hpt?.x ?? 0, top: hpt?.y ?? 0, opacity: hpt ? 1 : 0 }} />
        <div className="ch-tip" style={{ left: tipLeft, top: tipTop, transform: tipTransform, opacity: hp ? 1 : 0 }}>
          <div className="d">
            {hp?.wd} {hp?.day} jun{hp?.today ? ' · hoy' : ''}
          </div>
          <div className="v tnum">{hp ? eur(hp.value) : ''} €</div>
          {hp && (
            <div className="ch-tip-break">
              <span className="tb-row">
                <i className="i-cash" />
                <span className="tb-l">Efectivo</span>
                <b className="tnum">{eur(hp.e)} €</b>
              </span>
              <span className="tb-row">
                <i className="i-card" />
                <span className="tb-l">Tarjeta</span>
                <b className="tnum">{eur(hp.t)} €</b>
              </span>
              <span className="tb-row">
                <i className="i-home" />
                <span className="tb-l">Domicilio</span>
                <b className="tnum">{eur(hp.d)} €</b>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* eje X — fechas como eje real (base + ticks), no números sueltos */}
      <div className="ch-x">
        {w > 0 &&
          SALES.map((s, i) => (
            <span key={s.day} className={s.today ? 'today' : ''} style={{ left: xOf(i) }}>
              {s.today ? 'Hoy' : s.day}
            </span>
          ))}
      </div>
    </section>
  )
}
