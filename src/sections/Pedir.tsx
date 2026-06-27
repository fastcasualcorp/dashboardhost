/* ════════════════════════════════════════════════════════════════════
   PEDIR — página PÚBLICA de self-order por QR (cara al cliente final).
   El cliente escanea el QR de SU mesa → aterriza aquí SIN login → ve la carta
   inline, monta el pedido, paga online y el pedido entra solo en cocina.
   Reutiliza los MISMOS stores que el TPV (pushComanda · consumirVenta ·
   appendVenta), así que un pedido online es un ticket de verdad: va al KDS,
   baja el stock y cuenta como venta. (visión [[rebell-pedido-online-qr]])

   NOTA honesta: que el pedido llegue EN VIVO al panel del restaurante DESDE
   OTRO dispositivo necesita backend (Supabase Realtime) — Fase 0, pendiente.
   Aquí queda el front del cliente y el cableado listo para ese intercambio.
   ════════════════════════════════════════════════════════════════════ */
import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { PRODUCTOS, CAT_ORDER, MENU_SLOTS, MENU_DISCOUNT, isMenu, colorOf, type Producto } from '../lib/products'
import { LOCAL } from '../lib/local'
import { pushComanda } from '../lib/comandas'
import { consumirVenta } from '../lib/almacen'
import { appendVenta } from '../lib/ventas'
import { nextTicket } from '../lib/caja'
import { useCliente, saludo, topItem, favEnCategoria, recordOrder, setNombre, weMissYou, redeemReward, addStamp, STAMP_GOAL, REWARD_VALUE } from '../lib/cliente'
import { eur, reduceMotion } from '../lib/data'
import { play, playReward } from '../lib/sound'

const ticketNum = (t: string) => parseInt(t.replace(/\D/g, ''), 10) || 0

type Line = { id: string; name: string; price: number; qty: number; detail?: string }
type Step = 'menu' | 'pago' | 'ok'
type Estado = 'cocina' | 'saliendo' | 'listo'

const round05 = (n: number) => Math.round(n * 20) / 20
const r2 = (n: number) => Math.round(n * 100) / 100
const ease = [0.23, 1, 0.32, 1] as const
const UP_EMOJI: Record<string, string> = { Postres: '🍫', Sides: '🍟', Bebidas: '🥤', Burgers: '🍔', Menús: '🍱' }
const STAGES: { k: Estado; label: string; emoji: string }[] = [
  { k: 'cocina', label: 'En cocina', emoji: '👨‍🍳' },
  { k: 'saliendo', label: 'Saliendo', emoji: '🍔' },
  { k: 'listo', label: '¡Listo!', emoji: '🔔' },
]

// Lee un parámetro de la URL del QR (?l=local&m=mesa).
function qp(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name)
  } catch {
    return null
  }
}

// Enlace para valorar el local en Google. Con place_id real (futuro, del perfil del
// local) será el deep-link directo a "escribir reseña"; en demo abre el negocio en Maps.
function reviewUrl(): string {
  const q = encodeURIComponent(`${LOCAL.name} ${LOCAL.direccion || ''}`.trim())
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

export default function Pedir() {
  const rm = reduceMotion()
  const cli = useCliente() // ADN del comensal (aprende de lo que pide)
  // ── Mesa (del QR) ──────────────────────────────────────────────────
  const mesaName = qp('m') // "3", "Terraza 1"…
  const destino = mesaName ? `Mesa ${mesaName}` : 'Para llevar'

  const [step, setStep] = useState<Step>('menu')
  const [cat, setCat] = useState(CAT_ORDER[0])
  const [cart, setCart] = useState<Line[]>([])
  const [sheet, setSheet] = useState(false) // resumen del pedido abierto

  // ── Constructor de menú (idéntico al TPV) ──────────────────────────
  const [building, setBuilding] = useState<Producto | null>(null)
  const [picks, setPicks] = useState<Record<string, string>>({})
  const menuSeq = useRef(0)
  const chosen = MENU_SLOTS.map((s) => ({ slot: s, prod: PRODUCTOS.find((p) => p.id === picks[s.key]) })).filter((x) => x.prod) as { slot: (typeof MENU_SLOTS)[number]; prod: Producto }[]
  const menuRaw = chosen.reduce((s, x) => s + x.prod.price, 0)
  const menuPrice = round05(menuRaw * (1 - MENU_DISCOUNT))
  const menuAhorro = round05(menuRaw - menuPrice)
  const menuReady = MENU_SLOTS.filter((s) => s.required).every((s) => picks[s.key])

  function openBuilder(p: Producto) {
    const pre: Record<string, string> = {}
    for (const s of MENU_SLOTS) if (s.required) { const first = PRODUCTOS.find((x) => x.cat === s.cat); if (first) pre[s.key] = first.id }
    setPicks(pre)
    setBuilding(p)
    play('pop', 0.5, 1.18)
  }
  function addMenu() {
    if (!building || !menuReady) return
    const detail = chosen.map((x) => x.prod.name).join(' · ')
    setCart((c) => [...c, { id: 'menu-' + ++menuSeq.current, name: building.name, price: menuPrice, qty: 1, detail }])
    play('pop', 0.55, 1.5)
    setBuilding(null)
    setPicks({})
  }

  // ── Carrito ────────────────────────────────────────────────────────
  const add = (p: Producto) => {
    play('pop', 0.5, 1.12)
    setCart((c) => {
      const ex = c.find((l) => l.id === p.id)
      if (ex) return c.map((l) => (l.id === p.id ? { ...l, qty: l.qty + 1 } : l))
      return [...c, { id: p.id, name: p.name, price: p.price, qty: 1 }]
    })
  }
  const choose = (p: Producto) => (isMenu(p) ? openBuilder(p) : add(p))
  const inc = (id: string) => { play('tap', 0.4, 1.1); setCart((c) => c.map((l) => (l.id === id ? { ...l, qty: l.qty + 1 } : l))) }
  const dec = (id: string) => { play('tap', 0.4, 0.92); setCart((c) => c.flatMap((l) => (l.id === id ? (l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []) : [l]))) }
  const qtyOf = (id: string) => cart.find((l) => l.id === id)?.qty ?? 0

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0)
  const iva = subtotal * 0.1
  const total = r2(subtotal + iva)
  const units = cart.reduce((s, l) => s + l.qty, 0)

  // ── Propina + fidelidad + pago ─────────────────────────────────────
  const [tipPct, setTipPct] = useState(0)
  const [redeem, setRedeem] = useState(false) // canjear recompensa (postre gratis)
  const [notify, setNotify] = useState(false) // avisar al móvil cuando esté listo
  const tieneRecompensa = (cli.rewards || 0) > 0
  const propina = r2((total * tipPct) / 100)
  const descuento = redeem && tieneRecompensa ? Math.min(REWARD_VALUE, total) : 0 // el premio nunca deja el total en negativo
  const pagar = r2(total + propina - descuento)
  const [num, setNum] = useState('')
  const [exp, setExp] = useState('')
  const [cvc, setCvc] = useState('')
  const [paying, setPaying] = useState(false)
  const [orderN, setOrderN] = useState(0)
  const [paidAmount, setPaidAmount] = useState(0) // importe REALMENTE cobrado (se congela: el premio se gasta y pagar se recalcula)
  const [estado, setEstado] = useState<Estado>('cocina') // seguimiento en vivo del pedido pagado
  const [nameInput, setNameInput] = useState('') // captura de nombre en el éxito (crea cuenta)
  const [reviewed, setReviewed] = useState(false) // ya valoró este pedido (premio una sola vez)
  const cardOk = num.replace(/\s/g, '').length >= 15 && exp.length === 5 && cvc.length >= 3

  // ── ADN: "lo de siempre" + upsell personalizado ───────────────────
  const inCart = (name: string) => cart.some((l) => l.name === name)
  const addByName = (name: string) => { const p = PRODUCTOS.find((x) => x.name === name); if (p) add(p) }
  const suFijo = topItem() // su plato más repetido
  // El upsell del pago: 1º su postre habitual (mensaje a medida); si no, un best-seller que no lleve.
  const favPostre = favEnCategoria('Postres')
  const upName = favPostre && !inCart(favPostre) ? favPostre : ['Brownie', 'Patatas Rebell', 'Refresco', 'Nuggets x6'].find((n) => !inCart(n)) || null
  const upProd = upName ? PRODUCTOS.find((p) => p.name === upName) ?? null : null
  const upEsFav = !!(upName && upName === favPostre)

  function onNum(v: string) { setNum(v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()) }
  function onExp(v: string) { const d = v.replace(/\D/g, '').slice(0, 4); setExp(d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d) }

  // EL PAGO: ticket pagado online → cocina + stock + libro de ventas.
  function pagarOnline() {
    if (!cardOk || paying || !cart.length || pagar <= 0) return // nunca cobrar un carrito vacío / importe 0
    setPaying(true)
    const items = cart.map((l) => ({ name: l.name, qty: l.qty }))
    // El pedido online RESERVA su nº por la MISMA secuencia diaria que el TPV
    // (lib/caja) → cocina y libro no colisionan nº entre online y mostrador.
    const tk = nextTicket()
    const tn = ticketNum(tk)
    const ms = rm ? 350 : 1400
    setTimeout(() => {
      pushComanda({ n: tn, mesa: mesaName, items, src: 'Sala' }) // → KDS (cocina lo ve)
      consumirVenta(items) // → ALMACÉN: baja el stock de lo vendido
      appendVenta({ id: tk, tipo: 'ticket', arts: units, total: pagar, metodo: 'tarjeta', mesa: mesaName }) // → libro de ventas
      recordOrder(items, pagar) // → ADN: la cuenta del cliente aprende qué pidió (+1 sello)
      if (redeem && tieneRecompensa) redeemReward() // gastó su recompensa
      setPaidAmount(pagar) // congela lo cobrado ANTES de que pagar se recalcule sin descuento
      setOrderN(tn)
      setEstado('cocina')
      setPaying(false)
      setStep('ok')
      if (!rm) playReward(0.7)
    }, ms)
  }

  // SEGUIMIENTO EN VIVO del pedido pagado (En cocina → Saliendo → ¡Listo!).
  // Demo: avanza con temporizadores; con backend (Supabase Realtime) leerá el
  // estado REAL del KDS que mueve cocina. reduce-motion → salta a "listo".
  useEffect(() => {
    if (step !== 'ok') return
    if (rm) { setEstado('listo'); return }
    const t1 = setTimeout(() => setEstado('saliendo'), 6500)
    const t2 = setTimeout(() => { setEstado('listo'); play('success', 0.5) }, 13000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [step, rm])

  // AVISAR AL MÓVIL: cuando el pedido pasa a "listo" y el cliente lo pidió, notificación del navegador.
  // (Demo: notificación local con la app abierta. El push con la app cerrada necesita backend + service worker.)
  useEffect(() => {
    if (step !== 'ok' || estado !== 'listo' || !notify) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    try { new Notification('REBELL · ¡Tu pedido está listo! 🔔', { body: mesaName ? `Mesa ${mesaName} · te lo llevamos` : 'Pasa a recogerlo' }) } catch { /* sin permiso */ }
  }, [step, estado, notify, mesaName])

  // Pide permiso de notificación al navegador (toggle del aviso al móvil).
  function pedirAviso() {
    if (notify) { setNotify(false); return }
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'granted') { setNotify(true); play('toggle', 0.4, 1.15); return }
    Notification.requestPermission().then((p) => { setNotify(p === 'granted'); if (p === 'granted') play('toggle', 0.4, 1.15) })
  }

  // Si el carrito se vacía estando en el paso de pago, volver a la carta (no se paga 0 €).
  useEffect(() => {
    if (step === 'pago' && cart.length === 0) setStep('menu')
  }, [step, cart.length])

  // Cerrar hoja/constructor con Escape (a11y teclado).
  useEffect(() => {
    if (!sheet && !building) return
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSheet(false); setBuilding(null) } }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [sheet, building])

  const prods = PRODUCTOS.filter((p) => p.cat === cat)

  return (
    <div className="pedir">
      {/* ── Cabecera del local ── */}
      <header className="pd-top">
        <div className="pd-brand">
          <span className="pd-logo">◢</span>
          <div className="pd-loc">
            <b>{LOCAL.name}</b>
            <span>{destino} · pide y paga sin esperar</span>
          </div>
        </div>
        <span className="pd-mesa">{mesaName ? mesaName : '↗'}</span>
      </header>

      {step === 'menu' && (
        <>
          {/* ── Bienvenida personalizada (ADN): solo si ya te conocemos ── */}
          {cli.visits > 0 && (
            <motion.div className="pd-welcome" initial={rm ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>
              <div className="pd-wel-top">
                <span className="pd-wel-msg">{weMissYou() ? `Te echábamos de menos${cli.name ? `, ${cli.name}` : ''} 💛` : saludo()}</span>
                {suFijo && !inCart(suFijo) && (
                  <button className="pd-wel-usual" onClick={() => { addByName(suFijo); play('pop', 0.5, 1.3) }}>
                    ¿Lo de siempre? <b>+ {suFijo}</b>
                  </button>
                )}
              </div>
              {/* Tarjeta de sellos de fidelidad */}
              <div className="pd-stamps">
                <div className="pd-stamp-row">
                  {Array.from({ length: STAMP_GOAL }).map((_, i) => (
                    <span key={i} className={'pd-stamp' + (i < (cli.stamps || 0) ? ' on' : '')}>{i < (cli.stamps || 0) ? '🍔' : ''}</span>
                  ))}
                </div>
                <span className="pd-stamp-lbl">
                  {tieneRecompensa ? '🎁 ¡Tienes un postre gratis! Canjéalo al pagar' : `${cli.stamps || 0}/${STAMP_GOAL} sellos · completa y te invitamos al postre 🍫`}
                </span>
              </div>
            </motion.div>
          )}

          {/* ── Tabs de categoría ── */}
          <nav className="pd-tabs">
            {CAT_ORDER.map((c) => (
              <button key={c} className={'pd-tab' + (cat === c ? ' on' : '')} onClick={() => { setCat(c); play('tap', 0.36, 1.08) }}>
                {c}
              </button>
            ))}
          </nav>

          {/* ── Carta inline ── */}
          <main className="pd-list">
            {prods.map((p, i) => {
              const q = qtyOf(p.id)
              return (
                <motion.button
                  key={p.id}
                  className={'pd-card' + (q ? ' has' : '') + (isMenu(p) ? ' menu' : '')}
                  style={{ ['--type' as string]: colorOf(p.cat) }}
                  onClick={() => choose(p)}
                  aria-label={`${p.name}, ${eur(p.price)} euros${isMenu(p) ? ', arma tu menú' : ', añadir'}${q ? ` (${q} en el pedido)` : ''}`}
                  initial={rm ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.42, delay: rm ? 0 : i * 0.04, ease }}
                >
                  <img className="pd-img" src={p.img} alt={p.name} loading="lazy" />
                  <span className="pd-body">
                    <span className="pd-name">{p.name}{isMenu(p) && <span className="pd-tag">arma el tuyo</span>}</span>
                    {p.mods.length > 0 && <span className="pd-mods">{p.mods.slice(0, 2).join(' · ')}</span>}
                    <span className="pd-price tnum">{eur(p.price)} €</span>
                  </span>
                  <span className="pd-plus" aria-label="añadir">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {q > 0 ? (
                        <motion.b key={'q' + q} className="tnum" initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 16 }}>{q}</motion.b>
                      ) : (
                        <motion.span key="p" initial={{ scale: 0.6 }} animate={{ scale: 1 }}>+</motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                </motion.button>
              )
            })}
            <div className="pd-foot">REBELL · pedido online · documento no fiscal (demo)</div>
          </main>

          {/* ── Píldora de carrito flotante (firma del patrón) ── */}
          <AnimatePresence>
            {units > 0 && (
              <motion.button
                className="pd-cartbar"
                onClick={() => { setSheet(true); play('tap', 0.45, 1.0) }}
                initial={{ y: 90, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 90, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              >
                <span className="pd-cb-n tnum">{units}</span>
                <span className="pd-cb-t">Ver pedido</span>
                <span className="pd-cb-eur tnum">{eur(total)} €</span>
              </motion.button>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── Pago online ── */}
      {step === 'pago' && (
        <main className="pd-pay">
          <button className="pd-back" onClick={() => { setStep('menu'); play('tap', 0.36, 0.9) }}>← Volver a la carta</button>
          <h2 className="pd-h2">Tu pedido · {destino}</h2>
          <div className="pd-lines">
            {cart.map((l) => (
              <div key={l.id} className="pd-line">
                <div className="pd-l-info">
                  <b>{l.name}</b>
                  {l.detail && <span>{l.detail}</span>}
                </div>
                <div className="pd-step">
                  <button onClick={() => dec(l.id)} aria-label="quitar">−</button>
                  <span className="tnum">{l.qty}</span>
                  <button onClick={() => inc(l.id)} aria-label="añadir">+</button>
                </div>
                <b className="pd-l-eur tnum">{eur(l.price * l.qty)} €</b>
              </div>
            ))}
          </div>

          {/* ── Upsell inteligente: tu favorito (a medida) o un best-seller que no llevas ── */}
          {upProd && (
            <motion.button className="pd-upsell" onClick={() => { addByName(upProd.name); play('pop', 0.55, 1.4) }}
              initial={rm ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ ease }}>
              <img className="pd-up-img" src={upProd.img} alt="" />
              <span className="pd-up-txt">
                <b>{upEsFav ? `Casi siempre pides ${upProd.name} ${UP_EMOJI[upProd.cat] || '✨'} ¿esta vez también?` : `¿Rematas con ${upProd.name}? ${UP_EMOJI[upProd.cat] || '✨'}`}</b>
                <span>Tócalo y se suma · +{eur(upProd.price)} €</span>
              </span>
              <span className="pd-up-add">+</span>
            </motion.button>
          )}

          {/* ── Canjear recompensa de fidelidad (postre gratis) ── */}
          {tieneRecompensa && (
            <button className={'pd-reward' + (redeem ? ' on' : '')} onClick={() => { setRedeem((v) => !v); play('toggle', 0.42, redeem ? 0.9 : 1.15) }} aria-pressed={redeem}>
              <span className="pd-reward-ic">🎁</span>
              <span className="pd-reward-txt"><b>Postre gratis</b><span>Tu recompensa de fidelidad · −{eur(REWARD_VALUE)} €</span></span>
              <span className={'pd-reward-check' + (redeem ? ' on' : '')}>{redeem ? '✓' : ''}</span>
            </button>
          )}

          <div className="pd-tip">
            <span>Propina <em>(opcional)</em></span>
            <div className="pd-tip-opts">
              {[0, 5, 10, 15].map((t) => (
                <button key={t} className={'pd-chip' + (tipPct === t ? ' on' : '')} onClick={() => { setTipPct(t); play('tap', 0.36, 1.05) }}>{t === 0 ? 'No' : t + '%'}</button>
              ))}
            </div>
          </div>

          <div className="pd-tots">
            <div className="r"><span>Subtotal</span><b className="tnum">{eur(subtotal)} €</b></div>
            <div className="r"><span>IVA 10%</span><b className="tnum">{eur(iva)} €</b></div>
            {tipPct > 0 && <div className="r"><span>Propina {tipPct}%</span><b className="tnum">{eur(propina)} €</b></div>}
            {descuento > 0 && <div className="r"><span>Recompensa 🎁</span><b className="tnum">−{eur(descuento)} €</b></div>}
            <div className="r tot"><span>Total</span><b className="tnum">{eur(pagar)} €</b></div>
          </div>

          {/* Tarjeta (simulada) */}
          <div className="pd-card-form">
            <div className="pd-cc">
              <span className="pd-cc-chip" />
              <span className="pd-cc-num tnum">{num || '•••• •••• •••• ••••'}</span>
              <span className="pd-cc-row"><span className="tnum">{exp || 'MM/AA'}</span><span className="pd-cc-brand">REBELL PAY</span></span>
            </div>
            <input className="pd-in" inputMode="numeric" autoComplete="cc-number" name="cardnumber" aria-label="Número de tarjeta" placeholder="Número de tarjeta" value={num} onChange={(e) => onNum(e.target.value)} />
            <div className="pd-in2">
              <input className="pd-in" inputMode="numeric" autoComplete="cc-exp" name="cc-exp" aria-label="Caducidad MM/AA" placeholder="MM/AA" value={exp} onChange={(e) => onExp(e.target.value)} />
              <input className="pd-in" inputMode="numeric" autoComplete="cc-csc" name="cc-csc" aria-label="Código de seguridad CVC" placeholder="CVC" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} />
            </div>
          </div>

          <button className={'pd-paybtn' + (cardOk && !paying && cart.length ? '' : ' off')} onClick={pagarOnline} disabled={!cardOk || paying || !cart.length}>
            {paying ? <span className="pd-spin" /> : <>Pagar {eur(pagar)} €</>}
          </button>
          <p className="pd-secure">🔒 Pago cifrado · demo sin cargo real</p>
        </main>
      )}

      {/* ── Éxito ── */}
      {step === 'ok' && (
        <main className="pd-ok">
          <motion.div className="pd-check" initial={rm ? false : { scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 16 }}>
            <svg viewBox="0 0 52 52" width="84" height="84"><circle cx="26" cy="26" r="24" fill="none" stroke="var(--brand)" strokeWidth="3" /><motion.path d="M15 27 l8 8 l15 -16" fill="none" stroke="var(--brand)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={rm ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.15, ease }} /></svg>
          </motion.div>
          <motion.h1 initial={rm ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, ease }}>¡Pedido confirmado!</motion.h1>
          <motion.p className="pd-ok-sub" initial={rm ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            Comanda <b className="tnum">#{orderN}</b> · {destino}
          </motion.p>

          {/* ── Seguimiento EN VIVO del pedido ── */}
          {(() => {
            const idx = STAGES.findIndex((s) => s.k === estado)
            return (
              <div className="pd-track" style={{ ['--p' as string]: idx / (STAGES.length - 1) }}>
                {STAGES.map((s, i) => {
                  const st = i < idx ? 'done' : i === idx ? 'now' : 'todo'
                  return (
                    <div key={s.k} className={'pd-track-step ' + st}>
                      <span className="pd-track-dot">{st === 'done' ? '✓' : s.emoji}</span>
                      <span className="pd-track-lbl">{s.label}</span>
                    </div>
                  )
                })}
              </div>
            )
          })()}
          <p className="pd-track-msg">
            {estado === 'cocina' && 'Tu pedido está en cocina 👨‍🍳'}
            {estado === 'saliendo' && '¡Sale ya de cocina! 🍔'}
            {estado === 'listo' && (mesaName ? '¡Listo! Te lo llevamos a la mesa 🔔' : '¡Listo! Pasa a recogerlo 🔔')}
          </p>
          {estado !== 'listo' && (
            <button className={'pd-notify' + (notify ? ' on' : '')} onClick={pedirAviso} aria-pressed={notify}>
              {notify ? '🔔 Te avisaremos al móvil' : '🔔 Avísame al móvil cuando esté listo'}
            </button>
          )}

          {/* ── Reseña con premio: al estar listo, valora y te sellamos doble ── */}
          {estado === 'listo' && (
            reviewed ? (
              <motion.div className="pd-review done" initial={rm ? false : { opacity: 0 }} animate={{ opacity: 1 }}>¡Gracias por valorarnos! Sello extra añadido 🍔</motion.div>
            ) : (
              <motion.div className="pd-review" initial={rm ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>
                <span className="pd-review-q">¿Qué tal todo? Valóranos y te <b>sellamos doble</b> 🍔🍔</span>
                <button className="pd-review-btn" onClick={() => { window.open(reviewUrl(), '_blank'); addStamp(); setReviewed(true); play('success', 0.55) }}>⭐ Valorar en Google</button>
              </motion.div>
            )
          )}

          <div className="pd-ok-tot"><span>Pagado</span><b className="tnum">{eur(paidAmount)} €</b></div>

          {/* ── Crear cuenta (reconocerte la próxima vez) ── */}
          {!cli.name ? (
            <div className="pd-acc">
              <span className="pd-acc-q">¿Cómo te llamas? Te reconocemos la próxima vez 💛</span>
              <div className="pd-acc-row">
                <input className="pd-in" aria-label="Tu nombre" placeholder="Tu nombre" value={nameInput} maxLength={24} onChange={(e) => setNameInput(e.target.value)} />
                <button className="pd-acc-btn" disabled={!nameInput.trim()} onClick={() => { setNombre(nameInput); play('success', 0.5) }}>Guardar</button>
              </div>
            </div>
          ) : (
            <div className="pd-acc done">Cuenta guardada ✓ · {cli.name}, tu carta te recordará 💛</div>
          )}

          <button className="pd-again" onClick={() => { setCart([]); setNum(''); setExp(''); setCvc(''); setTipPct(0); setRedeem(false); setNotify(false); setReviewed(false); setSheet(false); setNameInput(''); setStep('menu'); play('tap', 0.4, 1.1) }}>Pedir algo más</button>
        </main>
      )}

      {/* ── Hoja resumen del pedido (desde la píldora) ── */}
      <AnimatePresence>
        {sheet && step === 'menu' && (
          <motion.div className="pd-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet(false)}>
            <motion.div className="pd-sheet" role="dialog" aria-modal="true" aria-label="Resumen de tu pedido" onClick={(e) => e.stopPropagation()} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 360, damping: 36 }}>
              <span className="pd-grab" />
              <h3>Tu pedido</h3>
              <div className="pd-lines">
                {cart.map((l) => (
                  <div key={l.id} className="pd-line">
                    <div className="pd-l-info"><b>{l.name}</b>{l.detail && <span>{l.detail}</span>}</div>
                    <div className="pd-step"><button onClick={() => dec(l.id)} aria-label={`Quitar uno de ${l.name}`}>−</button><span className="tnum">{l.qty}</span><button onClick={() => inc(l.id)} aria-label={`Añadir uno de ${l.name}`}>+</button></div>
                    <b className="pd-l-eur tnum">{eur(l.price * l.qty)} €</b>
                  </div>
                ))}
              </div>
              <button className="pd-paybtn" onClick={() => { setSheet(false); setStep('pago'); play('tap', 0.5, 1.0) }}>Ir a pagar · {eur(total)} €</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Constructor de menú ── */}
      <AnimatePresence>
        {building && (
          <motion.div className="pd-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBuilding(null)}>
            <motion.div className="pd-sheet build" role="dialog" aria-modal="true" aria-label={`Arma tu ${building.name}`} onClick={(e) => e.stopPropagation()} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 360, damping: 36 }}>
              <span className="pd-grab" />
              <h3>{building.name}{menuAhorro > 0 && <span className="pd-save">ahorras {eur(menuAhorro)} €</span>}</h3>
              {MENU_SLOTS.map((s) => (
                <div key={s.key} className="pd-slot">
                  <div className="pd-slot-h">{s.label}{!s.required && <em> (opcional)</em>}</div>
                  <div className="pd-slot-row">
                    {PRODUCTOS.filter((p) => p.cat === s.cat).map((p) => (
                      <button key={p.id} className={'pd-pick' + (picks[s.key] === p.id ? ' on' : '')} onClick={() => { setPicks((pr) => ({ ...pr, [s.key]: p.id })); play('tap', 0.4, 1.1) }}>
                        <img src={p.img} alt={p.name} loading="lazy" /><span>{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button className={'pd-paybtn' + (menuReady ? '' : ' off')} disabled={!menuReady} onClick={addMenu}>Añadir menú · {eur(menuPrice)} €</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
