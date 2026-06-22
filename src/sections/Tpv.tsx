import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SectionHeader, Badge } from '../components/ui'
import { eur } from '../lib/data'
import { PRODUCTOS, CAT_ORDER, type Producto } from '../lib/products'
import { play } from '../lib/sound'

type Line = { id: string; name: string; price: number; qty: number }

export default function Tpv() {
  const [cart, setCart] = useState<Line[]>([])
  const [ventasHoy, setVentasHoy] = useState(1787.4)
  const [shownVentas, setShownVentas] = useState(1787.4)
  const [pulse, setPulse] = useState(0)
  const [paid, setPaid] = useState(false)
  const [cat, setCat] = useState('Burgers')
  const combo = useRef({ n: 0, t: 0 })
  const raf = useRef(0)

  const add = (p: Producto) => {
    // Pop con "combo": añadir rápido y seguido sube el tono en escala mayor
    // (do-re-mi-fa-sol…) como un combo de videojuego; tras una pausa se reinicia.
    const now = performance.now()
    const cb = combo.current
    cb.n = now - cb.t < 650 ? cb.n + 1 : 0
    cb.t = now
    const SCALE = [0, 2, 4, 5, 7, 9, 11, 12]
    const semi = SCALE[Math.min(cb.n, SCALE.length - 1)]
    play('pop', 0.5, Math.pow(2, semi / 12) * (0.99 + Math.random() * 0.02))
    setPaid(false)
    setCart((c) => {
      const ex = c.find((l) => l.id === p.id)
      if (ex) return c.map((l) => (l.id === p.id ? { ...l, qty: l.qty + 1 } : l))
      return [...c, { id: p.id, name: p.name, price: p.price, qty: 1 }]
    })
  }
  const dec = (id: string) => setCart((c) => c.flatMap((l) => (l.id === id ? (l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []) : [l])))
  const inc = (id: string) => setCart((c) => c.map((l) => (l.id === id ? { ...l, qty: l.qty + 1 } : l)))
  const remove = (id: string) => setCart((c) => c.filter((l) => l.id !== id))

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0)
  const iva = subtotal * 0.1
  const total = subtotal + iva
  const items = cart.reduce((s, l) => s + l.qty, 0)
  const qtyOf = (id: string) => cart.find((l) => l.id === id)?.qty ?? 0

  const cobrar = () => {
    if (!cart.length) return
    const from = ventasHoy
    const next = ventasHoy + total
    // "Caja que suma": count-up del total del día + ka-ching. El dinero entrando,
    // se ve subir y se oye al instante.
    const start = performance.now()
    const dur = 900
    cancelAnimationFrame(raf.current)
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur)
      const e = 1 - Math.pow(1 - k, 3)
      setShownVentas(from + (next - from) * e)
      if (k < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    play('success', 0.5)
    setVentasHoy(next)
    setPulse((p) => p + 1)
    setPaid(true)
    setCart([])
  }

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const prods = PRODUCTOS.filter((p) => p.cat === cat)

  // ── Atajos de teclado (POS rápido) ──────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Enter') { e.preventDefault(); cobrar(); return }
      if (e.key === 'Backspace') { e.preventDefault(); setPaid(false); setCart((c) => c.slice(0, -1)); return }
      if (e.key === 'ArrowRight') { e.preventDefault(); setCat((c) => CAT_ORDER[(CAT_ORDER.indexOf(c) + 1) % CAT_ORDER.length]); return }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setCat((c) => CAT_ORDER[(CAT_ORDER.indexOf(c) - 1 + CAT_ORDER.length) % CAT_ORDER.length]); return }
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= 9 && prods[n - 1]) { e.preventDefault(); add(prods[n - 1]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prods, cart, total])

  return (
    <div className="section tpv-section">
      <SectionHeader
        title="TPV"
        subtitle="Punto de venta"
        right={
          <div className="tpv-head-right">
            <span className="tpv-ventas">
              Ventas hoy{' '}
              <motion.b
                key={pulse}
                className="tnum"
                initial={pulse === 0 ? false : { scale: 1.22, filter: 'brightness(1.7)' }}
                animate={{ scale: 1, filter: 'brightness(1)' }}
                transition={{ type: 'spring', stiffness: 480, damping: 16 }}
              >
                {eur(shownVentas)} €
              </motion.b>
            </span>
            <Badge tone="green">● Caja abierta</Badge>
          </div>
        }
      />

      <div className="tpv-pos">
        <div className="panel-card tpv-cat-col">
          <div className="tpv-tabs">
            {CAT_ORDER.map((c) => (
              <button key={c} className={'tpv-tab' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
            <span className="tpv-kbd-hint">
              <kbd>1–9</kbd> añadir · <kbd>↵</kbd> cobrar · <kbd>←→</kbd> categoría
            </span>
          </div>
          <div className="tpv-prods compact">
            {prods.map((p, i) => {
              const q = qtyOf(p.id)
              return (
                <button key={p.id} className={'prod-card sm' + (q ? ' active' : '')} onClick={() => add(p)}>
                  {i < 9 && <span className="pc-key">{i + 1}</span>}
                  <img className="pc-img" src={p.img} alt={p.name} loading="lazy" />
                  <span className="pc-body">
                    <span className="pc-name">{p.name}</span>
                    <span className="pc-price tnum">{eur(p.price)} €</span>
                  </span>
                  <AnimatePresence>
                    {q > 0 && (
                      <motion.span
                        className="pc-qty"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 620, damping: 20 }}
                      >
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.b
                            key={q}
                            className="tnum"
                            initial={{ scale: 1.8, filter: 'brightness(2)' }}
                            animate={{ scale: 1, filter: 'brightness(1)' }}
                            transition={{ type: 'spring', stiffness: 520, damping: 15 }}
                          >
                            {q}
                          </motion.b>
                        </AnimatePresence>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              )
            })}
          </div>
        </div>

        <div className="panel-card tpv-ticket-col">
          <div className="card-head tk-head">
            <h3>Ticket</h3>
            {items > 0 && <Badge tone="gold">{items} art.</Badge>}
          </div>

          {cart.length === 0 ? (
            <div className={'tpv-empty' + (paid ? ' paid' : '')}>
              <span className="te-ic">
                {paid ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3 5 4.5Z" />
                    <path d="M9 8h6M9 12h5" />
                  </svg>
                )}
              </span>
              <b>{paid ? 'Cobrado ✓' : 'Ticket vacío'}</b>
              <span>{paid ? 'Ticket cerrado correctamente' : 'Toca un producto o pulsa 1–9'}</span>
            </div>
          ) : (
            <div className="tk-lines">
              {cart.map((l) => (
                <div className="tk-line" key={l.id}>
                  <div className="tk-info">
                    <b>{l.name}</b>
                    <small>{eur(l.price)} € · ud</small>
                  </div>
                  <div className="tk-qty">
                    <button onClick={() => dec(l.id)} aria-label="Quitar uno">−</button>
                    <span className="tnum">{l.qty}</span>
                    <button onClick={() => inc(l.id)} aria-label="Añadir uno">+</button>
                  </div>
                  <span className="tk-sum tnum">{eur(l.price * l.qty)} €</span>
                  <button className="tk-del" onClick={() => remove(l.id)} aria-label="Eliminar línea">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="tk-tot">
            <div className="tk-row">
              <span>Subtotal</span>
              <b className="tnum">{eur(subtotal)} €</b>
            </div>
            <div className="tk-row">
              <span>IVA 10%</span>
              <b className="tnum">{eur(iva)} €</b>
            </div>
            <div className="tk-row big">
              <span>Total</span>
              <b className="tnum">{eur(total)} €</b>
            </div>
            <button className={'tpv-pay' + (cart.length ? '' : ' off')} onClick={cobrar} disabled={!cart.length}>
              Cobrar {eur(total)} €
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
