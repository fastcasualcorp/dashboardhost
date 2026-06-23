import { useEffect, useState, type PointerEvent as RPointerEvent } from 'react'
import { AnimatePresence } from 'motion/react'
import { gsap } from 'gsap'
import { NAV, ALL_ITEMS, itemById, Icon } from '../nav'
import { reduceMotion } from '../lib/data'
import { play, preloadSfx, setAudio } from '../lib/sound'
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

  // ARRANQUE cinemático: al montar una sección, sus bloques entran en cascada
  // (sube + aparece, escalonado). Energía "sazabi" con piel premium. Solo
  // transform/opacity; clearProps deja el DOM intacto (no rompe coverflow ni sticky).
  useEffect(() => {
    if (reduceMotion()) return
    const root = document.querySelector('.panel-content')
    if (!root) return
    const blocks = root.querySelectorAll(':scope > .section > *, :scope > .caja > .wrap > *, :scope > .wrap > *')
    if (!blocks.length) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        blocks,
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.52, stagger: 0.055, ease: 'power3.out', clearProps: 'transform,opacity' },
      )
    })
    return () => ctx.revert()
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
  }

  // La bestia de la barra cobra vida: la cabeza sigue al cursor (tilt 3D + parallax),
  // como el avatar del login. One-shot (sin loops infinitos → no calienta el móvil).
  function tiltBeast(e: RPointerEvent<HTMLButtonElement>) {
    const img = e.currentTarget.querySelector('.side-beast') as HTMLElement | null
    if (!img) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    img.style.transform = `perspective(320px) rotateX(${(-py * 16).toFixed(1)}deg) rotateY(${(px * 20).toFixed(1)}deg) scale(1.09)`
  }
  function untiltBeast(e: RPointerEvent<HTMLButtonElement>) {
    const img = e.currentTarget.querySelector('.side-beast') as HTMLElement | null
    if (img) img.style.transform = ''
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

  const cur = itemById(active)

  return (
    <div className="app" data-type={font === 'clash' ? undefined : font} data-theme={theme} data-accent={accent}>
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
        <button className={'side-brand' + (settingsOpen ? ' open' : '')} onClick={openSettings} onPointerMove={tiltBeast} onPointerLeave={untiltBeast} aria-label="Perfil y ajustes del negocio">
          <img className="side-beast" src={beastById(beast).img} alt="" draggable={false} />
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
          <div className="pt-title">
            <b>{cur?.t}</b>
            <small>{cur?.s}</small>
          </div>
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

      <EditLayer />
      <CommentLayer on={commentsOn} setOn={setCommentsOn} active={active} />
    </div>
  )
}
