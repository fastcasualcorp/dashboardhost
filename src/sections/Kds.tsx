import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SectionHeader, Badge } from '../components/ui'
import { play } from '../lib/sound'

/* KDS — tablero de cocina en vivo. Las comandas entran solas (simulación de
   pedidos en tiempo real), envejecen (verde→ámbar→rojo) y avanzan de estado:
   Nuevas → En preparación → Listas → (servida, sale del tablero). */

type Status = 'nueva' | 'prep' | 'lista'
type Item = { name: string; qty: number }
type Ticket = { id: number; n: number; src: string; color: string; items: Item[]; born: number; status: Status }

const SOURCES = [
  { src: 'Sala', color: '#ffbf10' },
  { src: 'Glovo', color: '#ffc244' },
  { src: 'Uber Eats', color: '#06c167' },
  { src: 'Just Eat', color: '#ff8000' },
]
const DISHES = ['REBELL Classic', 'Doble Bacon', 'Crispy Chicken', 'Veggie Deluxe', 'Patatas Rebell', 'Nuggets x6', 'Aros de cebolla', 'Refresco', 'Cerveza', 'Brownie']

// Generador determinista por índice (sin Math.random global para el seed inicial).
function makeItems(seed: number): Item[] {
  const k = 2 + (seed % 3)
  const out: Item[] = []
  for (let i = 0; i < k; i++) {
    const name = DISHES[(seed * 3 + i * 5) % DISHES.length]
    out.push({ name, qty: 1 + ((seed + i) % 2) })
  }
  return out
}

const COLS: { key: Status; label: string }[] = [
  { key: 'nueva', label: 'Nuevas' },
  { key: 'prep', label: 'En preparación' },
  { key: 'lista', label: 'Listas' },
]

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Kds() {
  const seq = useRef(40)
  const [now, setNow] = useState(() => Date.now())
  const [tickets, setTickets] = useState<Ticket[]>(() => {
    const t0 = Date.now()
    // semilla: algunas comandas ya envejecidas para ver los colores al entrar
    const ages = [12 * 60000, 6 * 60000, 2 * 60000, 40000, 9 * 60000]
    const statuses: Status[] = ['prep', 'prep', 'nueva', 'nueva', 'lista']
    return ages.map((a, i) => ({
      id: i + 1,
      n: 34 + i,
      src: SOURCES[i % SOURCES.length].src,
      color: SOURCES[i % SOURCES.length].color,
      items: makeItems(i + 1),
      born: t0 - a,
      status: statuses[i],
    }))
  })

  // reloj a 1s para los timers
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // comandas entrando en vivo cada ~8s (máx 6 en "nuevas" para no saturar)
  useEffect(() => {
    const id = setInterval(() => {
      setTickets((ts) => {
        if (ts.filter((t) => t.status === 'nueva').length >= 6) return ts
        seq.current += 1
        const s = SOURCES[seq.current % SOURCES.length]
        play('pop', 0.5, 1.16)
        return [
          ...ts,
          { id: seq.current + 1000, n: seq.current, src: s.src, color: s.color, items: makeItems(seq.current), born: Date.now(), status: 'nueva' as Status },
        ]
      })
    }, 8000)
    return () => clearInterval(id)
  }, [])

  function advance(t: Ticket) {
    if (t.status === 'lista') {
      setTickets((ts) => ts.filter((x) => x.id !== t.id))
      play('success', 0.5, 1.05)
      return
    }
    const next: Status = t.status === 'nueva' ? 'prep' : 'lista'
    setTickets((ts) => ts.map((x) => (x.id === t.id ? { ...x, status: next } : x)))
    play(next === 'lista' ? 'success' : 'tap', 0.5, next === 'lista' ? 1 : 1.12)
  }

  const ageClass = (born: number) => {
    const m = (now - born) / 60000
    return m >= 10 ? 'late' : m >= 5 ? 'warn' : 'ok'
  }

  const total = tickets.length

  return (
    <div className="section kds-section">
      <SectionHeader title="Comandas" subtitle="Cocina en vivo" right={<Badge tone="gold">{total} en marcha</Badge>} />

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
                  {list.map((t) => (
                    <motion.div
                      key={t.id}
                      layout
                      className={'kds-ticket ' + ageClass(t.born)}
                      style={{ ['--src' as string]: t.color }}
                      initial={{ opacity: 0, scale: 0.9, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    >
                      <div className="kt-head">
                        <span className="kt-n">#{t.n}</span>
                        <span className="kt-src">{t.src}</span>
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
                      <button className="kt-btn" onClick={() => advance(t)}>
                        {t.status === 'nueva' ? 'Empezar' : t.status === 'prep' ? 'Marcar lista' : 'Servida ✓'}
                      </button>
                    </motion.div>
                  ))}
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
