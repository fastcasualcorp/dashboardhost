import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SectionHeader, Badge } from '../components/ui'
import { play, playReward } from '../lib/sound'
import { useComandas, advanceComanda, type Comanda, type CStatus } from '../lib/comandas'

/* KDS — tablero de cocina en vivo. Las comandas vienen del TPV (fuente única `lib/comandas`):
   al pulsar "Comanda" en el TPV aparecen aquí al instante. Envejecen con un gradiente CONTINUO
   verde→ámbar→rojo y avanzan: Nuevas → En preparación → Listas. Los TIEMPOS (cuándo vira a ámbar
   y a rojo) se configuran con sliders y se guardan por dispositivo. */

const COLS: { key: CStatus; label: string }[] = [
  { key: 'nueva', label: 'Nuevas' },
  { key: 'prep', label: 'En preparación' },
  { key: 'lista', label: 'Listas' },
]

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Color CONTINUO del timer según la fracción de edad (0=verde → .5=ámbar → 1=rojo).
const STOPS = [
  [52, 211, 153],
  [245, 179, 65],
  [255, 92, 92],
]
function ageColor(p: number) {
  const x = Math.max(0, Math.min(1, p))
  const seg = x < 0.5 ? 0 : 1
  const t = x < 0.5 ? x / 0.5 : (x - 0.5) / 0.5
  const a = STOPS[seg]
  const b = STOPS[seg + 1]
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
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
  const [now, setNow] = useState(() => Date.now())
  const [cfg, setCfg] = useState<Cfg>(loadCfg)
  const [cfgOpen, setCfgOpen] = useState(false)
  const prevLen = useRef(tickets.length)

  // persistir la configuración de tiempos
  useEffect(() => {
    try {
      localStorage.setItem('rebell-kds-cfg', JSON.stringify(cfg))
    } catch {
      /* sin localStorage */
    }
  }, [cfg])

  // reloj a 1s para los timers
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // "ding" crispy cuando ENTRA una comanda nueva (del TPV)
  useEffect(() => {
    if (tickets.length > prevLen.current) play('pop', 0.5, 1.16)
    prevLen.current = tickets.length
  }, [tickets.length])

  function advance(t: Comanda) {
    const r = advanceComanda(t.id)
    if (r === 'served') {
      playReward(0.55) // servida = recompensa crispy
      return
    }
    play(r === 'lista' ? 'success' : 'tap', 0.5, r === 'lista' ? 1 : 1.12)
  }

  const ageClass = (age: number) => (age >= cfg.late ? 'late' : age >= cfg.warn ? 'warn' : 'ok')
  const total = tickets.length
  // posición de los marcadores en la leyenda (eje 0 → late·1.2)
  const axis = cfg.late * 1.2
  const warnPct = (cfg.warn / axis) * 100
  const latePct = (cfg.late / axis) * 100

  return (
    <div className="section kds-section">
      <SectionHeader
        title="Comandas"
        subtitle="Cocina en vivo"
        right={
          <div className="kds-head-r">
            <Badge tone="gold">{total} en marcha</Badge>
            <button className={'kds-cfg-btn' + (cfgOpen ? ' on' : '')} onClick={() => setCfgOpen((o) => !o)}>
              ⚙ Tiempos
            </button>
          </div>
        }
      />

      <AnimatePresence initial={false}>
        {cfgOpen && (
          <motion.div className="kds-cfg" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}>
            <div className="kcfg-inner">
              <div className="kcfg-sliders">
                <div className="kcfg-row">
                  <label>
                    <i className="kcfg-dot w" /> Pasa a <b>ámbar</b> a los <b className="kcfg-v">{(cfg.warn / 60).toFixed(1)} min</b>
                  </label>
                  <input
                    type="range"
                    className="kcfg-range w"
                    min={60}
                    max={900}
                    step={30}
                    value={cfg.warn}
                    onChange={(e) => setCfg((c) => ({ ...c, warn: Math.min(+e.target.value, c.late - 30) }))}
                  />
                </div>
                <div className="kcfg-row">
                  <label>
                    <i className="kcfg-dot l" /> Pasa a <b>rojo</b> a los <b className="kcfg-v">{(cfg.late / 60).toFixed(1)} min</b>
                  </label>
                  <input
                    type="range"
                    className="kcfg-range l"
                    min={120}
                    max={1500}
                    step={30}
                    value={cfg.late}
                    onChange={(e) => setCfg((c) => ({ ...c, late: Math.max(+e.target.value, c.warn + 30) }))}
                  />
                </div>
                <button className="kcfg-reset" onClick={() => setCfg(DEFAULT_CFG)}>
                  Restablecer
                </button>
              </div>
              <div className="kcfg-legend">
                <div className="kcfg-grad">
                  <span className="kcfg-mark" style={{ left: warnPct + '%' }}>
                    <b>{(cfg.warn / 60).toFixed(0)}′</b>
                  </span>
                  <span className="kcfg-mark" style={{ left: latePct + '%' }}>
                    <b>{(cfg.late / 60).toFixed(0)}′</b>
                  </span>
                </div>
                <div className="kcfg-axis">
                  <span>nuevo</span>
                  <span>tarde</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="kds-board">
        {COLS.map((col) => {
          const list = tickets.filter((t) => t.status === col.key)
          return (
            <div className="kds-col" key={col.key}>
              <div className="kds-col-head">
                <span className="kch-lab">{col.label}</span>
                <span className="kch-n">{list.length}</span>
              </div>
              <div className="kds-col-body">
                <AnimatePresence initial={false}>
                  {list.map((t) => {
                    const age = (now - t.born) / 1000
                    const p = age / cfg.late
                    const col2 = ageColor(p)
                    const cls = ageClass(age)
                    return (
                      <motion.div
                        key={t.id}
                        layout
                        className={'kds-ticket ' + cls}
                        style={{ ['--src']: t.color, ['--tcol']: col2, ['--pp']: Math.min(100, p * 100) + '%' } as CSSProperties}
                        initial={{ opacity: 0, scale: 0.9, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}
                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                      >
                        <div className="kt-head">
                          <span className="kt-n">#{t.n}</span>
                          <span className="kt-src">{t.mesa ? 'Mesa ' + t.mesa : t.src}</span>
                          <span className="kt-time tnum">{mmss(now - t.born)}</span>
                        </div>
                        <div className="kt-items">
                          {t.items.map((it, i) => (
                            <div className="kt-item" key={i}>
                              <span className="kt-q tnum">{it.qty}×</span>
                              <span className="kt-name">{it.name}</span>
                            </div>
                          ))}
                        </div>
                        {/* barra de timer continua: se llena y vira verde→ámbar→rojo */}
                        <div className="kt-bar">
                          <div className="kt-fill" style={{ width: 'var(--pp)', background: col2 }} />
                        </div>
                        <button className="kt-btn" onClick={() => advance(t)}>
                          {t.status === 'nueva' ? 'Empezar' : t.status === 'prep' ? 'Marcar lista' : 'Servida ✓'}
                        </button>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
                {list.length === 0 && <div className="kds-empty">—</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
