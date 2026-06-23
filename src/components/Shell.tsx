import { useEffect, useState, type PointerEvent as RPointerEvent } from 'react'
import { AnimatePresence } from 'motion/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)
import { NAV, ALL_ITEMS, itemById, Icon } from '../nav'
import { reduceMotion } from '../lib/data'
import { play, playBeast, preloadSfx, setAudio } from '../lib/sound'
import SettingsPanel, { type FontKey, type AccentKey } from './SettingsPanel'
import EditLayer from './EditLayer'
import CommentLayer from './CommentLayer'
import { beastById } from '../lib/beasts'
import { renderSection } from '../sections/registry'

type Theme = 'dark' | 'light'

export default function Shell() {
  const [active, setActive] = useState<string>(() => {
    try {
      const s = localStorage.getItem('rebell-active')
      if (s && itemById(s)) return s
    } catch {
      /* sin localStorage (modo privado) */
    }
    return 'caja'
  })
  const [font, setFont] = useState<FontKey>('clash')
  const [audioOn, setAudioOn] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [commentsOn, setCommentsOn] = useState(() => {
    try {
      return localStorage.getItem('rebell-comments-on') === '1'
    } catch {
      return false
    }
  })
  const [drawer, setDrawer] = useState(false)
  // Modo offline: avisamos cuando se cae la red (la app sigue con datos guardados).
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('rebell-theme') === 'light') return 'light'
    return 'dark'
  })
  const [accent, setAccent] = useState<AccentKey>(() => {
    const a = typeof localStorage !== 'undefined' ? localStorage.getItem('rebell-accent') : null
    return (a as AccentKey) || 'gold'
  })
  const [beast, setBeast] = useState<string>(() => {
    try {
      return localStorage.getItem('rebell-beast') || 'lion'
    } catch {
      return 'lion'
    }
  })
  // Densidad ajustable (compacto/normal/cómodo) → multiplica los tamaños fluidos.
  // localStorage es por-dispositivo, así que se recuerda en cada pantalla (pedido de Juan).
  const [density, setDensity] = useState<number>(() => {
    const v = typeof localStorage !== 'undefined' ? parseFloat(localStorage.getItem('rebell-density') || '') : NaN
    return v >= 0.8 && v <= 1.3 ? v : 1
  })
  function changeDensity(d: number) {
    setDensity(d)
    try {
      localStorage.setItem('rebell-density', String(d))
    } catch {
      /* sin localStorage */
    }
    play('tap')
  }
  const localName = (() => {
    try {
      return localStorage.getItem('rebell-profile-name') || 'Bertamiráns'
    } catch {
      return 'Bertamiráns'
    }
  })()

  useEffect(() => {
    preloadSfx()
  }, [])

  // Escuchar caídas/recuperación de red para el aviso de modo offline.
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  // Recordar la sección activa entre recargas (no volver siempre a Caja).
  useEffect(() => {
    try {
      localStorage.setItem('rebell-active', active)
    } catch {
      /* sin localStorage */
    }
  }, [active])

  // Recordar si el modo comentarios estaba activo (las notas siguen visibles al volver).
  useEffect(() => {
    try {
      localStorage.setItem('rebell-comments-on', commentsOn ? '1' : '0')
    } catch {
      /* sin localStorage */
    }
  }, [commentsOn])

  // SCROLL cinemático: los bloques no aparecen todos de golpe — se revelan en
  // cascada A MEDIDA que entran en pantalla al hacer scroll (energía "sazabi" con
  // piel premium). Los que ya están a la vista al cargar se revelan al instante.
  // Solo transform/opacity; clearProps deja el DOM intacto (no rompe sticky/coverflow).
  useEffect(() => {
    if (reduceMotion()) return
    const root = document.querySelector('.panel-content')
    if (!root) return
    const blocks = Array.from(root.querySelectorAll(':scope > .section > *, :scope > .caja > .wrap > *, :scope > .wrap > *')) as HTMLElement[]
    if (!blocks.length) return
    const reveal = (els: Element[] | HTMLElement[]) =>
      gsap.to(els, { y: 0, opacity: 1, duration: 0.62, stagger: 0.07, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity' })
    let guard = 0
    const ctx = gsap.context(() => {
      gsap.set(blocks, { y: 28, opacity: 0 })
      ScrollTrigger.batch(blocks, { start: 'top 86%', once: true, onEnter: reveal })
      ScrollTrigger.refresh()
      // Red de seguridad: si por lo que sea un bloque se quedara oculto, lo mostramos.
      guard = window.setTimeout(() => {
        const stuck = blocks.filter((b) => parseFloat(getComputedStyle(b).opacity) < 0.05)
        if (stuck.length) reveal(stuck)
      }, 1400)
    })
    return () => {
      window.clearTimeout(guard)
      ctx.revert()
    }
  }, [active])

  // Borde dorado spotlight que sigue el cursor en TODAS las tarjetas (.panel-card),
  // no solo en la Caja. Un único listener delegado para las actuales y las futuras.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const card = (e.target as HTMLElement | null)?.closest?.('.panel-card') as HTMLElement | null
      if (!card) return
      const r = card.getBoundingClientRect()
      card.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%')
      card.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%')
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => document.removeEventListener('pointermove', onMove)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('rebell-theme', theme)
    } catch {
      /* sin localStorage (modo privado) */
    }
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
    play('tap')
  }
  function changeAccent(a: AccentKey) {
    setAccent(a)
    try {
      localStorage.setItem('rebell-accent', a)
    } catch {
      /* sin localStorage */
    }
    play('tap')
  }
  function changeBeast(id: string) {
    setBeast(id)
    try {
      localStorage.setItem('rebell-beast', id)
    } catch {
      /* sin localStorage */
    }
    // la bestia trae su color → cambiamos también el acento (changeAccent ya suena)
    changeAccent(beastById(id).accent as AccentKey)
    // y se anuncia con su firma sonora propia
    playBeast(id, 0.7)
  }

  // La bestia de la barra cobra vida: al entrar el cursor arranca su guiño (vídeo)
  // y suena su firma, sutil. Al moverse, la cabeza sigue al cursor (tilt 3D). One-shot
  // (el vídeo se pausa y rebobina al salir → sin loops infinitos que calientan el móvil).
  function enterBeast(e: RPointerEvent<HTMLButtonElement>) {
    const vid = e.currentTarget.querySelector('.side-beast-vid') as HTMLVideoElement | null
    if (vid && vid.paused) {
      vid.play().catch(() => {})
      playBeast(beast, 0.4)
    }
  }
  function tiltBeast(e: RPointerEvent<HTMLButtonElement>) {
    const wrap = e.currentTarget.querySelector('.side-av') as HTMLElement | null
    if (!wrap) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    wrap.style.transform = `perspective(320px) rotateX(${(-py * 16).toFixed(1)}deg) rotateY(${(px * 20).toFixed(1)}deg) scale(1.09)`
  }
  function untiltBeast(e: RPointerEvent<HTMLButtonElement>) {
    const wrap = e.currentTarget.querySelector('.side-av') as HTMLElement | null
    if (wrap) wrap.style.transform = ''
    const vid = e.currentTarget.querySelector('.side-beast-vid') as HTMLVideoElement | null
    if (vid) {
      vid.pause()
      vid.currentTime = 0
    }
  }

  function selectSection(id: string) {
    if (id !== active) {
      setActive(id)
      // Identidad sonora por sección: la misma muestra (nav) a distinto tono, en
      // escala mayor (do-re-mi-fa-sol) según su posición → cada zona "suena" distinta.
      const idx = ALL_ITEMS.findIndex((i) => i.id === id)
      const SEMIS = [0, 2, 4, 5, 7]
      const rate = Math.pow(2, SEMIS[((idx % 5) + 5) % 5] / 12)
      play('nav', 0.38, rate)
    }
    setDrawer(false)
  }
  function toggleAudio() {
    const next = !audioOn
    setAudioOn(next)
    setAudio(next)
    if (next) play('tap')
  }
  function changeFont(f: FontKey) {
    setFont(f)
    play('nav')
  }
  function openSettings() {
    setSettingsOpen((o) => !o)
    setDrawer(false)
    play('tap')
  }

  return (
    <div className="app" data-type={font === 'clash' ? undefined : font} data-theme={theme} data-accent={accent} style={{ ['--den' as string]: density }}>
      <div className="bg-aura" />
      <div className="grain" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg">
          <filter id="n">
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#n)" opacity=".4" />
        </svg>
      </div>

      <aside className={'sidebar' + (drawer ? ' open' : '')}>
        <button
          className={'side-brand' + (settingsOpen ? ' open' : '')}
          onClick={openSettings}
          onPointerEnter={enterBeast}
          onPointerMove={tiltBeast}
          onPointerLeave={untiltBeast}
          aria-label="Perfil y ajustes del negocio"
        >
          <span className="side-av">
            <img className="side-beast" src={beastById(beast).img} alt="" draggable={false} />
            {beastById(beast).video && (
              <video className="side-beast-vid" src={beastById(beast).video} muted loop playsInline preload="none" poster={beastById(beast).img} />
            )}
          </span>
          <div className="sb-txt">
            <b>REBELL</b>
            <span>{localName}</span>
          </div>
          <svg className="sb-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <nav className="side-nav">
          {NAV.map((group) => (
            <div className="nav-group" key={group.g}>
              <div className="ng-label">{group.g}</div>
              {group.items.map((it) => (
                <button key={it.id} className={'nav-item' + (active === it.id ? ' on' : '')} onClick={() => selectSection(it.id)}>
                  <span className="ni-ic">
                    <Icon name={it.id} />
                  </span>
                  <span className="ni-txt">{it.t}</span>
                  {it.tag ? (
                    <span className={'ni-tag' + (it.alert ? ' pulse' : '')}>{it.tag}</span>
                  ) : (
                    it.alert && <span className={'ni-dot a-' + it.alert} />
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}

      <div className="panel-main">
        <header className="panel-top">
          <button className="iconbtn only-mobile" onClick={() => setDrawer(true)} aria-label="Abrir menú">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <div className="top-actions">
            <button className="iconbtn theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Cambiar a tema día' : 'Cambiar a tema noche'} aria-pressed={theme === 'light'}>
              <span className="tt-track">
                <svg className="tt-ic tt-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
                </svg>
                <svg className="tt-ic tt-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4.2" />
                  <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
                </svg>
              </span>
            </button>
            <button className={'iconbtn' + (audioOn ? '' : ' off')} onClick={toggleAudio} aria-label="Sonido">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
              </svg>
            </button>
            <span className="daypill only-wide">
              <span className="dot" />
              Sáb 21 jun · 23:46
            </span>
          </div>
        </header>

        <main className="panel-content" key={active}>
          {renderSection(active)}
        </main>
      </div>

      <AnimatePresence>
        {settingsOpen && (
          <>
            <div className="sp-scrim" onClick={() => setSettingsOpen(false)} />
            <SettingsPanel
              font={font}
              onFont={changeFont}
              accent={accent}
              onAccent={changeAccent}
              beast={beast}
              onBeast={changeBeast}
              density={density}
              onDensity={changeDensity}
              comments={commentsOn}
              onComments={() => {
                setCommentsOn((c) => !c)
                setSettingsOpen(false)
                play('toggle')
              }}
            />
          </>
        )}
      </AnimatePresence>

      <div className={'offline-pill' + (online ? '' : ' show')} role="status" aria-live="polite">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l22 22M16.7 11.1a6 6 0 0 1 3.6 1.8M5 12.6A10 10 0 0 1 9 10.3m-6 -.7a14 14 0 0 1 4-2.4M8.5 16.1a6 6 0 0 1 6.9 0M12 20h.01" />
        </svg>
        Sin conexión · viendo datos guardados
      </div>

      <EditLayer />
      <CommentLayer on={commentsOn} setOn={setCommentsOn} active={active} />
    </div>
  )
}
