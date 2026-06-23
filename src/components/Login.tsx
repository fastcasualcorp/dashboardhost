import { useEffect, useState, type MouseEvent, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { play, playBeast, preloadSfx } from '../lib/sound'
import { beastById } from '../lib/beasts'
import { reduceMotion } from '../lib/data'
import { supabase, hasSupabase } from '../lib/supabase'

// Fondos de cocina que rotan en bucle (pantalla de carga estilo videojuego),
// con crossfade suave. El primero es el de siempre; el resto se generaron aparte.
const BGS = ['/img/login-bg.jpg', '/img/login-bg-2.jpg', '/img/login-bg-3.jpg', '/img/login-bg-4.jpg']

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
  const [bgIdx, setBgIdx] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [pw, setPw] = useState('Rebell2026!') // pre-rellena la contraseña de demo
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const selProfile = PROFILES.find((p) => p.id === sel) || null

  // Precargar el sonido YA en el login (antes el motor se preparaba en Shell, que
  // monta DESPUÉS → el primer clic disparaba la carga y sonaba con ~1s de retraso).
  useEffect(() => {
    preloadSfx()
  }, [])

  // Rotación de fondos en bucle, suave. Se para al salir (sel) y con reduce-motion.
  useEffect(() => {
    if (sel || reduceMotion() || BGS.length < 2) return
    const t = window.setInterval(() => setBgIdx((i) => (i + 1) % BGS.length), 7500)
    return () => window.clearInterval(t)
  }, [sel])

  // Al entrar el cursor: la bestia cobra vida (idle + guiño) Y suena su FIRMA sonora,
  // una sola vez (mouseenter, no en cada mousemove → no se solapa ni cansa).
  function enter(p: Profile, e: MouseEvent<HTMLButtonElement>) {
    if (sel) return
    const vid = e.currentTarget.querySelector('.pf-vid') as HTMLVideoElement | null
    if (vid) {
      if (vid.paused) {
        vid.play().catch(() => {})
        playBeast(p.beast, 0.5)
      }
    } else {
      // sin vídeo aún (bestias pendientes): el sonido marca igualmente el carácter
      playBeast(p.beast, 0.5)
    }
  }

  // Avatar vivo: la cabeza sigue al cursor (tilt 3D + parallax SUTIL de la imagen).
  function tilt(e: MouseEvent<HTMLButtonElement>) {
    if (sel) return
    const btn = e.currentTarget
    const av = btn.querySelector('.pf-av') as HTMLElement | null
    const img = btn.querySelector('.pf-img') as HTMLElement | null
    const vid = btn.querySelector('.pf-vid') as HTMLVideoElement | null
    if (vid && vid.paused) vid.play().catch(() => {}) // la bestia cobra vida (idle + guiño)
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
    const vid = btn.querySelector('.pf-vid') as HTMLVideoElement | null
    if (vid) {
      vid.pause()
      vid.currentTime = 0
    }
    if (av) av.style.transform = ''
    if (img) img.style.transform = ''
  }

  // Elegir local → se resalta y pide la contraseña (no entra todavía).
  function pick(p: Profile) {
    if (sel) return
    setSel(p.id)
    setErr(false)
    play('tap', 0.5, 1.22)
    playBeast(p.beast, 0.8) // la bestia se anuncia al elegir
  }

  // Autenticar de verdad (Supabase). Sin backend → modo demo (entra directo).
  async function entrar(ev?: FormEvent) {
    ev?.preventDefault()
    const p = selProfile
    if (!p || busy) return
    if (!hasSupabase || !supabase) {
      finish(p)
      return
    }
    setBusy(true)
    setErr(false)
    const { error } = await supabase.auth.signInWithPassword({ email: `${p.id}@rebell.app`, password: pw })
    setBusy(false)
    if (error) {
      setErr(true)
      play('error', 0.4)
      return
    }
    finish(p)
  }
  function finish(p: Profile) {
    play('success', 0.4, 1.12)
    setLeaving(true)
    window.setTimeout(() => onEnter(p), 700)
  }
  function cancelar() {
    setSel(null)
    setErr(false)
    play('tap', 0.4, 0.85)
  }

  // Parallax 2.5D del fondo: la cocina se desplaza un poco con el cursor.
  function bgParallax(e: MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const px = e.clientX / window.innerWidth - 0.5
    const py = e.clientY / window.innerHeight - 0.5
    el.style.setProperty('--bgx', (px * -10).toFixed(1) + 'px')
    el.style.setProperty('--bgy', (py * -8).toFixed(1) + 'px')
  }

  return (
    <div className={'login' + (leaving ? ' leaving' : '')} onMouseMove={bgParallax}>
      <div className="login-bgs" aria-hidden="true">
        {BGS.map((src, i) => (
          <div key={src} className={'login-layer' + (i === bgIdx ? ' on' : '')} style={{ backgroundImage: `url(${src})` }}>
            <div className="login-layer-blur" style={{ backgroundImage: `url(${src})` }} />
          </div>
        ))}
      </div>
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
              onMouseEnter={(e) => enter(p, e)}
              onMouseMove={tilt}
              onMouseLeave={untilt}
              initial={{ opacity: 0, y: 18, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.07, type: 'spring', stiffness: 320, damping: 26 }}
              style={{ ['--pc' as string]: beast.color }}
            >
              <span className="pf-av">
                <img className="pf-img" src={beast.img} alt={p.name} draggable={false} />
                {beast.video && <video className="pf-vid" src={beast.video} muted loop playsInline preload="none" poster={beast.img} />}
              </span>
              <span className="pf-name">{p.name}</span>
              <span className="pf-sub">{p.sub}</span>
            </motion.button>
          )
        })}
      </div>

      {selProfile ? (
        <motion.form
          className={'login-auth' + (err ? ' err' : '')}
          onSubmit={entrar}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        >
          <div className="la-who">
            Entrar como <b>{selProfile.name}</b>
          </div>
          <div className="la-field">
            <input
              type="password"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value)
                setErr(false)
              }}
              placeholder="Contraseña"
              autoFocus
              autoComplete="current-password"
            />
            <button type="submit" className="la-go" disabled={busy || !pw}>
              {busy ? '…' : 'Entrar'}
            </button>
          </div>
          {err && <div className="la-err">Contraseña incorrecta</div>}
          <div className="la-bottom">
            <button type="button" className="la-cancel" onClick={cancelar}>
              ‹ Cambiar de local
            </button>
            <span className="la-demo">Demo: Rebell2026!</span>
          </div>
        </motion.form>
      ) : (
        <p className="login-hint">Elige tu local para entrar al panel</p>
      )}
      </div>
    </div>
  )
}
