import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SectionHeader } from '../components/ui'
import { play } from '../lib/sound'
import { useComandas, advanceComanda, undoLastServed, colorForSrc, type Comanda, type CStatus } from '../lib/comandas'
import { isDemoMode } from '../lib/demo'

/* COMANDAS / KDS — tablero de cocina en vivo (boceto A "Mural de combate"). Las comandas vienen del TPV
   (fuente única lib/comandas) y llegan en vivo por Supabase realtime. Envejecen con un borde SEMÁFORO
   (verde→ámbar→rojo) y avanzan: Nuevas → En preparación → Listas. Botón por estado (morado/naranja/verde),
   subordinado al TEXTO de la comanda (lo primero que se ve). "Pantalla de cocina" = modo fullscreen para la
   pantalla de pared (sin chrome, letras gigantes, no se apaga). "Servida" se puede DESHACER. */

const COLS: { key: CStatus; label: string; btn: string; bclass: string; empty: string }[] = [
  { key: 'nueva', label: 'Nuevas', btn: 'Empezar', bclass: 'b-nueva', empty: 'Sin comandas nuevas' },
  { key: 'prep', label: 'En preparación', btn: 'Marcar lista', bclass: 'b-prep', empty: 'Nada en preparación' },
  { key: 'lista', label: 'Listas', btn: 'Servida ✓', bclass: 'b-lista', empty: 'Todo servido' },
]
const DELIVERY = ['Glovo', 'Uber Eats', 'Just Eat', 'Online'] // sin mesa + de estos orígenes = reparto (empaquetar)

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const hhmm = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

type Cfg = { warn: number; late: number } // segundos
const DEFAULT_CFG: Cfg = { warn: 300, late: 600 }
function loadCfg(): Cfg {
  try {
    const v = localStorage.getItem('rebell-kds-cfg')
    if (v) {
      const c = JSON.parse(v)
      if (typeof c.warn === 'number' && typeof c.late === 'number') return c
    }
  } catch {
    /* sin localStorage */
  }
  return DEFAULT_CFG
}

export default function Kds() {
  const tickets = useComandas() // fuente única: lo que manda el TPV
  const demo = isDemoMode()
  const [now, setNow] = useState(() => Date.now())
  const [cfg, setCfg] = useState<Cfg>(loadCfg)
  const [cfgOpen, setCfgOpen] = useState(false)
  const [cocina, setCocina] = useState(false) // modo pantalla de cocina (fullscreen)
  const [undo, setUndo] = useState(false) // toast "deshacer servida"
  const prevLen = useRef(tickets.length)
  const rootRef = useRef<HTMLDivElement>(null)
  const wakeRef = useRef<WakeLockSentinel | null>(null)
  const undoTimer = useRef<number | undefined>(undefined)

  const localName = (() => {
    try {
      return localStorage.getItem('rebell-profile-name') || ''
    } catch {
      return ''
    }
  })()

  // persistir la configuración de tiempos
  useEffect(() => {
    try {
      localStorage.setItem('rebell-kds-cfg', JSON.stringify(cfg))
    } catch {
      /* sin localStorage */
    }
  }, [cfg])

  // reloj a 1s para los timers + reloj de pared
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // "ding" cuando ENTRA una comanda nueva (del TPV); en pared sube un punto
  useEffect(() => {
    if (tickets.length > prevLen.current) play('pop', cocina ? 0.62 : 0.5, 1.16)
    prevLen.current = tickets.length
  }, [tickets.length, cocina])

  // ── Modo pantalla de cocina (fullscreen, calco del Mapa) ──
  async function acquireWake() {
    try {
      wakeRef.current = (await navigator.wakeLock?.request('screen')) ?? null
    } catch {
      /* iPad/Safari puede no soportarlo → degradar */
    }
  }
  function releaseWake() {
    try {
      void wakeRef.current?.release()
    } catch {
      /* noop */
    }
    wakeRef.current = null
  }
  function enterCocina() {
    setCocina(true)
    document.body.classList.add('kds-fullscreen')
    void acquireWake()
    try {
      void rootRef.current?.requestFullscreen?.().catch(() => {})
    } catch {
      /* fallback: solo la clase CSS */
    }
  }
  function exitCocina() {
    setCocina(false)
    document.body.classList.remove('kds-fullscreen')
    releaseWake()
    try {
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
    } catch {
      /* noop */
    }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cocina) exitCocina()
    }
    const onVis = () => {
      if (cocina && document.visibilityState === 'visible') void acquireWake()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [cocina])
  // limpiar al desmontar (no dejar el chrome roto)
  useEffect(
    () => () => {
      document.body.classList.remove('kds-fullscreen')
      releaseWake()
    },
    [],
  )

  function advance(t: Comanda) {
    const r = advanceComanda(t.id)
    if (r === 'served') {
      play('tap', 0.5, 1) // clic seco al servir (la recompensa se reserva para hitos, no por plato)
      setUndo(true)
      window.clearTimeout(undoTimer.current)
      undoTimer.current = window.setTimeout(() => setUndo(false), 6000)
      return
    }
    play(r === 'lista' ? 'success' : 'tap', 0.5, r === 'lista' ? 1 : 1.12)
  }
  function doUndo() {
    if (undoLastServed()) {
      play('pop', 0.45, 1.1)
      setUndo(false)
      window.clearTimeout(undoTimer.current)
    }
  }

  const ageOf = (t: Comanda) => (now - t.born) / 1000
  const ageClass = (age: number) => (age >= cfg.late ? 'late' : age >= cfg.warn ? 'warn' : 'ok')
  const lateCount = tickets.filter((t) => ageOf(t) >= cfg.late).length

  // posición de los marcadores en la leyenda de tiempos (eje 0 → late·1.2)
  const axis = cfg.late * 1.2
  const warnPct = (cfg.warn / axis) * 100
  const latePct = (cfg.late / axis) * 100

  return (
    <div className={'section kds-section' + (cocina ? ' cocina' : '')} ref={rootRef}>
      {cocina ? (
        <div className="kds-wallbar">
          <span className="wb-loc">
            REBELL{localName ? <> · <b>{localName}</b></> : null}
          </span>
          <span className="wb-clock tnum">{hhmm(now)}</span>
          <span className="wb-spacer" />
          {lateCount > 0 && <span className="wb-late">🔴 {lateCount} tarde</span>}
          <span className="wb-live"><i />En vivo</span>
          {demo && <span className="wb-demo">DEMO</span>}
          <button className="wb-exit" onClick={exitCocina}>Salir ⤢</button>
        </div>
      ) : (
        <SectionHeader
          title="Comandas"
          subtitle="Cocina en vivo"
          right={
            <div className="kds-head-r">
              {lateCount > 0 && <span className="kds-late-pill">🔴 {lateCount} tarde</span>}
              <button className={'kds-cfg-btn' + (cfgOpen ? ' on' : '')} onClick={() => setCfgOpen((o) => !o)}>⚙ Tiempos</button>
              <button className="kds-cocina-btn" onClick={enterCocina}>⛶ Pantalla de cocina</button>
            </div>
          }
        />
      )}

      {!cocina && (
        <AnimatePresence initial={false}>
          {cfgOpen && (
            <motion.div className="kds-cfg" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}>
              <div className="kcfg-inner">
                <div className="kcfg-sliders">
                  <div className="kcfg-row">
                    <label>
                      <i className="kcfg-dot w" /> Pasa a <b>ámbar</b> a los <b className="kcfg-v">{(cfg.warn / 60).toFixed(1)} min</b>
                    </label>
                    <input type="range" className="kcfg-range w" min={60} max={900} step={30} value={cfg.warn} onChange={(e) => setCfg((c) => ({ ...c, warn: Math.min(+e.target.value, c.late - 30) }))} />
                  </div>
                  <div className="kcfg-row">
                    <label>
                      <i className="kcfg-dot l" /> Pasa a <b>rojo</b> a los <b className="kcfg-v">{(cfg.late / 60).toFixed(1)} min</b>
                    </label>
                    <input type="range" className="kcfg-range l" min={120} max={1500} step={30} value={cfg.late} onChange={(e) => setCfg((c) => ({ ...c, late: Math.max(+e.target.value, c.warn + 30) }))} />
                  </div>
                  <button className="kcfg-reset" onClick={() => setCfg(DEFAULT_CFG)}>Restablecer</button>
                </div>
                <div className="kcfg-legend">
                  <div className="kcfg-grad">
                    <span className="kcfg-mark" style={{ left: warnPct + '%' }}><b>{(cfg.warn / 60).toFixed(0)}′</b></span>
                    <span className="kcfg-mark" style={{ left: latePct + '%' }}><b>{(cfg.late / 60).toFixed(0)}′</b></span>
                  </div>
                  <div className="kcfg-axis"><span>nuevo</span><span>tarde</span></div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <div className="kds-board">
        {COLS.map((col) => {
          // FIFO: la más VIEJA arriba → el cocinero ataca siempre por arriba (Juan, 30-jun)
          const list = tickets.filter((t) => t.status === col.key).slice().sort((a, b) => a.born - b.born)
          return (
            <div className="kds-col" key={col.key}>
              <div className="kds-col-head">
                <span className="kch-lab">{col.label}</span>
                <span className="kch-n">{list.length}</span>
              </div>
              <div className="kds-col-body">
                <AnimatePresence initial={false}>
                  {list.map((t) => {
                    const cls = ageClass(ageOf(t))
                    const rep = !t.mesa && DELIVERY.includes(t.src)
                    return (
                      <motion.div
                        key={t.id}
                        layout
                        className={'kds-ticket ' + cls}
                        style={{ ['--plat']: colorForSrc(t.src) } as CSSProperties}
                        initial={{ opacity: 0, scale: 0.94, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.93, transition: { duration: 0.18 } }}
                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                      >
                        <div className="kt-top">
                          <span className="kt-title">{t.mesa ? 'Mesa ' + t.mesa : rep ? '🛵 Reparto' : t.src}</span>
                          <span className="kt-n">#{t.n}</span>
                          <span className="kt-time tnum">{mmss(now - t.born)}</span>
                        </div>
                        <div className="kt-sub">
                          {rep && <span className="kt-plat">{t.src.toUpperCase()}</span>}
                          {cls === 'late' && <span className="kt-late">TARDE</span>}
                        </div>
                        <div className="kt-items">
                          {t.items.map((it, i) => (
                            <div className="kt-item" key={i}>
                              <span className="kt-q tnum">{it.qty}×</span>
                              <span className="kt-name">{it.name}</span>
                              {it.note && <span className="kt-note">{it.note}</span>}
                              {it.aler && <span className="kt-aler">{it.aler}</span>}
                            </div>
                          ))}
                        </div>
                        <button className={'kt-btn ' + col.bclass} onClick={() => advance(t)}>{col.btn}</button>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
                {list.length === 0 && <div className="kds-empty">{col.empty}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {undo && (
        <div className="kds-undo">
          <span>Comanda servida</span>
          <button onClick={doUndo}>Deshacer</button>
        </div>
      )}
    </div>
  )
}
