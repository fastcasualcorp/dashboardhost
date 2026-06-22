import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

export const TODAY = new Date(2026, 5, 22)
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONFULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WD = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

export const QUICK = [
  { key: 'historico', label: 'Total · histórico' },
  { key: 'hoy', label: 'Hoy' },
  { key: 'ayer', label: 'Ayer' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'semanaant', label: 'Semana anterior' },
  { key: 'mes', label: 'Este mes' },
  { key: 'mesant', label: 'Mes anterior' },
  { key: 'trimestre', label: 'Último trimestre' },
  { key: 'anio', label: 'Este año' },
]

export type RangeSel = { key: string; label: string; start: Date; end: Date }

const dKey = (d: Date) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate()
const fmt = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`
const startOfWeek = (d: Date) => {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

export function rangeFor(key: string): { start: Date; end: Date } {
  const t = new Date(TODAY)
  switch (key) {
    case 'hoy':
      return { start: t, end: t }
    case 'ayer': {
      const y = new Date(t)
      y.setDate(t.getDate() - 1)
      return { start: y, end: y }
    }
    case 'semana':
      return { start: startOfWeek(t), end: t }
    case 'semanaant': {
      const s = startOfWeek(t)
      s.setDate(s.getDate() - 7)
      const e = new Date(s)
      e.setDate(s.getDate() + 6)
      return { start: s, end: e }
    }
    case 'mes':
      return { start: new Date(t.getFullYear(), t.getMonth(), 1), end: t }
    case 'mesant': {
      const s = new Date(t.getFullYear(), t.getMonth() - 1, 1)
      const e = new Date(t.getFullYear(), t.getMonth(), 0)
      return { start: s, end: e }
    }
    case 'trimestre': {
      const s = new Date(t)
      s.setMonth(t.getMonth() - 3)
      return { start: s, end: t }
    }
    case 'anio':
      return { start: new Date(t.getFullYear(), 0, 1), end: t }
    case 'historico':
      return { start: new Date(2024, 0, 1), end: t }
    default:
      return { start: new Date(t.getFullYear(), t.getMonth(), 1), end: t }
  }
}

export default function DatePicker({ value, onApply }: { value: RangeSel; onApply: (r: RangeSel) => void }) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState<Date>(value.start)
  const [end, setEnd] = useState<Date | null>(value.end)
  const [key, setKey] = useState(value.key)
  const [view, setView] = useState(new Date(value.start.getFullYear(), value.start.getMonth(), 1))
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (ev: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  function pickQuick(qk: string) {
    const r = rangeFor(qk)
    setStart(r.start)
    setEnd(r.end)
    setKey(qk)
    setView(new Date(r.start.getFullYear(), r.start.getMonth(), 1))
  }
  function pickDay(d: Date) {
    if (!end) {
      if (dKey(d) < dKey(start)) {
        setEnd(start)
        setStart(d)
      } else setEnd(d)
      setKey('custom')
    } else {
      setStart(d)
      setEnd(null)
      setKey('custom')
    }
  }
  function apply() {
    const e = end || start
    const label = key !== 'custom' ? QUICK.find((q) => q.key === key)?.label || '' : `${start.getDate()} ${MON[start.getMonth()]} → ${e.getDate()} ${MON[e.getMonth()]}`
    onApply({ key, label, start, end: e })
    setOpen(false)
  }

  const y = view.getFullYear()
  const m = view.getMonth()
  const offset = (new Date(y, m, 1).getDay() + 6) % 7
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const e = end || start
  const inRange = (d: Date) => dKey(d) >= dKey(start) && dKey(d) <= dKey(e)
  const isEdge = (d: Date) => dKey(d) === dKey(start) || dKey(d) === dKey(e)

  return (
    <div className="dp" ref={rootRef}>
      <button className={'dp-trigger' + (open ? ' open' : '')} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M3 9h18M8 2v4M16 2v4" />
        </svg>
        {value.label}
        <svg className="dp-tchev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="dp-pop"
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ type: 'spring', stiffness: 460, damping: 30 }}
          >
              <div className="dp-quick">
                <div className="dp-qh">Rango rápido</div>
                {QUICK.map((q) => (
                  <button key={q.key} className={'dp-q' + (key === q.key ? ' on' : '')} onClick={() => pickQuick(q.key)}>
                    {q.label}
                  </button>
                ))}
              </div>
              <div className="dp-cal">
                <div className="dp-cal-head">
                  <button className="dp-nav" onClick={() => setView(new Date(y, m - 1, 1))} aria-label="Mes anterior">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                  </button>
                  <b>
                    {MONFULL[m]} {y}
                  </b>
                  <button className="dp-nav" onClick={() => setView(new Date(y, m + 1, 1))} aria-label="Mes siguiente">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                </div>
                <div className="dp-wd">
                  {WD.map((w) => (
                    <span key={w}>{w}</span>
                  ))}
                </div>
                <div className="dp-grid">
                  {cells.map((d, i) =>
                    d ? (
                      <button key={i} className={'dp-day' + (inRange(d) ? ' in' : '') + (isEdge(d) ? ' edge' : '')} onClick={() => pickDay(d)}>
                        {d.getDate()}
                      </button>
                    ) : (
                      <span key={i} className="dp-empty" />
                    ),
                  )}
                </div>
                <div className="dp-foot">
                  <span className="dp-range tnum">
                    {fmt(start)} <span className="dp-arrow">→</span> {fmt(e)}
                  </span>
                  <button className="dp-apply" onClick={apply}>
                    Aplicar
                  </button>
                </div>
              </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
