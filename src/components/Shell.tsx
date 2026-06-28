import { useEffect, useState, lazy, Suspense, type PointerEvent as RPointerEvent } from 'react'
import { AnimatePresence } from 'motion/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)
import { NAV, ALL_ITEMS, itemById } from '../nav'
import { reduceMotion } from '../lib/data'
import { play, playBeast, playPowerup, preloadSfx, setAudio } from '../lib/sound'
import SettingsPanel, { type FontKey, type AccentKey } from './SettingsPanel'
import CommentLayer from './CommentLayer'
import ErrorBoundary from './ErrorBoundary'
import Clock from './Clock'
import HealthDot from './HealthDot'
import WalletHoy from './WalletHoy'
import DeployBadge from './DeployBadge'
import LogoMark, { type LogoVariant } from './LogoMark'
import { beastById } from '../lib/beasts'
import { isDemoMode, setDemoMode } from '../lib/demo'
import { renderSection } from '../sections/registry'
import { applySavedDesign } from '../lib/designTokens'
// Canon es una herramienta interna grande → lazy (fuera del bundle inicial; solo carga al abrirla).
const Canon = lazy(() => import('../sections/Canon'))

// Emoji animado por sección del menú lateral (bob sutil; ver .ni-emo en index.css).
const NAV_EMOJI: Record<string, string> = {
  caja: '💰', tpv: '🛒', salon: '🪑', pedidos: '🛵', kds: '🍳',
  mapa: '🛰️', resumen: '📊', cuadro: '📈', mensual: '🗓️', gastos: '🧾',
  ventas: '📅', ventastpv: '📖', empleados: '👥', horarios: '⏰', coste: '💶',
  foodcost: '🍔', stock: '📦', compras: '🛍️', ingresos: '🏦',
}

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
  const [font, setFont] = useState<FontKey>('inter') // Inter = fuente principal (Juan 28-jun)
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
  // El reloj de la cabecera vive AISLADO en <Clock/> → su tick ya no re-renderiza toda la app (perf).
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
  // Variante del logo FAT SMASH: 'b' (con barras, por defecto) o 'a' (solo lettering).
  const [logoVar, setLogoVar] = useState<LogoVariant>(() => {
    try {
      return (localStorage.getItem('rebell-logo') as LogoVariant) === 'a' ? 'a' : 'b'
    } catch {
      return 'b'
    }
  })
  function changeLogo(v: LogoVariant) {
    setLogoVar(v)
    try { localStorage.setItem('rebell-logo', v) } catch { /* sin localStorage */ }
    play('tap', 0.5, 1.1)
  }
  // Densidad ajustable (compacto/normal/cómodo) → multiplica los tamaños fluidos.
  // localStorage es por-dispositivo, así que se recuerda en cada pantalla (pedido de Juan).
  const [density, setDensity] = useState<number>(() => {
    const v = typeof localStorage !== 'undefined' ? parseFloat(localStorage.getItem('rebell-density') || '') : NaN
    return v >= 0.8 && v <= 1.3 ? v : 1
  })
  // Ancho del menú lateral AJUSTABLE arrastrando su borde (Juan, 28-jun). Gobierna --side-w,
  // del que ya cuelgan el margen del contenido, la actionbar y el plano del TPV → todo lo sigue.
  const [sideW, setSideW] = useState<number>(() => {
    const v = typeof localStorage !== 'undefined' ? parseFloat(localStorage.getItem('rebell-sidew') || '') : NaN
    return v >= 220 && v <= 460 ? v : 264
  })
  const [resizing, setResizing] = useState(false)
  function startResize(e: RPointerEvent<HTMLDivElement>) {
    e.preventDefault()
    const startX = e.clientX
    const startW = sideW
    let cur = startW
    setResizing(true)
    play('tap')
    const move = (ev: PointerEvent) => {
      cur = Math.max(220, Math.min(460, Math.round(startW + (ev.clientX - startX))))
      setSideW(cur)
    }
    const up = () => {
      setResizing(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      try { localStorage.setItem('rebell-sidew', String(cur)) } catch { /* sin localStorage */ }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  function resetSide() {
    setSideW(264)
    try { localStorage.setItem('rebell-sidew', '264') } catch { /* sin localStorage */ }
    play('toggle')
  }
  // Modo presentación: al entrar en cualquier sección suena un power-up coordinado con el count-up de las cifras.
  const [present, setPresent] = useState<boolean>(() => typeof localStorage !== 'undefined' && localStorage.getItem('rebell-present') === '1')
  function togglePresent() {
    setPresent((p) => {
      const n = !p
      try { localStorage.setItem('rebell-present', n ? '1' : '0') } catch { /* sin localStorage */ }
      if (n) playPowerup(0.5)
      else play('toggle', 0.4)
      return n
    })
  }
  function changeDensity(d: number) {
    setDensity(d)
    try {
      localStorage.setItem('rebell-density', String(d))
    } catch {
      /* sin localStorage */
    }
    play('tap')
  }
  useEffect(() => {
    preloadSfx()
    applySavedDesign() // re-aplica la escala tipográfica + botones guardados en el panel "Sistema de diseño"
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

  // Iconos VIVOS: el icono de la sección activa hace un flourish al seleccionarla
  // (pop elástico + destello). One-shot, clearProps deja el DOM intacto (el hover CSS sigue).
  useEffect(() => {
    if (reduceMotion()) return
    const ic = document.querySelector('.nav-item.on .ni-emo')
    if (!ic) return
    const ctx = gsap.context(() => {
      gsap.fromTo(ic, { scale: 0.55, rotate: -18 }, { scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(3)', clearProps: 'transform' })
      gsap.fromTo(ic, { filter: 'brightness(2.3)' }, { filter: 'brightness(1)', duration: 0.5, ease: 'power2.out', clearProps: 'filter' })
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
      // Modo presentación: el "marcador se enciende" → power-up coordinado con el count-up de las cifras.
      if (present) window.setTimeout(() => playPowerup(0.5), 90)
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

  // Identidad del LOCAL para la cabecera persistente (visible en TODAS las pestañas → el dueño con varios
  // locales sabe siempre en cuál está). Nombre/ciudad del perfil guardado; plan visible y clicable.
  const localName = (typeof localStorage !== 'undefined' && localStorage.getItem('rebell-profile-name')) || 'Bertamiráns'
  const localId = (typeof localStorage !== 'undefined' && localStorage.getItem('rebell-profile')) || 'bertamirans'
  const LOCAL_CITY: Record<string, string> = { bertamirans: 'A Coruña · España', madrid: 'Madrid · España', barcelona: 'Barcelona · España', central: 'Sede central · España' }
  const localCity = LOCAL_CITY[localId] || 'España'

  return (
    <div className="app" data-type={font === 'clash' ? undefined : font} data-theme={theme} data-accent={accent} data-resizing={resizing ? '1' : undefined} style={{ ['--den' as string]: density, ['--side-w' as string]: sideW + 'px' }}>
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
        {/* Logo del programa (FAT SMASH), bien visible encima del león (Juan 28-jun). Versión negativa para fondo oscuro. */}
        <LogoMark variant={logoVar} className="side-logo" />
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
          {/* Texto "REBELL · Bertamiráns" QUITADO: ya está en la cabecera de Caja, y el logo nuevo lo incluirá (Juan 28-jun). */}
        </button>
        <nav className="side-nav">
          {NAV.map((group) => (
            <div className="nav-group" key={group.g}>
              <div className={'ng-label' + (group.accent ? ' ng-ia' : '')}>
                {group.accent ? <><span className="ng-ia-spark">✦</span>{group.g}</> : group.g}
              </div>
              {group.items.map((it) => (
                <button key={it.id} className={'nav-item' + (active === it.id ? ' on' : '')} onClick={() => selectSection(it.id)}>
                  <span className="ni-ic ni-emo" aria-hidden="true">{NAV_EMOJI[it.id] || '•'}</span>
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
        <DeployBadge />
      </aside>
      {/* Borde arrastrable para ensanchar el menú (solo escritorio). Doble clic = restaurar. */}
      <div
        className="side-resize"
        onPointerDown={startResize}
        onDoubleClick={resetSide}
        role="separator"
        aria-orientation="vertical"
        aria-label="Ajustar ancho del menú"
        title="Arrastra para ensanchar · doble clic para restaurar"
      />
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}

      <div className={'panel-main' + (active === 'caja' ? ' caja-full' : '')}>
        <header className="panel-top">
          <button className="iconbtn only-mobile" onClick={() => setDrawer(true)} aria-label="Abrir menú">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          {/* Identidad del local SIEMPRE visible (todas las pestañas) — el cliente sabe en qué local está. */}
          <div className="top-ident">
            <span className="ti-flag" aria-hidden="true" />
            <div className="ti-tx">
              <b>REBELL · {localName}</b>
              <span>{localCity}</span>
            </div>
          </div>
          <div className="top-actions">
            {/* Plan SIEMPRE visible y clicable (movido desde Ajustes) → abre la pantalla de Planes. */}
            <button className="plan-pill" onClick={() => window.dispatchEvent(new Event('rebell:open-planes'))} title="Tu plan · ver y cambiar">
              <span className="plan-pill-ic" aria-hidden="true">◆</span> Plan <b>Pro</b>
            </button>
            {isDemoMode() && (
              <button className="demo-pill" onClick={() => setDemoMode(false)} title="Estás viendo datos de ejemplo. Pulsa para volver a los datos reales.">
                <span className="demo-dot" /> MODO DEMO
              </button>
            )}
            <WalletHoy />
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
            <HealthDot />
            <Clock />
          </div>
        </header>

        <main className="panel-content" key={active}>
          <ErrorBoundary section={active}>
            {active === 'canon' ? (
              <Suspense fallback={<div className="section-loading" aria-busy="true"><span className="sl-pulse" /></div>}>
                <Canon
                  accent={accent}
                  onAccent={changeAccent}
                  font={font}
                  onFont={changeFont}
                  theme={theme}
                  onTheme={toggleTheme}
                  density={density}
                  onDensity={changeDensity}
                />
              </Suspense>
            ) : (
              renderSection(active)
            )}
          </ErrorBoundary>
        </main>

        {/* Barra de pestañas inferior (solo móvil) — patrón nativo tipo Revolut. Las 4 vistas más usadas
            + "Más" (abre el menú completo). Oscura en ambos temas (cockpit). No aparece en la Caja inmersiva. */}
        <nav className="btab" aria-label="Navegación rápida">
          {[{ id: 'caja', t: 'Caja' }, { id: 'tpv', t: 'TPV' }, { id: 'mapa', t: 'Rivales' }, { id: 'resumen', t: 'Resumen' }].map((tab) => (
            <button key={tab.id} className={'btab-i' + (active === tab.id ? ' on' : '')} onClick={() => selectSection(tab.id)} aria-current={active === tab.id ? 'page' : undefined}>
              <span className="btab-emo" aria-hidden="true">{NAV_EMOJI[tab.id]}</span>
              <span className="btab-lb">{tab.t}</span>
            </button>
          ))}
          <button className={'btab-i' + (drawer ? ' on' : '')} onClick={() => setDrawer(true)} aria-label="Abrir menú completo">
            <span className="btab-emo" aria-hidden="true">☰</span>
            <span className="btab-lb">Más</span>
          </button>
        </nav>
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
              present={present}
              onPresent={togglePresent}
              comments={commentsOn}
              onComments={() => {
                setCommentsOn((c) => !c)
                setSettingsOpen(false)
                play('toggle')
              }}
              onCanon={() => {
                setSettingsOpen(false)
                selectSection('canon')
              }}
              logoVar={logoVar}
              onLogo={changeLogo}
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

      <CommentLayer on={commentsOn} setOn={setCommentsOn} active={active} />
    </div>
  )
}
