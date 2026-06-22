import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { play } from '../lib/sound'

/* ════════════════════════════════════════════════════════════════
   MODO DISEÑO — el editor en vivo de Juan.
   Mueve sliders → cambia variables CSS (--ds-*) al instante sobre :root.
   "Fijar" copia un bloque CSS con SOLO lo tocado → se cocina en index.css.
   Nada se rompe si no tocas nada: cada regla usa var(--ds-x, <default>).
   (Owner-only; cuando se venda, se gatea por rol. Por ahora visible.)
   ════════════════════════════════════════════════════════════════ */

type Tok = { v: string; label: string; min: number; max: number; step: number; unit: string; def: number }
type Group = { id: string; title: string; hint: string; tokens: Tok[] }

const GROUPS: Group[] = [
  {
    id: 'carta',
    title: 'Carta · tarjeta de plato',
    hint: 'Ve a la sección Carta para ver estos cambios',
    tokens: [
      { v: '--ds-card-h', label: 'Alto de la card', min: 420, max: 700, step: 2, unit: 'px', def: 560 },
      { v: '--ds-card-w', label: 'Ancho de la card', min: 300, max: 500, step: 2, unit: 'px', def: 400 },
      { v: '--ds-card-radius', label: 'Redondez de esquinas', min: 8, max: 44, step: 1, unit: 'px', def: 28 },
      { v: '--ds-photo-y', label: 'Encuadre de la foto (vertical)', min: 0, max: 100, step: 1, unit: '%', def: 42 },
      { v: '--ds-balnum', label: 'Número de ventas (grande)', min: 28, max: 76, step: 1, unit: 'px', def: 46 },
      { v: '--ds-name', label: 'Nombre del plato', min: 14, max: 36, step: 1, unit: 'px', def: 22 },
      { v: '--ds-price', label: 'Precio', min: 14, max: 34, step: 1, unit: 'px', def: 21 },
      { v: '--ds-panel-pad', label: 'Aire bajo el panel', min: 6, max: 30, step: 1, unit: 'px', def: 17 },
    ],
  },
  {
    id: 'caja',
    title: 'Caja · medidor del día',
    hint: 'Ve a la sección Caja para ver estos cambios',
    tokens: [
      { v: '--ds-hero-num', label: 'Número grande del día', min: 28, max: 72, step: 1, unit: 'px', def: 46 },
      { v: '--ds-ring', label: 'Grosor del anillo', min: 4, max: 26, step: 1, unit: 'px', def: 12 },
    ],
  },
]

const ALL = GROUPS.flatMap((g) => g.tokens)
const STORE = 'rebell-ds'

function loadVals(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORE)
    if (raw) return JSON.parse(raw)
  } catch {
    /* sin localStorage */
  }
  return {}
}

function applyVar(v: string, n: number, unit: string) {
  document.documentElement.style.setProperty(v, n + unit)
}

export default function DesignMode() {
  const [open, setOpen] = useState(false)
  const [vals, setVals] = useState<Record<string, number>>(loadVals)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | undefined>(undefined)

  // Aplicar lo guardado al arrancar (y persistir en cada cambio).
  useEffect(() => {
    for (const [v, n] of Object.entries(vals)) {
      const t = ALL.find((x) => x.v === v)
      if (t) applyVar(v, n, t.unit)
    }
    try {
      localStorage.setItem(STORE, JSON.stringify(vals))
    } catch {
      /* sin localStorage */
    }
  }, [vals])

  // Atajo de teclado: tecla "D" abre/cierra (cómodo para Juan).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'd' || e.key === 'D') {
        setOpen((o) => !o)
        play('tap')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function setTok(t: Tok, n: number) {
    applyVar(t.v, n, t.unit)
    setVals((s) => ({ ...s, [t.v]: n }))
  }
  function resetTok(t: Tok) {
    document.documentElement.style.removeProperty(t.v)
    setVals((s) => {
      const n = { ...s }
      delete n[t.v]
      return n
    })
    play('tap')
  }
  function resetAll() {
    for (const t of ALL) document.documentElement.style.removeProperty(t.v)
    setVals({})
    try {
      localStorage.removeItem(STORE)
    } catch {
      /* sin localStorage */
    }
    play('toggle')
  }

  function exportCss() {
    const touched = ALL.filter((t) => t.v in vals)
    if (!touched.length) return
    const body = touched.map((t) => `  ${t.v}: ${vals[t.v]}${t.unit};`).join('\n')
    const css = `/* REBELL · Modo Diseño — valores fijados por Juan */\n:root {\n${body}\n}`
    try {
      navigator.clipboard?.writeText(css)
    } catch {
      /* clipboard bloqueado */
    }
    setCopied(true)
    play('success')
    window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopied(false), 2200)
  }

  const touchedCount = Object.keys(vals).length

  return (
    <>
      <button
        className={'dz-fab' + (open ? ' on' : '')}
        onClick={() => {
          setOpen((o) => !o)
          play('tap')
        }}
        aria-label="Modo diseño"
        title="Modo diseño (tecla D)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 21v-5M4 10V3M12 21v-9M12 6V3M20 21v-3M20 12V3" />
          <path d="M2 16h4M10 6h4M18 15h4" />
        </svg>
        {touchedCount > 0 && <span className="dz-badge">{touchedCount}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="dz-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="dz-panel"
              initial={{ x: 32, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 32, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            >
              <header className="dz-head">
                <div className="dz-htxt">
                  <b>Modo diseño</b>
                  <small>Ajusta a tu gusto · se aplica en vivo</small>
                </div>
                <button className="dz-x" onClick={() => setOpen(false)} aria-label="Cerrar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </header>

              <div className="dz-body">
                {GROUPS.map((g) => (
                  <section className="dz-group" key={g.id}>
                    <div className="dz-glab">{g.title}</div>
                    <div className="dz-ghint">{g.hint}</div>
                    {g.tokens.map((t) => {
                      const cur = t.v in vals ? vals[t.v] : t.def
                      const touched = t.v in vals
                      return (
                        <div className={'dz-row' + (touched ? ' touched' : '')} key={t.v}>
                          <div className="dz-rtop">
                            <span className="dz-rlab">{t.label}</span>
                            <span className="dz-rval">
                              {cur}
                              {t.unit}
                              {touched && (
                                <button className="dz-undo" onClick={() => resetTok(t)} aria-label="Volver al valor original" title="Volver al original">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 7v6h6M3.5 13a9 9 0 1 0 2.6-6.3L3 9" />
                                  </svg>
                                </button>
                              )}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={t.min}
                            max={t.max}
                            step={t.step}
                            value={cur}
                            onChange={(e) => setTok(t, Number(e.target.value))}
                            style={{ '--p': ((cur - t.min) / (t.max - t.min)) * 100 + '%' } as CSSProperties}
                          />
                        </div>
                      )
                    })}
                  </section>
                ))}
              </div>

              <footer className="dz-foot">
                <button className="dz-reset" onClick={resetAll} disabled={!touchedCount}>
                  Restablecer
                </button>
                <button className="dz-fix" onClick={exportCss} disabled={!touchedCount}>
                  {copied ? '✓ Copiado — pásamelo' : touchedCount ? `Fijar ${touchedCount} cambio${touchedCount > 1 ? 's' : ''}` : 'Fijar'}
                </button>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
