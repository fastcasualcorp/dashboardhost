import { useEffect, useState, type MouseEvent } from 'react'
import { motion } from 'motion/react'
import { play, preloadSfx } from '../lib/sound'
import { beastById } from '../lib/beasts'

/* Login estilo Netflix "¿Quién está viendo?" → aquí "¿Quién abre caja?".
   Cada perfil es un LOCAL (multi-tenant) con su BESTIA (avatar). Al elegir, el
   avatar hace un pop y entramos con el color del local. */

export type Profile = { id: string; name: string; sub: string; beast: string }

export const PROFILES: Profile[] = [
  { id: 'bertamirans', name: 'Bertamiráns', sub: 'REBELL', beast: 'lion' },
  { id: 'madrid', name: 'Madrid Centro', sub: 'REBELL', beast: 'panda' },
  { id: 'barcelona', name: 'Barcelona', sub: 'REBELL', beast: 'fox' },
  { id: 'central', name: 'Administración', sub: 'Central', beast: 'panther' },
]

export default function Login({ onEnter }: { onEnter: (p: Profile) => void }) {
  const [sel, setSel] = useState<string | null>(null)

  // Precargar el sonido YA en el login (antes el motor se preparaba en Shell, que
  // monta DESPUÉS → el primer clic disparaba la carga y sonaba con ~1s de retraso).
  useEffect(() => {
    preloadSfx()
  }, [])

  // Avatar vivo: la cabeza sigue al cursor (tilt 3D + parallax SUTIL de la imagen).
  function tilt(e: MouseEvent<HTMLButtonElement>) {
    if (sel) return
    const btn = e.currentTarget
    const av = btn.querySelector('.pf-av') as HTMLElement | null
    const img = btn.querySelector('.pf-img') as HTMLElement | null
    if (!av) return
    const r = btn.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    av.style.transform = `perspective(700px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 9).toFixed(2)}deg) scale(1.035)`
    if (img) img.style.transform = `scale(1.05) translate(${(px * -4).toFixed(1)}px, ${(py * -4).toFixed(1)}px)`
  }
  function untilt(e: MouseEvent<HTMLButtonElement>) {
    const btn = e.currentTarget
    const av = btn.querySelector('.pf-av') as HTMLElement | null
    const img = btn.querySelector('.pf-img') as HTMLElement | null
    if (av) av.style.transform = ''
    if (img) img.style.transform = ''
  }

  function pick(p: Profile) {
    if (sel) return
    setSel(p.id)
    // click limpio e inmediato (los buffers ya están precargados → sin retraso)
    play('tap', 0.5, 1.22)
    // confirmación suave al entrar
    window.setTimeout(() => play('success', 0.4, 1.12), 300)
    window.setTimeout(() => onEnter(p), 780)
  }

  // Parallax 2.5D del fondo: la cocina se desplaza un poco con el cursor.
  function bgParallax(e: MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const px = e.clientX / window.innerWidth - 0.5
    const py = e.clientY / window.innerHeight - 0.5
    el.style.setProperty('--bgx', (px * -22).toFixed(1) + 'px')
    el.style.setProperty('--bgy', (py * -16).toFixed(1) + 'px')
  }

  return (
    <div className={'login' + (sel ? ' leaving' : '')} onMouseMove={bgParallax}>
      <div className="login-bg" />
      <div className="login-bg blur" aria-hidden="true" />
      <div className="login-chroma" aria-hidden="true" />
      <div className="login-grain" aria-hidden="true" />
      <div className="login-veil" />
      <div className="login-flicker" aria-hidden="true" />
      <div className="login-content">
      <div className="login-top">
        <span className="lg-word">REBELL</span>
      </div>

      <motion.h1
        className="login-title"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      >
        ¿Quién abre caja?
      </motion.h1>

      <div className="login-grid">
        {PROFILES.map((p, i) => {
          const beast = beastById(p.beast)
          return (
            <motion.button
              key={p.id}
              className={'pf' + (sel === p.id ? ' sel' : '') + (sel && sel !== p.id ? ' dim' : '')}
              onClick={() => pick(p)}
              onMouseMove={tilt}
              onMouseLeave={untilt}
              initial={{ opacity: 0, y: 18, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.07, type: 'spring', stiffness: 320, damping: 26 }}
              style={{ ['--pc' as string]: beast.color }}
            >
              <span className="pf-av">
                <img className="pf-img" src={beast.img} alt={p.name} draggable={false} />
              </span>
              <span className="pf-name">{p.name}</span>
              <span className="pf-sub">{p.sub}</span>
            </motion.button>
          )
        })}
      </div>

      <p className="login-hint">Elige tu local para entrar al panel</p>
      </div>
    </div>
  )
}
