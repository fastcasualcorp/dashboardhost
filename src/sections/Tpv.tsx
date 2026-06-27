import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { SectionHeader, Badge } from '../components/ui'
import { eur, eur0, reduceMotion } from '../lib/data'
import { PRODUCTOS, CAT_ORDER, MENU_SLOTS, MENU_DISCOUNT, isMenu, colorOf, type Producto } from '../lib/products'
import { play } from '../lib/sound'
import { loadSalonLive, loadSalon, allLibre, saveSalon, mesaRemaining, cobroAmount, ESTADO_COLOR, type Mesa } from '../lib/salon'
import { fireCobro, resetWallet, addWallet, walletTotal, useCajaDelDia, logCobro, type Metodo } from '../lib/wallet'
import { MesaTile } from '../components/MesaTile'
import { loadCaja, abrirCaja, cerrarCaja, nextTicket, ticketsHoy, GERENTE_PIN, type CajaEstado } from '../lib/caja'
import { pushComanda } from '../lib/comandas'
import { cuentaTotal, cuentaItems, addToCuenta, seedCuenta, clearCuenta, clearAllCuentas, useCuentas } from '../lib/cuentas'
import { appendVenta } from '../lib/ventas'
import { consumirVenta } from '../lib/almacen'
import { supabase, localId } from '../lib/supabase'

type Line = { id: string; name: string; price: number; qty: number; detail?: string }

// redondeo a 0,05 € (precios "de carta")
const round05 = (n: number) => Math.round(n * 20) / 20

// nº de ticket → entero para la columna `numero` de la comanda (la BD guarda int; la UI muestra "T-013").
const ticketNum = (t: string | null) => (t ? parseInt(t.replace(/\D/g, ''), 10) || 0 : 0)

// Persistencia en Supabase (por local, vía RLS). Fire-and-forget: no bloquea la caja.
// El nº de ticket viaja a venta Y comanda → trazabilidad (si se pierde una comanda y el cliente llama).
async function persistVenta(total: number, mesaNombre: string | null, ticket: string | null, metodo: Metodo) {
  const lid = localId()
  if (!supabase || !lid) return
  try {
    await supabase.from('ventas').insert({ local_id: lid, total: Math.round(total * 100) / 100, metodo, mesa: mesaNombre, doc: 'ticket', numero: ticketNum(ticket) })
  } catch {
    /* sin conexión: la venta se ve igual en caja */
  }
}
async function persistComanda(items: Line[], mesaNombre: string | null, ticket: string | null) {
  const lid = localId()
  if (!supabase || !lid) return
  try {
    await supabase.from('comandas').insert({ local_id: lid, numero: ticketNum(ticket), fuente: 'Sala', mesa: mesaNombre, items, estado: 'nueva' })
  } catch {
    /* sin conexión */
  }
}

export default function Tpv() {
  const [cart, setCart] = useState<Line[]>([])
  const shownVentas = useCajaDelDia() // "Ventas hoy" = MISMA fuente que la cartera "Hoy" → nunca divergen
  const [pulse, setPulse] = useState(0)
  const [paid, setPaid] = useState(false)
  // ── Pago (efectivo / tarjeta + calculadora de cambio + dividir cuenta) ──
  const [payOpen, setPayOpen] = useState(false)
  const [metodo, setMetodo] = useState<Metodo | null>(null)
  const [cash, setCash] = useState('')
  const [split, setSplit] = useState(1) // dividir la cuenta entre N personas
  const [paidShares, setPaidShares] = useState(0) // partes ya cobradas
  const [cat, setCat] = useState('Burgers')
  const [building, setBuilding] = useState<Producto | null>(null)
  const [picks, setPicks] = useState<Record<string, string>>({})
  // Mesa de la comanda (del plano del Salón) + envío a cocina (Comanda).
  const [mesa, setMesa] = useState<Mesa | null>(null)
  const [pickOpen, setPickOpen] = useState(true) // se abre AL ENTRAR: primero hay que decir a qué mesa va
  const [mesaChosen, setMesaChosen] = useState(false) // hasta elegir mesa/llevar, no se puede tocar el menú
  // Plano: si la caja está CERRADA, el local está vacío → todas libres; si está abierta, mesas vivas (estado + reservas).
  const [mesas, setMesas] = useState<Mesa[]>(() => (loadCaja().abierta ? loadSalonLive() : allLibre(loadSalon())))
  const [now, setNow] = useState(() => Date.now()) // reloj 1s → la cuenta atrás de las reservas avanza
  const [ticket, setTicket] = useState<string | null>(null) // nº de ticket del pedido en curso (T-013)
  // ── Caja (abrir/cerrar con PIN del encargado) ──
  const [caja, setCaja] = useState<CajaEstado>(() => loadCaja())
  const [cajaModal, setCajaModal] = useState<'abrir' | 'cerrar' | null>(null)
  const [pin, setPin] = useState('')
  const [pinErr, setPinErr] = useState(false)
  const [reward, setReward] = useState<{ total: number; tickets: number } | null>(null) // overlay de cierre
  const [sent, setSent] = useState(false)
  const combo = useRef({ n: 0, t: 0 })
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

  useCuentas() // open-tab: re-render al cambiar la cuenta de una mesa (rondas)
  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0)
  const iva = subtotal * 0.1
  const total = subtotal + iva
  const items = cart.reduce((s, l) => s + l.qty, 0)
  const qtyOf = (id: string) => cart.find((l) => l.id === id)?.qty ?? 0
  // CUENTA ABIERTA (multi-ronda): lo ya acumulado en la mesa + lo del carrito actual = lo que se cobra al cerrar.
  const mesaTab = mesa ? cuentaTotal(mesa.id) : 0
  const cobroTotal = Math.round((total + mesaTab) * 100) / 100
  // DIVIDIR CUENTA: importe de la parte actual (la última parte ajusta los céntimos para cuadrar el total).
  const r2 = (n: number) => Math.round(n * 100) / 100
  const shareAmount = split > 1 ? r2(cobroTotal / split) : cobroTotal
  const isLastShare = paidShares >= split - 1
  const payAmount = split > 1 ? (isLastShare ? r2(cobroTotal - shareAmount * (split - 1)) : shareAmount) : cobroTotal

  // ── Mesa (del plano del Salón) ──
  function openPicker() {
    setMesas(loadSalonLive()) // recarga el plano VIVO por si se editó el salón (mismo origen que el Salón)
    setNow(Date.now())
    setPickOpen(true)
    play('tap', 0.5, 1.1)
  }
  // La VIDA del salón sigue, pero REALISTA: al irse una mesa, entra gente nueva a una libre. Las mesas pasan a
  // "por cobrar" SOLAS cuando se les acaba su tiempo (ver el reloj, abajo), NUNCA se fuerza una mesa con tiempo
  // de sobra (eso era el bug: una mesa con 57 min saltaba a cobrar al cobrar otra). (Juan, 26-jun)
  function avanzarServicio(list: Mesa[], now: number, exceptId?: string): Mesa[] {
    const next = list.map((mm) => ({ ...mm }))
    // entra gente nueva a OTRA mesa libre (no la recién liberada → esa se queda vacía) con su reserva (volverá a
    // "por cobrar" sola al acabar su tiempo)
    const libre = next.find((mm) => (mm.estado ?? 'libre') === 'libre' && mm.id !== exceptId)
    if (libre) {
      libre.estado = 'ocupada'
      libre.since = now
      libre.reservaFin = now + (10 + Math.floor(Math.random() * 30)) * 60000 // 10-40 min
    }
    return next
  }
  // Tocar una mesa POR COBRAR = cobrarla: las moneditas vuelan a la cartera del día (arriba-dcha), la mesa
  // queda LIBRE y el picker sigue abierto (ves cómo se pone verde y el € sube). No abre pedido. (Juan, 26-jun)
  // Candado: ninguna operación de DINERO sin la caja abierta (antes el badge era decorativo). gap 1.5
  function requireCaja(): boolean {
    if (caja.abierta) return true
    play('error', 0.4)
    setPickOpen(false)
    setCajaModal('abrir') // guía al usuario a abrir la caja (PIN del encargado)
    return false
  }
  function cobrarMesa(m: Mesa, e?: ReactMouseEvent<HTMLButtonElement>) {
    if (!requireCaja()) return
    // importe REAL de la mesa: su cuenta acumulada; si no tiene (mesa que pidió cuenta por tiempo), la semilla estable
    const amount = cuentaTotal(m.id) || cobroAmount(m)
    const r = e?.currentTarget?.getBoundingClientRect()
    const x = r ? r.left + r.width / 2 : window.innerWidth / 2
    const y = r ? r.top + r.height / 2 : window.innerHeight / 2
    addWallet(amount) // EL DINERO SUBE EN ORIGEN (robusto, no depende de la animación de monedas)
    logCobro(amount, 'mesa', `Mesa ${m.nombre}`) // apunta el pedido en el desglose de la cartera
    fireCobro({ amount, x, y, coins: 9 }) // monedas = solo el adorno que vuela a la cartera
    clearCuenta(m.id) // la mesa queda saldada
    setMesas((prev) => {
      const cobrada = prev.map((mm) => (mm.id === m.id ? { ...mm, estado: 'libre' as const, since: undefined, reservaFin: undefined } : mm))
      const next = avanzarServicio(cobrada, Date.now(), m.id)
      saveSalon(next)
      return next
    })
    play('pop', 0.5, 1.35)
  }
  function chooseMesa(m: Mesa | null, e?: ReactMouseEvent<HTMLButtonElement>) {
    if (m && (m.estado ?? 'libre') === 'cobrar') {
      cobrarMesa(m, e)
      return
    }
    setMesa(m)
    setMesaChosen(true)
    setPickOpen(false)
    // Un pedido = un nº de ticket. Se reserva al elegir destino (mesa o "para llevar") si no había uno.
    if (!ticket) setTicket(nextTicket())
    play('pop', 0.5, m ? 1.2 : 0.9)
  }

  // Comanda → enviar a cocina (KDS). En frontend marca "enviada"; con Supabase
  // hará insert en `comandas` con items + mesa.
  function comanda() {
    if (!cart.length) return
    const tk = ticket ?? nextTicket()
    if (!ticket) setTicket(tk)
    play('success', 0.4, 1.28)
    setSent(true)
    window.setTimeout(() => setSent(false), 1700)
    // → COCINA en vivo (KDS): la comanda aparece en el tablero al instante (store local)
    pushComanda({ n: ticketNum(tk), mesa: mesa?.nombre ?? null, items: cart.map((l) => ({ name: l.name, qty: l.qty })), src: 'Sala' })
    void persistComanda(cart, mesa?.nombre ?? null, tk) // + Supabase (trazabilidad), cuando haya backend
    // CUENTA ABIERTA: si es una mesa, la ronda se SUMA a su cuenta y el carrito se vacía → listo para otra ronda.
    if (mesa) {
      addToCuenta(mesa.id, total, cart.map((l) => ({ name: l.name, qty: l.qty })))
      setMesas((prev) => {
        const next = prev.map((mm) => (mm.id === mesa.id ? { ...mm, estado: 'ocupada' as const, since: mm.since ?? Date.now() } : mm))
        saveSalon(next)
        return next
      })
      setCart([])
      setTicket(null) // cada ronda lleva su propio nº de ticket de cocina
    }
  }

  // "Cobrar" abre el panel de pago (elegir efectivo/tarjeta). El cobro real lo hace confirmCobro.
  function openPay() {
    if (!cart.length && mesaTab <= 0) return // nada que cobrar (ni carrito ni cuenta abierta)
    if (!requireCaja()) return
    setMetodo(null)
    setCash('')
    setSplit(1) // empieza sin dividir
    setPaidShares(0)
    setPayOpen(true)
    play('tap', 0.45)
  }
  function confirmCobro(m: Metodo) {
    if (cobroTotal <= 0) return
    // ── DIVIDIR: si quedan partes por cobrar, esta es una parte intermedia (la caja suma, pero NO se salda aún) ──
    if (split > 1 && !isLastShare) {
      addWallet(payAmount)
      logCobro(payAmount, 'mesa', `${mesa ? 'Mesa ' + mesa.nombre : 'Cuenta'} · parte ${paidShares + 1}/${split}`, m)
      play('success', 0.45, 1.05)
      setPaidShares((p) => p + 1)
      setMetodo(null)
      setCash('')
      return // el panel sigue abierto para la siguiente parte
    }
    // ── ÚLTIMA parte (o pago completo): se salda toda la cuenta y se registra la venta UNA vez ──
    const tabItems = mesa ? cuentaItems(mesa.id) : []
    const allItems = [...tabItems, ...cart.map((l) => ({ name: l.name, qty: l.qty }))]
    const arts = allItems.reduce((s, i) => s + i.qty, 0)
    // "Caja que suma": el ticket entra al MISMO bote que las moneditas (caja del día). + ka-ching escalado.
    addWallet(payAmount) // solo la última parte (las anteriores ya sumaron); si no se divide, = cobroTotal
    logCobro(payAmount, 'ticket', `${ticket ?? 'Ticket'} · ${mesa ? 'Mesa ' + mesa.nombre : 'Para llevar'}${split > 1 ? ` · parte ${split}/${split}` : ''}`, m)
    appendVenta({ id: ticket, tipo: 'ticket', arts, total: cobroTotal, metodo: m, mesa: mesa?.nombre ?? null }) // venta = la cuenta COMPLETA, una vez
    consumirVenta(allItems) // → ALMACÉN: baja el stock de TODO lo vendido (una vez)
    play('success', 0.5, cobroTotal > 50 ? 0.84 : cobroTotal > 25 ? 0.92 : 1)
    setPulse((p) => p + 1)
    setPaid(true)
    setCart([])
    void persistVenta(cobroTotal, mesa?.nombre ?? null, ticket, m) // → libro de ventas (con su nº de ticket y método)
    if (mesa) {
      clearCuenta(mesa.id) // saldada la cuenta de la mesa
      setMesas((prev) => { const next = prev.map((mm) => (mm.id === mesa.id ? { ...mm, estado: 'libre' as const, since: undefined, reservaFin: undefined } : mm)); saveSalon(next); return next })
    }
    setSplit(1)
    setPaidShares(0)
    setMesa(null) // la mesa queda libre tras cobrar
    setTicket(null) // cerrado el ticket → el siguiente pedido toma un nº nuevo
    setPayOpen(false)
    setMetodo(null)
    setCash('')
  }

  // Coherencia caja↔salón: con caja ABIERTA el plano cobra vida; con caja CERRADA (local vacío) todas las mesas
  // quedan LIBRES y se saldan las cuentas. Reacciona al abrir/cerrar caja. (Juan, 27-jun)
  useEffect(() => {
    if (caja.abierta) {
      setMesas(loadSalonLive())
    } else {
      const libre = allLibre(loadSalon())
      saveSalon(libre)
      clearAllCuentas()
      setMesas(libre)
    }
  }, [caja.abierta])

  // Reloj a 1s SOLO mientras el selector está abierto (ahorra batería): la cuenta atrás de cada reserva avanza.
  // Y cuando una mesa AGOTA su tiempo, pide la cuenta SOLA → pasa a "por cobrar" (natural; jamás se toca una mesa
  // con tiempo de sobra). Así siempre van apareciendo mesas que cobrar, pero sin el bug de saltos raros. (Juan)
  useEffect(() => {
    if (!pickOpen || !caja.abierta) return // sin servicio (caja cerrada) no hay vida en las mesas
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      setMesas((prev) => {
        let changed = false
        const next = prev.map((m) => {
          const rem = mesaRemaining(m, t)
          if (m.estado === 'ocupada' && rem != null && rem <= 0) {
            changed = true
            seedCuenta(m.id, cobroAmount(m)) // al pedir la cuenta, su importe queda FIJADO (estable, no recalculado)
            return { ...m, estado: 'cobrar' as const, reservaFin: undefined }
          }
          return m
        })
        if (changed) saveSalon(next)
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(id)
  }, [pickOpen, caja.abierta])

  // ── PIN del encargado (abrir/cerrar caja) ──
  function pinKey(d: string) {
    if (cajaModal == null) return
    if (d === 'del') { setPin((p) => p.slice(0, -1)); play('tap', 0.4, 0.9); return }
    const next = (pin + d).slice(0, 4)
    setPin(next)
    play('tap', 0.4, 1.12)
    if (next.length < 4) return
    if (next === GERENTE_PIN) {
      if (cajaModal === 'abrir') {
        setCaja(abrirCaja())
        resetWallet() // turno nuevo → la cartera del día arranca de 0 y acumula hasta el cierre
        play('success', 0.5, 1.15)
      } else {
        setReward({ total: walletTotal(), tickets: ticketsHoy() }) // dispara la recompensa de cierre (caja del día)
        setCaja(cerrarCaja())
      }
      setCajaModal(null)
      setPin('')
    } else {
      play('error', 0.55)
      setPinErr(true)
      window.setTimeout(() => { setPin(''); setPinErr(false) }, 440)
    }
  }
  function openCaja() {
    setCajaModal(caja.abierta ? 'cerrar' : 'abrir')
    setPin('')
    setPinErr(false)
    play('tap', 0.5, 1)
  }

  const prods = PRODUCTOS.filter((p) => p.cat === cat)

  // Plano del salón para el selector de mesa: escala al tamaño REAL disponible del panel (ancho y ALTO).
  // Caja contenedora AJUSTADA a las mesas (sin los márgenes vacíos del plano) → el picker las pinta lo más
  // GRANDES posible y centradas, llenando el panel (Juan, 26-jun).
  const minX = mesas.length ? Math.min(...mesas.map((m) => m.x)) : 0
  const minY = mesas.length ? Math.min(...mesas.map((m) => m.y)) : 0
  const planoBounds = mesas.reduce((b, m) => ({ w: Math.max(b.w, m.x + m.w - minX), h: Math.max(b.h, m.y + m.h - minY) }), { w: 1, h: 1 })
  const [planoBox, setPlanoBox] = useState({ w: 520, h: 360 })
  const roRef = useRef<ResizeObserver | null>(null)
  // Ref-CALLBACK: el observer se ata SIEMPRE al nodo VIVO del plano. El picker se porta a `.app` y en el primer
  // render el portal se re-parenta (body→.app) recreando el nodo → un ResizeObserver montado en un efecto se
  // quedaba observando el nodo VIEJO (muerto) y la escala se clavaba en pequeño en la PRIMERA apertura. Con el
  // callback se reengancha al nodo nuevo y mide bien siempre. (Juan, 26-jun)
  const planoCb = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect()
    if (!el) return
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (w > 160 && h > 160) setPlanoBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    roRef.current = ro
  }, [])
  // "cover": llena el panel por el lado que más manda → mesas GRANDES; lo que desborda se alcanza paneando
  // (scroll/táctil). Tope 1.8× para que no se desmadre. (Juan, 26-jun)
  const planoScale = Math.min(1.8, Math.max(planoBox.w / planoBounds.w, planoBox.h / planoBounds.h))
  // Recuento en vivo (cabecera del selector) — mismo lenguaje que el Salón
  const libres = mesas.filter((m) => (m.estado ?? 'libre') === 'libre').length
  const ocupadas = mesas.filter((m) => m.estado === 'ocupada').length
  const porCobrar = mesas.filter((m) => m.estado === 'cobrar').length
  // Los overlays se portan a .app (no a <body>): así tapan TODO el viewport SIN quedar recortados por el
  // panel de contenido (que tiene transform) y SIN perder los tokens de diseño (--gold, --surface… viven en .app).
  const overlayRoot = document.querySelector('.app') ?? document.body

  // ── Atajos de teclado (POS rápido) ──────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Enter') { e.preventDefault(); openPay(); return }
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

  // Calculadora de cambio (pago en efectivo) — sobre el importe de la PARTE actual (o el total si no se divide)
  const cashNum = parseFloat(cash.replace(',', '.')) || 0
  const cambio = Math.max(0, Math.round((cashNum - payAmount) * 100) / 100)
  const payQuick = (() => {
    const exact = Math.round(payAmount * 100) / 100
    const ups = [5, 10, 20, 50].map((s) => Math.ceil(payAmount / s) * s).filter((v) => v > payAmount + 0.001)
    return [exact, ...Array.from(new Set(ups))].slice(0, 5)
  })()

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
            <button
              className={'tpv-caja-badge' + (caja.abierta ? ' on' : ' off')}
              onClick={openCaja}
              title={caja.abierta ? 'Cerrar caja (PIN)' : 'Abrir caja (PIN)'}
            >
              <span className="tcb-dot" />
              {caja.abierta ? 'Caja abierta' : 'Abrir caja'}
            </button>
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
              <h3>
                Ticket
                {ticket && <span className="tk-num tnum">{ticket}</span>}
              </h3>
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
            {mesaTab > 0 && (
              <div className="tk-row tk-tab">
                <span>＋ Cuenta mesa {mesa?.nombre}</span>
                <b className="tnum">{eur(mesaTab)} €</b>
              </div>
            )}
            <div className="tk-row big">
              <span>{mesaTab > 0 ? 'Total a cobrar' : 'Total'}</span>
              <b className="tnum">{eur(mesaTab > 0 ? cobroTotal : total)} €</b>
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
              <button className={'tpv-pay' + (cart.length || mesaTab > 0 ? '' : ' off')} onClick={openPay} disabled={!cart.length && mesaTab <= 0}>
                Cobrar {eur(cobroTotal)} €
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Selector de mesa = MAPA DE SALA en vivo (mismo plano que el editor de Salón) ──
          Grande, ocupa casi toda la pantalla. Cada mesa muestra su estado (libre/ocupada/cobrar) y,
          si está ocupada, lo que queda de su reserva → decides de un vistazo dónde sentar.
          Se porta a <body> para tapar TODO (barra lateral incluida) sin que un ancestro con transform lo recorte. */}
      {createPortal(
      <AnimatePresence>
        {pickOpen && (
          <motion.div className="tpv-mesa-scrim" initial={{ opacity: mesaChosen ? 0 : 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => mesaChosen && setPickOpen(false)}>
            <motion.div
              className="tpv-mesa-panel"
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30, mass: 0.8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="tms-head">
                <div className="tms-htxt">
                  <b>¿A qué mesa va?</b>
                  <small>{mesaChosen ? 'Pulsa una mesa del plano o elige “Para llevar”' : 'Elige el destino para empezar el pedido'}</small>
                </div>
                <div className="tms-live">
                  <span className="tms-chip libre"><i />{libres} libres</span>
                  <span className="tms-chip ocupada"><i />{ocupadas} ocupadas</span>
                  <span className="tms-chip cobrar"><i />{porCobrar} por cobrar</span>
                </div>
                {mesaChosen && (
                  <button className="mb-x" onClick={() => setPickOpen(false)} aria-label="Cerrar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                )}
              </header>

              <div className="tpv-mesa-plano" ref={planoCb}>
                {/* mesas a px REALES dentro de un lienzo escalado por transform → IGUAL que el Salón
                    (mismo componente MesaTile + clases .salon-mesa.srv.e-* → nunca se ven distintos). */}
                <div className="tmp-fit" style={{ width: planoBounds.w * planoScale, height: planoBounds.h * planoScale }}>
                  <div className="tmp-canvas" style={{ width: planoBounds.w, height: planoBounds.h, transform: `scale(${planoScale})`, transformOrigin: 'top left' }}>
                    {mesas.map((m) => {
                      const est = m.estado ?? 'libre'
                      const rem = mesaRemaining(m, now)
                      const over = rem != null && rem <= 0
                      return (
                        <button
                          key={m.id}
                          className={'tmp-pick salon-mesa srv e-' + est + (over ? ' over' : '') + (mesa?.id === m.id ? ' on' : '')}
                          style={{ left: m.x - minX, top: m.y - minY, width: m.w, height: m.h, ['--heat' as string]: ESTADO_COLOR[est] } as CSSProperties}
                          onClick={(e) => chooseMesa(m, e)}
                        >
                          <MesaTile mesa={m} rem={rem} over={over} cobrar={est === 'cobrar'} />
                        </button>
                      )
                    })}
                  </div>
                </div>
                {!mesas.length && <div className="salon-empty">Aún no hay salón · créalo en “Salón”</div>}
              </div>

              <footer className="tpv-mesa-foot">
                <span className="tms-legend">Verde = libre · Rojo = ocupada · Ámbar = por cobrar · el número es lo que queda de reserva</span>
                <button className={'tmp-llevar' + (!mesa ? ' on' : '')} onClick={() => chooseMesa(null)}>
                  {/* bolsa de delivery: lados rectos, solapa de papel plegada arriba, asa colgando (no bolsa de basura) */}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6.5 3 4.5 7.2V19a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7.2L17.5 3H6.5Z" />
                    <path d="M4.5 7.2h15" />
                    <path d="M15 10.5a3 3 0 0 1-6 0" />
                  </svg>
                  Para llevar
                </button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      overlayRoot)}

      {/* ── Abrir / Cerrar caja (PIN del encargado) ── */}
      {createPortal(
      <AnimatePresence>
        {cajaModal && (
          <motion.div className="caja-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setCajaModal(null); setPin('') }}>
            <motion.div
              className={'caja-modal' + (pinErr ? ' err' : '')}
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={'caja-modal-ic ' + cajaModal}>
                {cajaModal === 'cerrar' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.9-1" /></svg>
                )}
              </div>
              <b className="caja-modal-t">{cajaModal === 'cerrar' ? 'Cerrar caja' : 'Abrir caja'}</b>
              <small className="caja-modal-s">
                {cajaModal === 'cerrar' ? `Cierre del turno · ${eur(walletTotal())} € · ${ticketsHoy()} tickets` : 'Introduce el PIN del encargado para empezar el turno'}
              </small>
              <div className={'pin-dots' + (pinErr ? ' shake' : '')}>
                {[0, 1, 2, 3].map((i) => <span key={i} className={'pin-dot' + (i < pin.length ? ' fill' : '')} />)}
              </div>
              <div className="pin-pad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <button key={d} className="pin-key" onClick={() => pinKey(d)}>{d}</button>
                ))}
                <span className="pin-key ghost" />
                <button className="pin-key" onClick={() => pinKey('0')}>0</button>
                <button className="pin-key del" onClick={() => pinKey('del')} aria-label="Borrar">⌫</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      overlayRoot)}

      {/* ── Recompensa de cierre de caja (one-shot) ── */}
      {createPortal(
      <AnimatePresence>
        {reward && <CierreReward total={reward.total} tickets={reward.tickets} onClose={() => setReward(null)} />}
      </AnimatePresence>,
      overlayRoot)}

      {/* ── Panel de PAGO: efectivo / tarjeta + calculadora de cambio ── */}
      {createPortal(
      <AnimatePresence>
        {payOpen && (
          <motion.div className="pay-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPayOpen(false)}>
            <motion.div
              className="pay-panel"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pay-head">
                <span className="pay-k">Cobrar {mesa ? '· Mesa ' + mesa.nombre : '· Para llevar'}</span>
                <b className="pay-total tnum">{eur(cobroTotal)} €</b>
              </div>
              {/* Dividir la cuenta entre N personas (partes iguales). Bloqueado una vez se cobra la 1ª parte. */}
              <div className="pay-split">
                <span className="pay-split-lab">Dividir</span>
                <div className="pay-split-steps">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button key={n} className={'pay-split-n' + (split === n ? ' on' : '')} disabled={paidShares > 0} onClick={() => { setSplit(n); setMetodo(null); setCash(''); play('tap', 0.4, 0.9 + n * 0.04) }}>{n === 1 ? 'No' : n}</button>
                  ))}
                </div>
              </div>
              {split > 1 && (
                <div className="pay-split-info">
                  <span>Parte {Math.min(paidShares + 1, split)} de {split}{paidShares > 0 ? ` · ${paidShares} pagada${paidShares > 1 ? 's' : ''}` : ''}</span>
                  <b className="tnum">{eur(payAmount)} € / persona</b>
                </div>
              )}
              <div className="pay-methods">
                <button className="pay-m card" onClick={() => confirmCobro('tarjeta')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20" /></svg>
                  <span>Tarjeta</span>
                </button>
                <button className={'pay-m cash' + (metodo === 'efectivo' ? ' on' : '')} onClick={() => { setMetodo('efectivo'); setCash(''); play('tap', 0.4) }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>
                  <span>Efectivo</span>
                </button>
              </div>
              <AnimatePresence>
                {metodo === 'efectivo' && (
                  <motion.div className="pay-cash" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}>
                    <div className="pay-quick">
                      {payQuick.map((q, i) => (
                        <button key={i} className={'pay-q' + (cash === String(q) ? ' on' : '')} onClick={() => setCash(String(q))}>
                          {i === 0 ? 'Exacto' : eur(q) + ' €'}
                        </button>
                      ))}
                    </div>
                    <div className="pay-change">
                      <span>Cambio a devolver</span>
                      <b className="tnum">{eur(cambio)} €</b>
                    </div>
                    <button className="pay-confirm" disabled={cashNum < payAmount} onClick={() => confirmCobro('efectivo')}>
                      {cashNum < payAmount ? 'Elige el efectivo recibido' : `Cobrar${split > 1 ? ` parte ${Math.min(paidShares + 1, split)}/${split}` : ''} · cambio ${eur(cambio)} €`}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <button className="pay-cancel" onClick={() => setPayOpen(false)}>Cancelar</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      overlayRoot)}

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

// ── Recompensa de cierre de caja: count-up del día + check dorado con spring + confeti sutil (one-shot) ──
function CierreReward({ total, tickets, onClose }: { total: number; tickets: number; onClose: () => void }) {
  const [shown, setShown] = useState(reduceMotion() ? total : 0)
  const raf = useRef(0)
  useEffect(() => {
    play('success', 0.6, 0.9)
    if (reduceMotion()) return
    const start = performance.now()
    const dur = 1150
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur)
      const e = 1 - Math.pow(1 - k, 3)
      setShown(total * e)
      if (k < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [total])
  // auto-cierre suave (nada termina de golpe): se va solo a los 3,4 s, o con "Hecho"
  useEffect(() => {
    const id = window.setTimeout(onClose, 3400)
    return () => clearTimeout(id)
  }, [onClose])
  const parts = reduceMotion() ? [] : Array.from({ length: 22 }, (_, i) => i)
  const COLORS = ['var(--gold)', '#fff', '#34d399', 'var(--gold)']
  return (
    <motion.div className="cierre-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <div className="cierre-confetti" aria-hidden="true">
        {parts.map((i) => (
          <i key={i} className="cf" style={{ left: `${(i * 53) % 100}%`, background: COLORS[i % COLORS.length], ['--d' as string]: `${(i % 6) * 0.05}s`, ['--r' as string]: `${(i % 2 ? 1 : -1) * (60 + (i * 37) % 220)}deg` } as CSSProperties} />
        ))}
      </div>
      <motion.div
        className="cierre-card"
        initial={{ opacity: 0, scale: 0.82, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 10 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div className="cierre-check" initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 340, damping: 16, delay: 0.12 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
        </motion.div>
        <span className="cierre-kick">◢ CAJA CERRADA</span>
        <div className="cierre-num">
          <b className="tnum">{eur0(shown)}</b>
          <i>€</i>
        </div>
        <span className="cierre-sub">{tickets} ticket{tickets === 1 ? '' : 's'} · turno cerrado correctamente</span>
        <button className="cierre-done" onClick={onClose}>Hecho</button>
      </motion.div>
    </motion.div>
  )
}
