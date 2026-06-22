import { useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { SALES, salesMedian, eur, eur0, reduceMotion } from '../lib/data'

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

const H = 156
const PAD_X = 10
const TOP = 16
const BOTTOM = 18

export default function SalesChart() {
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
  const vmax = Math.max(...values)
  const vmin = Math.min(...values)
  const span = vmax - vmin || 1
  const yOf = (v: number) => TOP + (1 - (v - vmin) / span) * (H - TOP - BOTTOM)
  const xOf = (i: number) => PAD_X + (i * (w - 2 * PAD_X)) / (SALES.length - 1)

  const pts: Pt[] = SALES.map((s, i) => ({ x: xOf(i), y: yOf(s.value) }))
  const line = w ? smooth(pts) : ''
  const last = pts[pts.length - 1]
  const area = w ? `${line} L ${last.x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z` : ''
  const medianY = yOf(salesMedian)
  const grid = [0.18, 0.46, 0.74].map((t) => TOP + t * (H - TOP - BOTTOM))

  useGSAP(
    () => {
      if (!w) return
      const lineEl = areaRef.current?.querySelector('.dc-line') as SVGPathElement | null
      if (!lineEl) return
      if (reduceMotion()) {
        gsap.set('.dc-area', { opacity: 1 })
        gsap.set('.dc-dot', { scale: 1 })
        return
      }
      const len = lineEl.getTotalLength ? lineEl.getTotalLength() : 500
      gsap.set(lineEl, { strokeDasharray: len, strokeDashoffset: len })
      gsap.set('.dc-area', { opacity: 0 })
      gsap.set('.dc-dot', { scale: 0, transformOrigin: 'center' })
      const tl = gsap.timeline({ delay: 0.1 })
      tl.to(lineEl, {
        strokeDashoffset: 0,
        duration: 0.85,
        ease: 'power2.inOut',
        onComplete: () => gsap.set(lineEl, { clearProps: 'strokeDasharray,strokeDashoffset' }),
      })
        .to('.dc-area', { opacity: 1, duration: 0.6 }, '-=0.65')
        .to('.dc-dot', { scale: 1, duration: 0.5, ease: 'back.out(2.2)' }, '-=0.4')
    },
    { scope: areaRef, dependencies: [w > 0] },
  )

  function onMove(e: React.PointerEvent) {
    if (!w) return
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
          <div className="ch-sub">12–21 jun · Bertamiráns</div>
        </div>
        <div className="ch-stat">
          <b className="tnum">{eur0(salesMedian)} €</b>
          <small>media diaria</small>
        </div>
      </div>

      <div
        className="chart-area"
        ref={areaRef}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {w > 0 && (
          <svg viewBox={`0 0 ${w} ${H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="dcl" x1="0" x2={w} y1="0" y2="0">
                <stop style={{ stopColor: 'var(--gold-deep)' }} />
                <stop offset="1" style={{ stopColor: 'var(--gold-soft)' }} />
              </linearGradient>
              <linearGradient id="dca" x1="0" y1="0" x2="0" y2={H}>
                <stop style={{ stopColor: 'var(--gold)', stopOpacity: 0.32 }} />
                <stop offset="1" style={{ stopColor: 'var(--gold)', stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {grid.map((gy, i) => (
              <line key={i} className="dc-grid" x1="0" x2={w} y1={gy} y2={gy} />
            ))}
            <line className="dc-median" x1="0" x2={w} y1={medianY} y2={medianY} />
            <path className="dc-area" d={area} fill="url(#dca)" />
            <path className="dc-line" d={line} stroke="url(#dcl)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle className="dc-dot" cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="3.8" style={{ fill: 'var(--gold-soft)' }} />
          </svg>
        )}

        {/* etiqueta de la media */}
        {w > 0 && (
          <span className="ch-median-lab" style={{ top: medianY }}>
            media
          </span>
        )}

        {/* crosshair + punto + tooltip */}
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

      {/* eje X — fechas */}
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
