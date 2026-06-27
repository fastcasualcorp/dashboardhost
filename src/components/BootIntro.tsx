import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { playSweep } from '../lib/sound'
import { reduceMotion } from '../lib/data'
import { beastById } from '../lib/beasts'
import GlitterBG from './GlitterBG'

/* Intro REVEAL minimalista (Apple): sobre negro, el LEÓN del local y el wordmark REBELL se
   MATERIALIZAN con un bloom cálido de luz y un destello de cristal que barre las letras; luego todo
   se FUNDE para revelar la app. Sin HUD, sin texto de "sistema", sin barra de carga. One-shot por
   sesión, saltable con clic/tecla, instantáneo en reduced-motion. (Juan, 27-jun) */

function savedBeast() {
  try {
    return beastById(localStorage.getItem('rebell-beast'))
  } catch {
    return beastById('lion')
  }
}

export default function BootIntro({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const finished = useRef(false)
  const beast = savedBeast()

  useEffect(() => {
    const el = root.current
    const finish = () => {
      if (finished.current) return
      finished.current = true
      onDone()
    }
    if (!el) return finish()
    // reduced-motion: sin show, al login directo (un pelín de margen para no parpadear).
    if (reduceMotion()) {
      const t = window.setTimeout(finish, 140)
      return () => window.clearTimeout(t)
    }

    const ctx = gsap.context(() => {
      gsap.set('.br-glow', { opacity: 0, scale: 0.72, transformOrigin: 'center' })
      gsap.set('.br-beast', { opacity: 0, scale: 0.86, y: 12, transformOrigin: 'center' })
      gsap.set('.br-logo', { opacity: 0, scale: 0.965, transformOrigin: 'center' })
      gsap.set('.br-shine', { attr: { x: -260 }, opacity: 0 })

      const ease = 'power3.out' // ease-out premium en entradas
      const tl = gsap.timeline({ onComplete: finish })
      // 1 · el bloom de luz aparece
      tl.to('.br-glow', { opacity: 1, scale: 1, duration: 0.9, ease: 'power2.out' }, 0)
        // 2 · el león se materializa
        .to('.br-beast', { opacity: 1, scale: 1, y: 0, duration: 0.8, ease }, 0.1)
        // 3 · el wordmark REBELL aparece (sube y nítido)
        .to('.br-logo', { opacity: 1, scale: 1, duration: 0.8, ease }, 0.36)
        // 4 · destello de cristal que barre las letras (una sola vez)
        .fromTo('.br-shine', { attr: { x: -260 }, opacity: 0 }, { attr: { x: 760 }, opacity: 1, duration: 0.75, ease: 'power2.inOut' }, 0.66)
        .to('.br-shine', { opacity: 0, duration: 0.22, ease: 'power2.in' }, 1.28)
        // respiración MUY sutil del bloom (one-shot, decae — nada termina de golpe)
        .to('.br-glow', { opacity: 0.72, scale: 1.04, duration: 0.8, ease: 'sine.inOut' }, 0.95)
        // 5 · salida: todo se funde para revelar la app
        .to(root.current, { opacity: 0, duration: 0.6, ease: 'power2.in' }, 1.5)

      // un único swell de luz suave al materializar (el navegador puede silenciarlo hasta el 1er gesto)
      tl.call(() => playSweep(0.26), undefined, 0.36)
    }, root)

    const skip = () => {
      if (finished.current) return
      gsap.to(root.current, { opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: finish })
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
    <div className="boot boot-reveal" ref={root} role="presentation">
      {/* Fondo: bloom cálido + glitter WebGL SIEMPRE. La intro es one-shot (~2s) → no es gasto continuo, así
         que no la gateamos por Salón frío ni reduced-motion (en reduced-motion la intro acaba en 140ms igual). */}
      <div className="br-glow" aria-hidden="true" />
      <GlitterBG />
      <div className="br-stack">
        <div className="br-beast" aria-hidden="true">
          <img src={beast.img} alt="" draggable={false} />
        </div>
        <svg className="br-logo" viewBox="0 0 760 180" preserveAspectRatio="xMidYMid meet" aria-label="REBELL">
          <defs>
            <linearGradient id="brGlass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="44%" stopColor="#e9edf6" />
              <stop offset="51%" stopColor="#b9c1d2" />
              <stop offset="52%" stopColor="#a7afc2" />
              <stop offset="78%" stopColor="#dfe4ee" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
            <linearGradient id="brShineG" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="50%" stopColor="rgba(255,255,255,.92)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            <mask id="brMask">
              <text x="380" y="100" textAnchor="middle" dominantBaseline="middle" fill="#fff">REBELL</text>
            </mask>
          </defs>
          <text className="br-fill" x="380" y="100" textAnchor="middle" dominantBaseline="middle">REBELL</text>
          <g mask="url(#brMask)">
            <rect className="br-shine" x="-260" y="0" width="210" height="180" fill="url(#brShineG)" />
          </g>
        </svg>
      </div>
    </div>
  )
}
