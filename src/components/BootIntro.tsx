import { useEffect, useRef, type CSSProperties } from 'react'
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
    return beastById('tiger')
  }
}

// Hex (#c6ff00) → "198,255,0" para alimentar var(--brand-rgb) en la intro (que vive FUERA de .app, así que
// no le llega el data-accent). El glow, el anillo y el bloom del logo siguen el color de la bestia/acento.
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

export default function BootIntro({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const finished = useRef(false)
  const beast = savedBeast()
  const accentRgb = hexToRgb(beast.color) // glow + partículas + anillo de la intro = color de acento de la bestia
  // Nombre del local del cliente (multi-tenant) → la intro es "LOGO × [local]".
  const local = (() => { try { return localStorage.getItem('rebell-profile-name') || '' } catch { return '' } })()

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

      const ease = 'power3.out' // ease-out premium en entradas
      const tl = gsap.timeline({ onComplete: finish })
      // 1 · el bloom de luz aparece
      tl.to('.br-glow', { opacity: 1, scale: 1, duration: 0.9, ease: 'power2.out' }, 0)
        // 2 · el león se materializa
        .to('.br-beast', { opacity: 1, scale: 1, y: 0, duration: 0.8, ease }, 0.1)
        // 3 · el nombre del local aparece (sube y nítido)
        .to('.br-logo', { opacity: 1, scale: 1, duration: 0.8, ease }, 0.36)
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
    <div className="boot boot-reveal" ref={root} role="presentation" style={{ ['--brand-rgb' as string]: accentRgb, ['--brand' as string]: beast.color } as CSSProperties}>
      {/* Fondo: bloom de ACENTO + glitter WebGL del color de acento. La intro es one-shot (~2s) → no es gasto
         continuo, así que no la gateamos por Salón frío ni reduced-motion (en reduced-motion acaba en 140ms). */}
      <div className="br-glow" aria-hidden="true" />
      <GlitterBG color={beast.color} />
      <div className="br-stack">
        <div className="br-beast" aria-hidden="true">
          <img src={beast.img} alt="" draggable={false} />
        </div>
        <div className="br-logo">
          {/* Logo FAT SMASH QUITADO de momento (pendiente nuevo nombre/logo). Queda la bestia + el local. (Juan, 30-jun) */}
          {local && <span className="br-logo-local">{local}</span>}
        </div>
      </div>
    </div>
  )
}
