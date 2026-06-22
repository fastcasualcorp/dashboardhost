import { useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { NAV, ALL_ITEMS, itemById, Icon } from '../nav'
import { play, preloadSfx, setAudio } from '../lib/sound'
import SettingsPanel, { type FontKey, type AccentKey } from './SettingsPanel'
import { renderSection } from '../sections/registry'

const Horns = () => (
  <svg className="horns" viewBox="0 0 48 48" fill="none">
    <path d="M6 13c0 11 6 17 18 17S42 24 42 13c-5 5-9 7-12 7 3-3 4-6 4-9-4 4-7 5-10 5s-6-1-10-5c0 3 1 6 4 9-3 0-7-2-12-7Z" fill="url(#gg)" />
    <circle className="eye" cx="19" cy="26" r="2.1" fill="#08080a" />
    <circle className="eye" cx="29" cy="26" r="2.1" fill="#08080a" />
    <defs>
      <linearGradient id="gg" x1="6" y1="9" x2="42" y2="30">
        <stop stopColor="#ffd45e" />
        <stop offset="1" stopColor="#e8ab0c" />
      </linearGradient>
    </defs>
  </svg>
)

type Theme = 'dark' | 'light'

export default function Shell() {
  const [active, setActive] = useState('caja')
  const [font, setFont] = useState<FontKey>('clash')
  const [audioOn, setAudioOn] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('rebell-theme') === 'light') return 'light'
    return 'dark'
  })
  const [accent, setAccent] = useState<AccentKey>(() => {
    const a = typeof localStorage !== 'undefined' ? localStorage.getItem('rebell-accent') : null
    return (a as AccentKey) || 'gold'
  })

  useEffect(() => {
    preloadSfx()
  }, [])

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
        <button className={'side-brand' + (settingsOpen ? ' open' : '')} onClick={openSettings} aria-label="Perfil y ajustes del negocio">
          <Horns />
          <div className="sb-txt">
            <b>REBELL</b>
            <span>Bertamiráns</span>
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
            <SettingsPanel font={font} onFont={changeFont} accent={accent} onAccent={changeAccent} />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
