import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { playSweep, playLock, play } from '../lib/sound'
import { reduceMotion } from '../lib/data'

/* Intro "arranque de cockpit" (HUD sci-fi): el sistema REBELL se ENCIENDE como el HUD de un caza —
   esquinas y líneas que se trazan, retícula que fija, barra de sistema cargando, y REBELL que se
   materializa por scanlines. Al llegar al 100% → IMPACTO: destello + temblor + el "boom" de Juan +
   "SISTEMA ONLINE". One-shot por sesión, saltable con clic/tecla, instantáneo en reduced-motion. */

export default function BootIntro({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const finished = useRef(false)

  useEffect(() => {
    const el = root.current
    const finish = () => {
      if (finished.current) return
      finished.current = true
      onDone()
    }
    if (!el) return finish()
    // reduced-motion: nada de show; al login directo (un pelín de margen para no parpadear)
    if (reduceMotion()) {
      const t = window.setTimeout(finish, 140)
      return () => window.clearTimeout(t)
    }

    const ctx = gsap.context(() => {
      gsap.set('.bh-grid', { opacity: 0 })
      gsap.set('.bh-corner', { opacity: 0, scale: 0.55 })
      gsap.set('.bh-cross-h', { scaleX: 0 })
      gsap.set('.bh-cross-v', { scaleY: 0 })
      gsap.set('.bh-reticle', { opacity: 0, scale: 0.35, rotate: -110 })
      gsap.set('.bh-scan', { yPercent: -120, opacity: 0 })
      gsap.set('.bh-boot .ch', { opacity: 0 })
      gsap.set('.bh-bar', { opacity: 0 })
      gsap.set('.bh-bar-fill', { scaleX: 0 })
      gsap.set('.bh-pct', { opacity: 0 })
      gsap.set('.bh-trace', { strokeDasharray: 3000, strokeDashoffset: 3000 })
      gsap.set('.bh-fill', { opacity: 0 })
      gsap.set('.bh-shine', { attr: { x: -260 }, opacity: 0 })
      gsap.set('.bh-logo', { scale: 0.92, opacity: 0, transformOrigin: 'center' })
      gsap.set('.bh-rule', { scaleX: 0 })
      gsap.set('.bh-status', { opacity: 0, y: 7 })
      gsap.set('.bh-flash', { opacity: 0 })

      const tl = gsap.timeline({ onComplete: finish })
      // 1 · el HUD se ENSAMBLA
      tl.to('.bh-grid', { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0)
        .to('.bh-corner', { opacity: 1, scale: 1, duration: 0.45, stagger: 0.06, ease: 'back.out(2.2)' }, 0.12)
        .to('.bh-cross-h', { scaleX: 1, duration: 0.55, ease: 'power3.inOut' }, 0.18)
        .to('.bh-cross-v', { scaleY: 1, duration: 0.55, ease: 'power3.inOut' }, 0.18)
        .to('.bh-reticle', { opacity: 1, scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(1.5)' }, 0.32)
        .fromTo('.bh-scan', { yPercent: -120, opacity: 0 }, { yPercent: 120, opacity: 1, duration: 1.5, ease: 'power1.inOut' }, 0.3)
        .to('.bh-scan', { opacity: 0, duration: 0.3 }, 1.5)
        // 2 · texto de arranque (máquina de escribir) + barra de sistema
        .to('.bh-boot .ch', { opacity: 1, duration: 0.02, stagger: 0.022, ease: 'none' }, 0.5)
        .to('.bh-bar', { opacity: 1, duration: 0.3 }, 0.65)
        .to('.bh-pct', { opacity: 1, duration: 0.3 }, 0.65)
        .to('.bh-bar-fill', { scaleX: 1, duration: 1.15, ease: 'power1.inOut' }, 0.72)
        .to('.bh-pct-n', { textContent: 100, duration: 1.15, ease: 'power1.inOut', snap: { textContent: 1 } }, 0.72)
        // 3 · REBELL: el TRAZO se dibuja (stroke) y luego el RELLENO de cristal aparece
        .to('.bh-logo', { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' }, 0.82)
        .to('.bh-trace', { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, 0.85)
        .to('.bh-fill', { opacity: 1, duration: 0.55, ease: 'power2.out' }, 1.45)
        .to('.bh-trace', { opacity: 0.55, duration: 0.4, ease: 'power2.out' }, 1.6) // el trazo queda como filo sutil
        .to('.bh-rule', { scaleX: 1, duration: 0.5, ease: 'power2.out' }, 1.5)
        // 4 · IMPACTO al 100%: destello + temblor + boom + ONLINE
        .add('hit', 1.92)
        .to('.bh-flash', { opacity: 0.9, duration: 0.07, ease: 'power2.out' }, 'hit')
        .to('.bh-flash', { opacity: 0, duration: 0.45, ease: 'power2.in' }, 'hit+=0.07')
        .to('.bh-logo', { filter: 'brightness(1.9)', duration: 0.08, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 'hit')
        // glint de CRISTAL: un destello de luz barre las letras
        .fromTo('.bh-shine', { attr: { x: -260 }, opacity: 0 }, { attr: { x: 760 }, opacity: 1, duration: 0.55, ease: 'power2.inOut' }, 'hit')
        .to('.bh-shine', { opacity: 0, duration: 0.2, ease: 'power2.in' }, 'hit+=0.42')
        .to('.bh-corner', { scale: 1.08, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out' }, 'hit')
        .to(root.current, { keyframes: { x: [-7, 6, -5, 4, -2, 0], y: [4, -3, 2, -1, 0, 0] }, duration: 0.42, ease: 'power2.out' }, 'hit')
        .to('.bh-status', { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(2)' }, 'hit+=0.06')
        // 5 · salida
        .to('.boot', { opacity: 0, duration: 0.5, ease: 'power2.in' }, 'hit+=1.0')

      // sonido (en el 1er load el navegador puede silenciarlo hasta el 1er gesto; suena si el contexto ya está activo)
      tl.call(() => playLock(0.35), undefined, 0.32) // retícula fija
      tl.call(() => play('tap', 0.18, 1.4), undefined, 0.72) // beep de arranque
      tl.call(() => playSweep(0.6), undefined, 1.92) // BOOM de Juan en el impacto
    }, root)

    const skip = () => {
      if (finished.current) return
      gsap.to('.boot', { opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: finish })
    }
    el.addEventListener('click', skip)
    window.addEventListener('keydown', skip)

    return () => {
      ctx.revert()
      el.removeEventListener('click', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [onDone])

  return (
    <div className="boot boot-hud" ref={root} role="presentation">
      <div className="bh-grid" aria-hidden="true" />
      <div className="bh-scan" aria-hidden="true" />
      {/* marco táctico: 4 esquinas */}
      <span className="bh-corner tl" aria-hidden="true" />
      <span className="bh-corner tr" aria-hidden="true" />
      <span className="bh-corner bl" aria-hidden="true" />
      <span className="bh-corner br" aria-hidden="true" />
      {/* cruz de guía + retícula */}
      <div className="bh-cross-h" aria-hidden="true" />
      <div className="bh-cross-v" aria-hidden="true" />
      <div className="bh-reticle" aria-hidden="true"><span /><span /></div>

      <div className="bh-center">
        <div className="bh-boot">
          {'INICIANDO SISTEMA · BERTAMIRÁNS'.split('').map((c, i) => (
            <span className="ch" key={i}>{c === ' ' ? ' ' : c}</span>
          ))}
        </div>
        <svg className="bh-logo" viewBox="0 0 760 180" preserveAspectRatio="xMidYMid meet" aria-label="REBELL">
          <defs>
            <linearGradient id="bhGlass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="44%" stopColor="#e9edf6" />
              <stop offset="51%" stopColor="#b9c1d2" />
              <stop offset="52%" stopColor="#a7afc2" />
              <stop offset="78%" stopColor="#dfe4ee" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
            <linearGradient id="bhEdge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#e8ab0c" />
              <stop offset="50%" stopColor="#ffe49a" />
              <stop offset="100%" stopColor="#fff7e0" />
            </linearGradient>
            <linearGradient id="bhShineG" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="50%" stopColor="rgba(255,255,255,.92)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            <mask id="bhMask">
              <text x="380" y="100" textAnchor="middle" dominantBaseline="middle" fill="#fff">REBELL</text>
            </mask>
          </defs>
          <text className="bh-fill" x="380" y="100" textAnchor="middle" dominantBaseline="middle">REBELL</text>
          <text className="bh-trace" x="380" y="100" textAnchor="middle" dominantBaseline="middle">REBELL</text>
          <g mask="url(#bhMask)">
            <rect className="bh-shine" x="-260" y="0" width="210" height="180" fill="url(#bhShineG)" />
          </g>
        </svg>
        <div className="bh-rule" aria-hidden="true" />
        <div className="bh-bar" aria-hidden="true"><span className="bh-bar-fill" /></div>
        <div className="bh-pct"><span className="bh-pct-n">0</span><span className="bh-pct-u">%</span> · ENLACE SEGURO</div>
        <div className="bh-status"><i className="bh-dot" /> SISTEMA ONLINE</div>
      </div>

      <div className="bh-flash" aria-hidden="true" />
    </div>
  )
}
