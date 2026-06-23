import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SectionHeader, Badge } from '../components/ui'
import { eur } from '../lib/data'
import { PRODUCTOS, CAT_ORDER, MENU_SLOTS, MENU_DISCOUNT, isMenu, colorOf, type Producto } from '../lib/products'
import { play } from '../lib/sound'
import { loadSalon, type Mesa } from '../lib/salon'
import { supabase, localId } from '../lib/supabase'

type Line = { id: string; name: string; price: number; qty: number; detail?: string }

// redondeo a 0,05 € (precios "de carta")
const round05 = (n: number) => Math.round(n * 20) / 20

// Persistencia en Supabase (por local, vía RLS). Fire-and-forget: no bloquea la caja.
async function persistVenta(total: number, mesaNombre: string | null) {
  const lid = localId()
  if (!supabase || !lid) return
  try {
    await supabase.from('ventas').insert({ local_id: lid, total: Math.round(total * 100) / 100, metodo: 'tarjeta', mesa: mesaNombre, doc: 'ticket' })
  } catch {
    /* sin conexión: la venta se ve igual en caja */
  }
}
async function persistComanda(items: Line[], mesaNombre: string | null) {
  const lid = localId()
  if (!supabase || !lid) return
  try {
    await supabase.from('comandas').insert({ local_id: lid, numero: Math.floor(Date.now() % 100000), fuente: 'Sala', mesa: mesaNombre, items, estado: 'nueva' })
  } catch {
    /* sin conexión */
  }
}

export default function Tpv() {
  const [cart, setCart] = useState<Line[]>([])
  const [ventasHoy, setVentasHoy] = useState(1787.4)
  const [shownVentas, setShownVentas] = useState(1787.4)
  const [pulse, setPulse] = useState(0)
  const [paid, setPaid] = useState(false)
  const [cat, setCat] = useState('Burgers')
  const [building, setBuilding] = useState<Producto | null>(null)
  const [picks, setPicks] = useState<Record<string, string>>({})
  // Mesa de la comanda (del plano del Salón) + envío a cocina (Comanda).
  const [mesa, setMesa] = useState<Mesa | null>(null)
  const [pickOpen, setPickOpen] = useState(false)
  const [mesas, setMesas] = useState<Mesa[]>(() => loadSalon())
  const [sent, setSent] = useState(false)
  const combo = useRef({ n: 0, t: 0 })
  const raf = useRef(0)
  const menuSeq = useRef(0)

  // ── Constructor de menú: elegir 1 producto por slot, precio dinámico ──
  const chosen = MENU_SLOTS.map((s) => ({ slot: s, prod: PRODUCTOS.find((p) => p.id === picks[s.key]) })).filter((x) => x.prod) as { slot: typeof MENU_SLOTS[number]; prod: Producto }[]
  const menuRaw = chosen.reduce((s, x) => s + x.prod.price, 0)
  const menuPrice = round05(menuRaw * (1 - MENU_DISCOUNT))
  const menuAhorro = round05(menuRaw - menuPrice)
  const menuReady = MENU_SLOTS.filter((s) => s.required).every((s) => picks[s.key])

  function openBuilder(p: Producto) {
    // pre-selecciona el primero de cada slot obligatorio → precio visible al instante
    const pre: Record<string, string> = {}
    for (const s of MENU_SLOTS) {
      if (s.required) {
        const first = PRODUCTOS.find((x) => x.cat === s.cat)
        if (first) pre[s.key] = first.id
      }
    }
    setPicks(pre)
    setBuilding(p)
    play('pop', 0.5, 1.18)
  }
  function selectSlot(key: string, p: Producto) {
    setPicks((prev) => ({ ...prev, [key]: p.id }))
    play('tap', 0.5, 1.12)
  }
  function clearSlot(key: string) {
    setPicks((prev) => {
      const n = { ...prev }
      delete n[key]
      return n
    })
    play('tap', 0.42, 0.92)
  }
  function addMenu() {
    if (!building || !menuReady) return
    const detail = chosen.map((x) => x.prod.name).join(' · ')
    const line: Line = { id: 'menu-' + ++menuSeq.current, name: building.name, price: menuPrice, qty: 1, detail }
    setPaid(false)
    setCart((c) => [...c, line])
    play('pop', 0.55, 1.5)
    setBuilding(null)
    setPicks({})
  }
  // Router: un menú abre el constructor; el resto se añade plano.
  const choose = (p: Producto) => (isMenu(p) ? openBuilder(p) : add(p))

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

  // ── Mesa (del plano del Salón) ──
  function openPicker() {
    setMesas(loadSalon()) // recarga por si se editó el salón
    setPickOpen(true)
    play('tap', 0.5, 1.1)
  }
  function chooseMesa(m: Mesa | null) {
    setMesa(m)
    setPickOpen(false)
    play('pop', 0.5, m ? 1.2 : 0.9)
  }

  // Comanda → enviar a cocina (KDS). En frontend marca "enviada"; con Supabase
  // hará insert en `comandas` con items + mesa.
  function comanda() {
    if (!cart.length) return
    play('success', 0.4, 1.28)
    setSent(true)
    window.setTimeout(() => setSent(false), 1700)
    void persistComanda(cart, mesa?.nombre ?? null) // → KDS (cocina)
  }

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
    // ka-ching escalado: cuanto mayor el ticket, más grave suena (más "peso").
    play('success', 0.5, total > 50 ? 0.84 : total > 25 ? 0.92 : 1)
    setVentasHoy(next)
    setPulse((p) => p + 1)
    setPaid(true)
    setCart([])
    void persistVenta(total, mesa?.nombre ?? null) // → libro de ventas
    setMesa(null) // la mesa queda libre tras cobrar
  }

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const prods = PRODUCTOS.filter((p) => p.cat === cat)

  // Mini-plano del salón para el selector de mesa: escala para que quepa.
  const planoBounds = mesas.reduce((b, m) => ({ w: Math.max(b.w, m.x + m.w), h: Math.max(b.h, m.y + m.h) }), { w: 1, h: 1 })
  const PLANO_W = 520
  const PLANO_H = 320
  const planoScale = Math.min(PLANO_W / planoBounds.w, PLANO_H / planoBounds.h, 1)

  // ── Atajos de teclado (POS rápido) ──────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Enter') { e.preventDefault(); cobrar(); return }
      if (e.key === 'Backspace') { e.preventDefault(); setPaid(false); setCart((c) => c.slice(0, -1)); return }
      if (e.key === 'ArrowRight') { e.preventDefault(); setCat((c) => CAT_ORDER[(CAT_ORDER.indexOf(c) + 1) % CAT_ORDER.length]); return }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setCat((c) => CAT_ORDER[(CAT_ORDER.indexOf(c) - 1 + CAT_ORDER.length) % CAT_ORDER.length]); return }
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= 9 && prods[n - 1]) { e.preventDefault(); choose(prods[n - 1]) }
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
                <button key={p.id} className={'prod-card sm' + (q ? ' active' : '') + (isMenu(p) ? ' is-menu' : '')} style={{ ['--type' as string]: colorOf(p.cat) }} onClick={() => choose(p)}>
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
            <div className="tk-head-l">
              <h3>Ticket</h3>
              <button className={'tk-mesa' + (mesa ? ' on' : '')} onClick={openPicker}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.6" />
                  <circle cx="15.5" cy="15.5" r="1.6" />
                </svg>
                {mesa ? `Mesa ${mesa.nombre}` : 'Para llevar'}
              </button>
            </div>
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
                    <small>{l.detail ? l.detail : eur(l.price) + ' € · ud'}</small>
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
            <div className="tk-actions">
              <button className={'tk-comanda' + (sent ? ' ok' : '')} onClick={comanda} disabled={!cart.length}>
                {sent ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                    Enviada
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v4H4zM6 8v12h12V8M9 12h6" /></svg>
                    Comanda
                  </>
                )}
              </button>
              <button className={'tpv-pay' + (cart.length ? '' : ' off')} onClick={cobrar} disabled={!cart.length}>
                Cobrar {eur(total)} €
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Selector de mesa (mini-plano del Salón) ── */}
      <AnimatePresence>
        {pickOpen && (
          <motion.div className="tpv-mesa-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPickOpen(false)}>
            <motion.div
              className="tpv-mesa-panel"
              initial={{ opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30, mass: 0.8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="mb-head">
                <div className="mb-htxt">
                  <b>¿A qué mesa va?</b>
                  <small>Pulsa una mesa del plano o elige “Para llevar”</small>
                </div>
                <button className="mb-x" onClick={() => setPickOpen(false)} aria-label="Cerrar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </header>

              <div className="tpv-mesa-plano">
                <div className="tmp-canvas" style={{ width: planoBounds.w * planoScale, height: planoBounds.h * planoScale }}>
                  {mesas.map((m) => (
                    <button
                      key={m.id}
                      className={'tmp-mesa' + (mesa?.id === m.id ? ' on' : '')}
                      style={{ left: m.x * planoScale, top: m.y * planoScale, width: m.w * planoScale, height: m.h * planoScale, borderRadius: m.forma === 'redonda' ? '50%' : 10 }}
                      onClick={() => chooseMesa(m)}
                    >
                      <span>{m.nombre}</span>
                    </button>
                  ))}
                  {!mesas.length && <div className="salon-empty">Aún no hay salón · créalo en “Salón”</div>}
                </div>
              </div>

              <footer className="tpv-mesa-foot">
                <button className={'tmp-llevar' + (!mesa ? ' on' : '')} onClick={() => chooseMesa(null)}>
                  Para llevar
                </button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Constructor de menú (precio dinámico) ── */}
      <AnimatePresence>
        {building && (
          <motion.div className="mb-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBuilding(null)}>
            <motion.div
              className="mb-panel"
              initial={{ opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30, mass: 0.8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="mb-head">
                <div className="mb-htxt">
                  <b>Monta tu {building.name}</b>
                  <small>Elige una opción de cada apartado</small>
                </div>
                <button className="mb-x" onClick={() => setBuilding(null)} aria-label="Cerrar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </header>

              <div className="mb-slots">
                {MENU_SLOTS.map((s) => {
                  const opts = PRODUCTOS.filter((p) => p.cat === s.cat)
                  return (
                    <div className="mb-slot" key={s.key}>
                      <div className="mb-slot-lab">
                        {s.label}
                        {!s.required && <em>opcional</em>}
                      </div>
                      <div className="mb-opts">
                        {opts.map((p) => (
                          <button key={p.id} className={'mb-opt' + (picks[s.key] === p.id ? ' on' : '')} onClick={() => selectSlot(s.key, p)}>
                            <img src={p.img} alt={p.name} loading="lazy" />
                            <span className="mb-opt-n">{p.name}</span>
                            <span className="mb-opt-p tnum">+{eur(p.price)} €</span>
                          </button>
                        ))}
                        {!s.required && (
                          <button className={'mb-opt mb-none' + (!picks[s.key] ? ' on' : '')} onClick={() => clearSlot(s.key)}>
                            <span className="mb-none-ic">∅</span>
                            <span className="mb-opt-n">Sin {s.label.toLowerCase()}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <footer className="mb-foot">
                <div className="mb-price">
                  <span className="mb-price-k">Total del menú</span>
                  <b className="tnum">{eur(menuPrice)} €</b>
                  {menuAhorro > 0 && <span className="mb-save tnum">Ahorras {eur(menuAhorro)} €</span>}
                </div>
                <button className={'mb-add' + (menuReady ? '' : ' off')} onClick={addMenu} disabled={!menuReady}>
                  Añadir al ticket
                </button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
