import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import SalesChart from '../components/SalesChart'
import { play } from '../lib/sound'
import {
  CAJA, subM, subT, totalDia, avgT, OBJ, META_DIA,
  FRANJAS_M, FRANJAS_T, eur, reduceMotion,
} from '../lib/data'

gsap.registerPlugin(useGSAP)

type Turn = { efectivo: number; tarjeta: number; domicilio: number }

function Turno({ badge, badgeClass, name, subtotal, t, franjas }: {
  badge: string
  badgeClass: 'sol' | 'luna'
  name: string
  subtotal: number
  t: Turn
  franjas: [string, number, number][]
}) {
  const max = Math.max(t.efectivo, t.tarjeta, t.domicilio)
  const row = (c: 'cash' | 'card' | 'home', label: string, v: number) => (
    <div className="linea" key={c}>
      <span className="lbl">
        <i className={'i-' + c} />
        {label}
      </span>
      <div className="bar">
        <span className={c} data-p={(v / max).toFixed(3)} />
      </div>
      <span className="amt">{eur(v)} €</span>
    </div>
  )
  return (
    <div className="turno" data-tilt>
      <div className="turno-head">
        <div className="turno-name">
          <span className={'badge ' + badgeClass}>{badge}</span>
          {name}
        </div>
        <div className="turno-sub">
          {eur(subtotal)}
          <span className="cur"> €</span>
        </div>
      </div>
      {row('cash', 'Efectivo', t.efectivo)}
      {row('card', 'Tarjeta', t.tarjeta)}
      {row('home', 'Domicilio', t.domicilio)}
      <div className="turno-more">
        <div className="inner">
          <div className="hdr">Por franjas horarias</div>
          {franjas.map((f, i) => (
            <div className="hrline" key={i}>
              <span className="h">{f[0]}</span>
              <span className="mini">
                <span style={{ width: f[2] + '%' }} />
              </span>
              <b>{eur(f[1])} €</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Caja() {
  const root = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const odoRef = useRef<HTMLSpanElement>(null)
  const ordersRef = useRef<HTMLDivElement>(null)
  const avgRef = useRef<HTMLSpanElement>(null)
  const sealRef = useRef<HTMLDivElement>(null)
  const cerrarBtn = useRef<HTMLButtonElement>(null)
  const islandRef = useRef<HTMLDivElement>(null)
  const islandTxt = useRef<HTMLSpanElement>(null)
  const balanceRef = useRef<HTMLDivElement>(null)
  const confettiRef = useRef<HTMLCanvasElement>(null)
  const cerradoRef = useRef(false)
  const ringRef = useRef<SVGCircleElement>(null)
  const objRef = useRef<HTMLElement>(null)

  const [descuadre, setDescuadre] = useState(false)
  const [cerrado, setCerrado] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const [shine, setShine] = useState(false)

  // Progreso hacia la META del día (el "anillo" del medidor).
  const progress = Math.min(1, totalDia / META_DIA)
  const pct = Math.round((totalDia / META_DIA) * 100)
  const beat = totalDia >= META_DIA

  useEffect(() => {
    cerradoRef.current = cerrado
  }, [cerrado])

  function emotionalWeight() {
    const el = odoRef.current
    if (!el || reduceMotion()) return
    if (totalDia >= OBJ) {
      gsap.fromTo(el, { scale: 1 }, { scale: 1.045, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 1 })
      gsap.fromTo(el, { color: getComputedStyle(el).color }, { color: '#ffe6a3', duration: 0.3, yoyo: true, repeat: 1, ease: 'power1.inOut', onComplete: () => gsap.set(el, { clearProps: 'color' }) })
    }
  }
  function rollOdo() {
    const el = odoRef.current
    if (!el) return
    gsap.set(el, { clearProps: 'fontWeight,color', scale: 1 })
    if (reduceMotion()) {
      el.textContent = eur(totalDia)
      el.style.filter = ''
      emotionalWeight()
      return
    }
    const o = { v: 0, b: 9 }
    gsap.to(o, { v: totalDia, duration: 1.0, ease: 'power3.out', onUpdate: () => (el.textContent = eur(o.v)), onComplete: emotionalWeight })
    gsap.to(o, { b: 0, duration: 0.6, ease: 'power2.out', onUpdate: () => (el.style.filter = 'blur(' + o.b.toFixed(2) + 'px)'), onComplete: () => (el.style.filter = '') })
  }
  function reshine() {
    setShine(false)
    requestAnimationFrame(() => setShine(true))
  }
  function countTo(el: HTMLElement | null, to: number, fmt: (n: number) => string, dur = 1.1, delay = 0.4, onDone?: () => void) {
    if (!el) return
    if (reduceMotion()) {
      el.textContent = fmt(to)
      onDone?.()
      return
    }
    const o = { v: 0 }
    gsap.to(o, { v: to, duration: dur, delay, ease: 'power3.out', onUpdate: () => (el.textContent = fmt(o.v)), onComplete: onDone })
  }
  function kpiReact(el: HTMLElement | null) {
    if (!el || reduceMotion()) return
    gsap.fromTo(el, { scale: 1 }, { scale: 1.07, duration: 0.22, ease: 'power2.out', yoyo: true, repeat: 1, transformOrigin: 'left center' })
    gsap.fromTo(el, { color: getComputedStyle(el).color }, { color: '#ffd45e', duration: 0.32, yoyo: true, repeat: 1, ease: 'power1.inOut', onComplete: () => gsap.set(el, { clearProps: 'color' }) })
  }
  function fillBars() {
    root.current?.querySelectorAll<HTMLElement>('.bar span').forEach((b, i) => {
      const p = +(b.dataset.p || '0')
      if (reduceMotion()) {
        gsap.set(b, { scaleX: p })
        return
      }
      gsap.to(b, { scaleX: p, duration: 0.9, ease: 'back.out(1.4)', delay: i * 0.06 })
    })
  }

  useGSAP(
    () => {
      // La Caja se muestra TODO A LA VEZ (sin reveal escalonado): el layout está presente al instante.
      // Solo el total cuenta y las barras se rellenan, sobre elementos ya visibles → sensación de "vivo", no de "tarde".
      rollOdo()
      fillBars()
      // Anillo de progreso al objetivo, sincronizado con el count-up del total.
      const ring = ringRef.current
      if (ring) {
        const C = 2 * Math.PI * 106
        gsap.set(ring, { strokeDasharray: C })
        if (reduceMotion()) {
          gsap.set(ring, { strokeDashoffset: C * (1 - progress) })
        } else {
          gsap.set(ring, { strokeDashoffset: C })
          gsap.to(ring, { strokeDashoffset: C * (1 - progress), duration: 1.15, ease: 'power3.out', delay: 0.15 })
        }
      }
      countTo(objRef.current, pct, (n) => String(Math.round(n)), 1.0, 0.15)
      countTo(ordersRef.current, CAJA.pedidos, (n) => String(Math.round(n)), 0.7, 0.05, () => kpiReact(ordersRef.current))
      countTo(avgRef.current, avgT, eur, 0.7, 0.07, () => kpiReact(avgRef.current?.parentElement as HTMLElement))
      gsap.delayedCall(0.9, reshine)
      // red de seguridad para el número si el rAF se frena
      gsap.delayedCall(1.8, () => {
        const e = odoRef.current
        if (e && e.textContent === '0,00') e.textContent = eur(totalDia)
      })
    },
    { scope: root },
  )

  useEffect(() => {
    if (reduceMotion() || matchMedia('(pointer:coarse)').matches) return
    const cleanups: (() => void)[] = []
    root.current?.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.4, ease: 'power3' })
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.4, ease: 'power3' })
      const ys = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' })
      gsap.set(el, { transformPerspective: 700 })
      const mm = (e: MouseEvent) => {
        const r = el.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width - 0.5
        const py = (e.clientY - r.top) / r.height - 0.5
        el.style.setProperty('--mx', ((px + 0.5) * 100).toFixed(1) + '%')
        el.style.setProperty('--my', ((py + 0.5) * 100).toFixed(1) + '%')
        rx(-py * 7)
        ry(px * 9)
        ys(-4)
      }
      const ml = () => {
        rx(0)
        ry(0)
        ys(0)
      }
      el.addEventListener('mousemove', mm)
      el.addEventListener('mouseleave', ml)
      cleanups.push(() => {
        el.removeEventListener('mousemove', mm)
        el.removeEventListener('mouseleave', ml)
      })
    })
    const b = cerrarBtn.current
    if (b) {
      const x = gsap.quickTo(b, 'x', { duration: 0.4, ease: 'power3' })
      const y = gsap.quickTo(b, 'y', { duration: 0.4, ease: 'power3' })
      const mm = (e: MouseEvent) => {
        if (cerradoRef.current) return
        const r = b.getBoundingClientRect()
        x((e.clientX - r.left - r.width / 2) * 0.16)
        y((e.clientY - r.top - r.height / 2) * 0.32)
      }
      const ml = () => {
        x(0)
        y(0)
      }
      b.addEventListener('mousemove', mm)
      b.addEventListener('mouseleave', ml)
      cleanups.push(() => {
        b.removeEventListener('mousemove', mm)
        b.removeEventListener('mouseleave', ml)
      })
    }
    return () => cleanups.forEach((f) => f())
  }, [])

  function showIsland(warn: boolean) {
    const isl = islandRef.current
    const t = islandTxt.current
    if (!isl || !t) return
    isl.className = 'island ' + (warn ? 'warn' : 'ok')
    t.innerHTML = warn ? 'Descuadre detectado · <b>−12,40 €</b>' : 'Caja cuadrada ✓'
    gsap.killTweensOf(isl)
    if (reduceMotion()) {
      gsap.set(isl, { opacity: warn ? 1 : 0 })
      return
    }
    gsap.fromTo(isl, { xPercent: -50, y: -22, scale: 0.85, opacity: 0 }, { xPercent: -50, y: 0, scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(1.7)' })
    if (!warn) gsap.to(isl, { xPercent: -50, y: -22, scale: 0.85, opacity: 0, duration: 0.4, delay: 1.7, ease: 'power2.in' })
  }
  function toggleDescuadre() {
    const next = !descuadre
    setDescuadre(next)
    play('toggle')
    showIsland(next)
    if (balanceRef.current) gsap.fromTo(balanceRef.current, { x: next ? -6 : 6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1,.4)' })
  }
  function wink(frown: boolean) {
    const eyes = document.querySelectorAll('.eye')
    if (!eyes.length || reduceMotion()) return
    if (frown) {
      gsap.to(eyes, { scaleY: 0.5, y: -1, rotation: (i: number) => (i ? -12 : 12), transformOrigin: 'center', duration: 0.2, yoyo: true, repeat: 1, repeatDelay: 0.5 })
    } else {
      gsap.to(eyes, { scaleY: 0.1, transformOrigin: 'center', duration: 0.1, yoyo: true, repeat: 1 })
    }
  }
  function confetti() {
    const cv = confettiRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(devicePixelRatio || 1, 2)
    cv.width = innerWidth * dpr
    cv.height = innerHeight * dpr
    ctx.scale(dpr, dpr)
    const cols = ['#ffbf10', '#ffd45e', '#f5f5f7', '#34d399']
    const cx = innerWidth * 0.5,
      cy = innerHeight * 0.38,
      N = Math.min(100, Math.round(innerWidth / 6))
    type P = { x: number; y: number; vx: number; vy: number; g: number; s: number; rot: number; vr: number; c: string; life: number; max: number }
    const P: P[] = Array.from({ length: N }, () => {
      const sp = 6 + Math.random() * 9
      return { x: cx + (Math.random() - 0.5) * 90, y: cy, vx: (Math.random() - 0.5) * sp * 1.7, vy: -(8 + Math.random() * 10), g: 0.32 + Math.random() * 0.12, s: 5 + Math.random() * 5, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, c: cols[(Math.random() * cols.length) | 0], life: 0, max: 90 + Math.random() * 40 }
    })
    let raf = 0
    ;(function loop() {
      ctx.clearRect(0, 0, cv.width, cv.height)
      let alive = false
      for (const p of P) {
        p.life++
        if (p.life > p.max) continue
        alive = true
        p.vy += p.g
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.99
        p.rot += p.vr
        const o = Math.max(0, 1 - p.life / p.max)
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = o
        ctx.fillStyle = p.c
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.62)
        ctx.restore()
      }
      if (alive) raf = requestAnimationFrame(loop)
      else {
        cancelAnimationFrame(raf)
        ctx.clearRect(0, 0, cv.width, cv.height)
      }
    })()
  }
  function cerrar() {
    if (cerrado) return
    const desc = descuadre
    cerradoRef.current = true
    setCerrado(true)
    play('tap')
    window.setTimeout(() => play(desc ? 'error' : 'success', 0.6), desc ? 160 : 340)
    const seal = sealRef.current
    const hero = heroRef.current
    if (hero && seal) {
      const tl = gsap.timeline()
      tl.to(hero, { scale: 0.99, duration: 0.12, ease: 'power2.in' })
        .to(hero, { scale: 1, duration: 0.5, ease: 'elastic.out(1,.5)' })
        .fromTo(seal, { scale: 0.3, opacity: 0, rotate: -30 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.7, ease: 'back.out(2)' }, '-=0.5')
    }
    wink(desc)
    if (!desc) {
      setCelebrate(true)
      window.setTimeout(() => setCelebrate(false), 1300)
      if (!reduceMotion()) confetti()
    }
    if (navigator.vibrate) navigator.vibrate(reduceMotion() ? 0 : desc ? [20, 60, 20] : [8, 40, 14])
  }

  const warnIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5v.01" />
    </svg>
  )
  const okIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  )

  return (
    <div className={'caja' + (shine ? ' shine' : '')} ref={root}>
      <canvas id="confetti" ref={confettiRef} aria-hidden="true" />
      <div className="island" ref={islandRef}>
        <span className="idot" />
        <span ref={islandTxt} />
      </div>

      <div className="wrap">
        <section className={'hero' + (descuadre ? ' warn' : '') + (celebrate ? ' celebrate' : '') + (beat ? ' beat' : '')} id="hero" ref={heroRef}>
          <div className={'seal' + (descuadre ? ' warn' : '')} ref={sealRef}>
            {descuadre ? warnIcon : okIcon}
          </div>

          <div className="hero-gauge">
            <svg className="gauge" viewBox="0 0 240 240" aria-hidden="true">
              <defs>
                <linearGradient id="gaugeGrad" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0" style={{ stopColor: 'var(--gold-deep)' }} />
                  <stop offset="1" style={{ stopColor: 'var(--gold-soft)' }} />
                </linearGradient>
              </defs>
              <circle className="gauge-track" cx="120" cy="120" r="106" />
              <circle className="gauge-fill" ref={ringRef} cx="120" cy="120" r="106" />
            </svg>
            <div className="gauge-center">
              <span className="g-label">Total del día</span>
              <div className="odo">
                <span className="odonum" ref={odoRef}>0,00</span>
                <span className="cur">€</span>
              </div>
            </div>
          </div>

          <div className="hero-side">
            <div className="hs-row">
              <span className="hs-k">Vs ayer</span>
              <span className="hs-v up">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
                9,0%
              </span>
            </div>
            <div className="hs-row">
              <span className="hs-k">Objetivo del día</span>
              <span className="hs-v"><b ref={objRef} className="tnum">0</b>%{beat ? ' ✓' : ''}</span>
            </div>
            <div className="hs-row">
              <span className="hs-k">Racha</span>
              <span className="hs-v">5 días</span>
            </div>
            <div className={'balance' + (descuadre ? ' warn' : '')} ref={balanceRef}>
              <span className="ic">{descuadre ? warnIcon : okIcon}</span>
              <span className="txt">
                {descuadre ? 'Descuadre de −12,40 €' : 'Caja cuadrada'}
                <small>{descuadre ? 'El efectivo declarado no coincide con los pedidos cobrados' : 'Efectivo declarado coincide con los pedidos cobrados'}</small>
              </span>
            </div>
          </div>
        </section>

        <div className="stats">
          <div className="stat kpi" data-tilt>
            <div className="k">Pedidos</div>
            <div className="kpi-body">
              <div className="v tnum" ref={ordersRef}>0</div>
              <div className="kpi-foot up">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
                +12%<span className="kpi-obj">objetivo 75</span>
              </div>
            </div>
          </div>
          <div className="stat kpi" data-tilt>
            <div className="k">Ticket medio</div>
            <div className="kpi-body">
              <div className="v tnum">
                <span ref={avgRef}>0</span>
                <small> €</small>
              </div>
              <div className="kpi-foot up">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
                +9%<span className="kpi-obj">objetivo 19,50 €</span>
              </div>
            </div>
          </div>
        </div>

        <SalesChart />

        <div className="turnos">
          <Turno badge="☀" badgeClass="sol" name="Mañana" subtotal={subM} t={CAJA.manana} franjas={FRANJAS_M} />
          <Turno badge="☾" badgeClass="luna" name="Tarde" subtotal={subT} t={CAJA.tarde} franjas={FRANJAS_T} />
        </div>
      </div>

      <div className="actionbar">
        <div className="action-inner">
          <label className={'switch' + (descuadre ? ' on' : '')} onClick={toggleDescuadre}>
            <span>Simular descuadre</span>
            <span className="track" />
          </label>
          <button className={'btn' + (cerrado ? ' done' : '') + (cerrado && descuadre ? ' warn' : '')} ref={cerrarBtn} onClick={cerrar}>
            {!cerrado ? (
              'Cerrar caja'
            ) : descuadre ? (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" style={{ verticalAlign: -3 }}>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5M12 16.5v.01" />
                </svg>{' '}
                Cerrado con descuadre
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: -3 }}>
                  <path d="M5 13l4 4L19 7" />
                </svg>{' '}
                Día cerrado · 23:47
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
