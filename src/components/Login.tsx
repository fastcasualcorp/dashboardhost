import { useState } from 'react'
import { motion } from 'motion/react'
import { play } from '../lib/sound'

/* Login estilo Netflix "¿Quién está viendo?" → aquí "¿Quién abre caja?".
   Cada perfil es un LOCAL (multi-tenant). Al elegir, el avatar GUIÑA y entramos.
   Los avatares definitivos (animales por color) se generan aparte; de momento la
   mascota REBELL (cuernos) teñida con el color del local. */

export type Profile = { id: string; name: string; sub: string; accent: string; color: string; avatar: string }

export const PROFILES: Profile[] = [
  { id: 'bertamirans', name: 'Bertamiráns', sub: 'REBELL', accent: 'gold', color: '#ffbf10', avatar: '/img/avatars/tiger.jpg' },
  { id: 'madrid', name: 'Madrid Centro', sub: 'REBELL', accent: 'azul', color: '#3a86ff', avatar: '/img/avatars/wolf.jpg' },
  { id: 'barcelona', name: 'Barcelona', sub: 'REBELL', accent: 'rosa', color: '#e0457a', avatar: '/img/avatars/fox.jpg' },
  { id: 'central', name: 'Administración', sub: 'Central', accent: 'violeta', color: '#8b6df0', avatar: '/img/avatars/panther.jpg' },
]

export default function Login({ onEnter }: { onEnter: (p: Profile) => void }) {
  const [sel, setSel] = useState<string | null>(null)

  function pick(p: Profile) {
    if (sel) return
    setSel(p.id)
    play('toggle', 0.5, 1.1)
    // guiño + zoom, luego entramos
    window.setTimeout(() => play('success', 0.5, 1.04), 360)
    window.setTimeout(() => onEnter(p), 780)
  }

  return (
    <div className={'login' + (sel ? ' leaving' : '')}>
      <div className="login-top">
        <svg className="lg-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M6 13c0 11 6 17 18 17S42 24 42 13c-5 5-9 7-12 7 3-3 4-6 4-9-4 4-7 5-10 5s-6-1-10-5c0 3 1 6 4 9-3 0-7-2-12-7Z" fill="url(#lgG)" />
          <circle cx="19" cy="26" r="2.1" fill="#0a0a0c" />
          <circle cx="29" cy="26" r="2.1" fill="#0a0a0c" />
          <defs>
            <linearGradient id="lgG" x1="6" y1="9" x2="42" y2="30">
              <stop stopColor="#ffd45e" />
              <stop offset="1" stopColor="#e8ab0c" />
            </linearGradient>
          </defs>
        </svg>
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
        {PROFILES.map((p, i) => (
          <motion.button
            key={p.id}
            className={'pf' + (sel === p.id ? ' sel' : '') + (sel && sel !== p.id ? ' dim' : '')}
            onClick={() => pick(p)}
            initial={{ opacity: 0, y: 18, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.07, type: 'spring', stiffness: 320, damping: 26 }}
            style={{ ['--pc' as string]: p.color }}
          >
            <span className="pf-av">
              <img className="pf-img" src={p.avatar} alt={p.name} draggable={false} />
            </span>
            <span className="pf-name">{p.name}</span>
            <span className="pf-sub">{p.sub}</span>
          </motion.button>
        ))}
      </div>

      <p className="login-hint">Elige tu local para entrar al panel</p>
    </div>
  )
}
