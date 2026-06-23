import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { play } from '../lib/sound'

/* Intro "cocina viva": un arranque cinemático que se ve UNA vez por sesión.
   La cocina se enciende (la imagen pasa de negro a luz con un fogonazo), suben
   brasas, y el logotipo REBELL se enciende con un barrido dorado. Luego se
   disuelve y deja paso al login. One-shot (nunca infinito), saltable con un clic
   o tecla, y desactivado con prefers-reduced-motion (eso se decide en App). */

const WORD = 'REBELL'.split('')
// posiciones/tamaños de las brasas (fijas → render estable, sin parpadeos por re-render)
const EMBERS = [8, 17, 26, 34, 43, 52, 58, 66, 74, 81, 88, 94].map((x, i) => ({
  x,
  s: 3 + ((i * 7) % 5),
  d: ((i * 13) % 18) / 10,
}))

export default function BootIntro({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const finished = useRef(false)

  useEffect(() => {
    const el = root.current
    if (!el) {
      onDone()
      return
    }
    const finish = () => {
      if (finished.current) return
      finished.current = true
      onDone()
    }

    const ctx = gsap.context(() => {
      gsap.set('.boot-bg', { scale: 1.18, filter: 'brightness(0.12) saturate(1.25)', opacity: 0 })
      gsap.set('.boot-logo span', { yPercent: 120, opacity: 0 })
      gsap.set('.boot-flare', { xPercent: -160, opacity: 0 })
      gsap.set('.boot-tag', { opacity: 0, y: 8 })

      const tl = gsap.timeline({ onComplete: finish })
      tl.to('.boot-bg', { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0)
        // la cocina "se enciende": de oscuro a luz, con un fogonazo de exposición
        .to('.boot-bg', { filter: 'brightness(1) saturate(1.05)', duration: 1.0, ease: 'power2.out' }, 0.15)
        .to('.boot-bg', { filter: 'brightness(1.55) saturate(1.1)', duration: 0.11, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 0.3)
        // Ken Burns: la imagen respira (zoom lento) durante toda la intro
        .to('.boot-bg', { scale: 1.0, duration: 2.5, ease: 'power1.out' }, 0)
        // el logotipo sube y aparece, letra a letra
        .to('.boot-logo span', { yPercent: 0, opacity: 1, duration: 0.6, stagger: 0.06, ease: 'back.out(1.5)' }, 0.55)
        // barrido dorado que "enciende" el logo
        .fromTo('.boot-flare', { xPercent: -160, opacity: 0 }, { xPercent: 260, opacity: 1, duration: 0.72, ease: 'power2.inOut' }, 1.0)
        .to('.boot-flare', { opacity: 0, duration: 0.25 }, 1.55)
        .to('.boot-tag', { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 1.2)
        // se disuelve y deja paso al login
        .to('.boot', { opacity: 0, duration: 0.6, ease: 'power2.in' }, 2.15)

      // sonido (sutil; en el primer load el navegador puede silenciarlo hasta el 1er gesto)
      tl.call(() => play('toggle', 0.22, 0.55), undefined, 0.1)
      tl.call(() => play('success', 0.3, 0.92), undefined, 1.0)
    }, root)

    // saltable: un clic o tecla cierra limpio
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
    <div className="boot" ref={root} role="presentation">
      <div className="boot-bg" style={{ backgroundImage: "url('/img/login-bg.jpg')" }} />
      <div className="boot-grad" />
      <div className="boot-embers" aria-hidden="true">
        {EMBERS.map((e, i) => (
          <span key={i} className="ember" style={{ left: e.x + '%', width: e.s, height: e.s, animationDelay: e.d + 's' }} />
        ))}
      </div>
      <div className="boot-logoWrap">
        <div className="boot-logo">
          {WORD.map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>
        <div className="boot-flare" aria-hidden="true" />
      </div>
      <div className="boot-tag">Abriendo cocina</div>
    </div>
  )
}
