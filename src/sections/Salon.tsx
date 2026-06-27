import { useEffect, useRef, useState, type PointerEvent as RPE, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SectionHeader, Badge, Stat, StatRow } from '../components/ui'
import { play } from '../lib/sound'
import { type Mesa, type MesaForma, type MesaEstado, loadSalon, saveSalon, loadSalonDB, saveSalonDB, seatPositions, totalPlazas, seedStates, allLibre, cobroAmount, ESTADO_COLOR, elePath } from '../lib/salon'
import { fireCobro, logCobro, addWallet } from '../lib/wallet'
import { cuentaTotal, clearCuenta } from '../lib/cuentas'
import { loadCaja } from '../lib/caja'

// Caja cerrada ⟹ local vacío → todas las mesas libres (no hay servicio). Solo cobran vida con la caja abierta.
const planoSegunCaja = (list: Mesa[]) => (loadCaja().abierta ? seedStates(list) : allLibre(list))
import { MesaTile } from '../components/MesaTile'

/* Editor de Salón — diseñas tu sala arrastrando mesas, ajustando tamaño/forma y
   plazas. El plano alimenta el selector de mesa del TPV. Diseño REBELL (cromo +
   acentos), no el del panel del socio. Persistencia interina en localStorage;
   se conecta a Supabase (tabla `mesas` por local) con la auth real. */

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const FORMAS: { k: MesaForma; t: string }[] = [
  { k: 'cuadrada', t: 'Cuadrada' },
  { k: 'rect', t: 'Alargada' },
  { k: 'redonda', t: 'Redonda' },
  { k: 'ele', t: 'En L' },
]
// Mesa en L como SVG: el contorno recorre TODA la forma (un border CSS NO sigue los bordes nuevos de un
// clip-path) y se RECALCULA con el tamaño → fluido y armónico, sin deformar (regla de armonía, 26-jun).
// roundedPolyPath + elePath viven ahora en lib/salon.ts (fuente única, los usa también el TPV).
// ── Unión por CONTACTO (estilo Tiny Glade), reversible ──
// Las mesas RECTANGULARES sin rotar que se tocan forman un "grupo" que se dibuja como UNA superficie.
// No hay estado "fusionado": el grupo se recalcula en cada render → al separarlas, se sueltan solas.
type Rect = { x: number; y: number; w: number; h: number }
// Agrupables: cualquier forma (rect, cuadrada, L y redonda), sin rotar. La unión se pinta por composición.
const isGroupable = (m: Mesa) => !m.rot
// Una mesa = uno o varios rects (la L = 2: brazo vertical + base) → permite unir también mesas en L.
function mesaRects(m: Mesa): Rect[] {
  if (m.forma === 'ele') {
    const aw = m.w * 0.46, ny = m.h * 0.54 // mismos ratios que elePath
    return [
      { x: m.x, y: m.y, w: aw, h: m.h }, // columna izquierda (brazo vertical)
      { x: m.x + aw, y: m.y + ny, w: m.w - aw, h: m.h - ny }, // base inferior-derecha
    ]
  }
  return [{ x: m.x, y: m.y, w: m.w, h: m.h }]
}
// ¿se tocan dos rects? (contacto por un borde, con tolerancia, o solape franco)
function rectsTouch(a: Rect, b: Rect): boolean {
  const tol = 3
  const sepX = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w) // >0 separados · <0 solapan
  const sepY = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h)
  if (sepX <= tol && sepY <= -8) return true // pegadas lado a lado (comparten tramo vertical)
  if (sepY <= tol && sepX <= -8) return true // pegadas arriba/abajo (comparten tramo horizontal)
  return sepX < 0 && sepY < 0 // se montan
}
// ¿se tocan dos MESAS? (cualquier rect de una con cualquiera de la otra → cubre las L)
const mesasTouch = (a: Mesa, b: Mesa) => mesaRects(a).some((x) => mesaRects(b).some((y) => rectsTouch(x, y)))
// agrupa por contacto (union-find). Devuelve TODOS los grupos (incluye sueltas como grupo de 1).
function groupsOf(list: Mesa[]): Mesa[][] {
  const parent = list.map((_, i) => i)
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++)
      if (isGroupable(list[i]) && isGroupable(list[j]) && mesasTouch(list[i], list[j])) parent[find(i)] = find(j)
  const by = new Map<number, Mesa[]>()
  list.forEach((m, i) => { const r = find(i); if (!by.has(r)) by.set(r, []); by.get(r)!.push(m) })
  return [...by.values()]
}
// ¿una silla (punto en mundo) cae en una JUNTA interior del grupo? → se oculta (no se sienta nadie ahí)
const seatBuried = (wx: number, wy: number, others: Rect[]) =>
  others.some((o) => wx > o.x - 7 && wx < o.x + o.w + 7 && wy > o.y - 7 && wy < o.y + o.h + 7)

// Tiradores de redimensionado (8: esquinas + lados) — para forma libre / mesas en L.
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN_LADO = 56
// ── Editor "Tiny Glade": imán + guías de alineación ──
// Guía = línea fina que aparece al imantar (v = vertical en x=pos; h = horizontal en y=pos).
type Guide = { axis: 'v' | 'h'; pos: number; from: number; to: number }
const SNAP = 6 // umbral de imán en px de PANTALLA (se divide por la escala para trabajar en coords del plano)
const GRID = 13 // rejilla fina de red de seguridad (media celda del punteado de fondo, que es 26px)

// ── Mesa viva (modo Servicio) ──
// mmss, ESTADO_COLOR y seedStates viven ahora en lib/salon.ts (fuente única Salón↔TPV).
const nextEstado = (e?: MesaEstado): MesaEstado => (e === 'ocupada' ? 'cobrar' : e === 'cobrar' ? 'libre' : 'ocupada')

// Primer hueco LIBRE en una rejilla alineada a las mesas existentes (no solapa con
// ninguna, con margen). Como el lienzo hace zoom-to-fit, si el plano crece todo se
// reescala para seguir cabiendo → nunca quedan mesas una encima de otra al añadir.
function freeSpot(list: Mesa[], w: number, h: number): { x: number; y: number } {
  const gap = 38
  if (!list.length) return { x: 70, y: 80 }
  const minX = Math.min(...list.map((m) => m.x))
  const minY = Math.min(...list.map((m) => m.y))
  const overlaps = (x: number, y: number) =>
    list.some((m) => x < m.x + m.w + gap && x + w + gap > m.x && y < m.y + m.h + gap && y + h + gap > m.y)
  const stepX = w + gap
  const stepY = h + gap
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      const x = Math.round(minX + col * stepX)
      const y = Math.round(minY + row * stepY)
      if (!overlaps(x, y)) return { x, y }
    }
  }
  const maxX = Math.max(...list.map((m) => m.x + m.w))
  return { x: Math.round(maxX + gap), y: Math.round(minY) }
}

export default function Salon() {
  const [mesas, setMesas] = useState<Mesa[]>(() => planoSegunCaja(loadSalon()))
  const [sel, setSel] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; px: number; py: number; ox: number; oy: number; moved: boolean; touch0: boolean } | null>(null)
  const rsz = useRef<{ id: string; h: string; px: number; py: number; ox: number; oy: number; ow: number; oh: number; rot: number; moved: boolean } | null>(null)
  const rotDrag = useRef<{ id: string; cx: number; cy: number; moved: boolean } | null>(null)
  const mesasRef = useRef(mesas)
  mesasRef.current = mesas
  // Historial (deshacer/rehacer): pilas de instantáneas del array de mesas. Fuente de verdad = `mesas`.
  const past = useRef<Mesa[][]>([])
  const future = useRef<Mesa[][]>([])
  const gestureSnap = useRef<Mesa[] | null>(null) // foto PRE-gesto (un paso de undo por gesto, no por frame)
  const nudging = useRef(false) // agrupa ráfagas de flechas en un solo paso de undo
  const nudgeTimer = useRef<number | null>(null)
  const nameEditing = useRef(false)
  const guideTimer = useRef<number | null>(null)
  const opsRef = useRef<{ undo: () => void; redo: () => void; duplicate: (id: string) => void; remove: (id: string) => void; nudge: (id: string, dx: number, dy: number) => void } | null>(null)
  const [fit, setFit] = useState({ s: 1, ox: 0, oy: 0 })
  // Vista MANUAL (pan/zoom con ratón). null = auto-fit. La transform activa = view ?? fit. Pedido Juan (24-jun).
  const [view, setView] = useState<{ s: number; ox: number; oy: number } | null>(null)
  const viewRef = useRef(view)
  viewRef.current = view
  const pan = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)
  const [modo, setModo] = useState<'servicio' | 'editar'>('servicio') // arranca EN VIVO (mesa viva)
  const [now, setNow] = useState(() => Date.now())
  const [snapOn, setSnapOn] = useState(true) // imán de alineación (Alt mientras arrastras = saltárselo)
  const [guides, setGuides] = useState<Guide[]>([]) // líneas-guía activas durante un gesto
  const [fadingGuides, setFadingGuides] = useState(false) // se desvanecen al soltar (no cortar en seco)
  const [readout, setReadout] = useState<{ x: number; y: number; text: string } | null>(null) // tamaño/ángulo en vivo
  const [hist, setHist] = useState({ u: false, r: false }) // ¿hay algo que deshacer/rehacer? (para los botones)
  const [draggingId, setDraggingId] = useState<string | null>(null) // mesa en gesto activo → SIN transición (1:1 con el cursor)
  const selRef = useRef(sel); selRef.current = sel
  const modoRef = useRef(modo); modoRef.current = modo
  const guidesRef = useRef(guides); guidesRef.current = guides

  // reloj a 1s para el "calor" de las mesas ocupadas
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Encaja (zoom-to-fit) el plano para que LLENE el lienzo, centrado y con margen.
  function computeFit() {
    const cv = canvasRef.current
    const list = mesasRef.current
    if (!cv || !list.length) return
    const pad = 70
    const minX = Math.min(...list.map((m) => m.x))
    const minY = Math.min(...list.map((m) => m.y))
    const maxX = Math.max(...list.map((m) => m.x + m.w))
    const maxY = Math.max(...list.map((m) => m.y + m.h))
    const bw = Math.max(1, maxX - minX)
    const bh = Math.max(1, maxY - minY)
    const cw = cv.clientWidth
    const ch = cv.clientHeight
    const s = Math.max(0.5, Math.min((cw - pad * 2) / bw, (ch - pad * 2) / bh, 3))
    setFit({ s, ox: (cw - bw * s) / 2 - minX * s, oy: (ch - bh * s) / 2 - minY * s })
  }

  // Re-encaja al cargar/añadir/borrar (NUNCA mientras se arrastra ni si el usuario tiene vista manual).
  useEffect(() => {
    if (drag.current || viewRef.current) return
    computeFit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesas])
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => computeFit())
    ro.observe(cv)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Carga el plano real del local desde Supabase (si hay sesión y mesas guardadas).
  useEffect(() => {
    let alive = true
    loadSalonDB().then((rows) => {
      if (alive && rows) setMesas(planoSegunCaja(rows))
    })
    return () => {
      alive = false
    }
  }, [])

  // Auto-guardado local en cada cambio (red de seguridad); el botón confirma + suena.
  useEffect(() => {
    saveSalon(mesas)
  }, [mesas])

  // Teclado del editor (atajos estilo app de diseño). Lee de refs → un solo listener, sin closures viejos.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const ops = opsRef.current
      if (e.key === 'Escape') { setSel(null); return }
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? ops?.redo() : ops?.undo(); return }
      if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); ops?.redo(); return }
      if (modoRef.current !== 'editar') return // el resto de atajos, solo editando
      const id = selRef.current
      if (!id) return
      if (mod && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); ops?.duplicate(id); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); ops?.remove(id); return }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        ops?.nudge(id, dx, dy)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const selMesa = mesas.find((m) => m.id === sel) || null

  function patch(id: string, p: Partial<Mesa>) {
    setMesas((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)))
  }

  // ── Historial (deshacer/rehacer) ──
  const snapshot = () => mesasRef.current.map((o) => ({ ...o }))
  const syncHist = () => setHist({ u: past.current.length > 0, r: future.current.length > 0 })
  function pushSnap(snap: Mesa[]) {
    past.current.push(snap)
    if (past.current.length > 60) past.current.shift()
    future.current = []
    syncHist()
  }
  // Mutación discreta CON paso de undo (foto del estado previo → aplica)
  function commit(updater: (prev: Mesa[]) => Mesa[]) {
    pushSnap(snapshot())
    setMesas(updater)
  }
  // Cierra un gesto (arrastre/resize/rotación): un único paso de undo si de verdad cambió algo.
  function endGesture(changed: boolean) {
    if (changed && gestureSnap.current) pushSnap(gestureSnap.current)
    gestureSnap.current = null
  }
  function undo() {
    if (!past.current.length) return
    future.current.push(snapshot())
    setMesas(past.current.pop() as Mesa[])
    syncHist()
    play('toggle', 0.32, 0.9)
  }
  function redo() {
    if (!future.current.length) return
    past.current.push(snapshot())
    setMesas(future.current.pop() as Mesa[])
    syncHist()
    play('toggle', 0.32, 1.1)
  }
  function nudge(id: string, dx: number, dy: number) {
    if (!nudging.current) { pushSnap(snapshot()); nudging.current = true } // 1 paso por ráfaga de flechas
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current)
    nudgeTimer.current = window.setTimeout(() => { nudging.current = false }, 500)
    setMesas((ms) => ms.map((m) => (m.id === id ? { ...m, x: m.x + dx, y: m.y + dy } : m)))
  }
  function duplicateMesa(id: string) {
    const m = mesasRef.current.find((mm) => mm.id === id)
    if (!m) return
    const nums = mesasRef.current.map((mm) => parseInt(mm.nombre, 10)).filter((n) => !isNaN(n))
    const next = (nums.length ? Math.max(...nums) : 0) + 1
    const nid = 'm' + Date.now().toString(36)
    const dup: Mesa = { ...m, id: nid, nombre: String(next), x: m.x + 24, y: m.y + 24, estado: 'libre', since: undefined, reservaFin: undefined }
    commit((ms) => [...ms, dup])
    setSel(nid)
    play('pop', 0.5, 1.25)
  }

  // ¿la mesa `id` está pegada (tocando) a alguna otra ahora mismo? (para el "clack" al unir/soltar)
  const isTouchingAny = (id: string) => {
    const list = mesasRef.current
    const m = list.find((x) => x.id === id)
    if (!m || !isGroupable(m)) return false
    return list.some((o) => o.id !== id && isGroupable(o) && mesasTouch(m, o))
  }

  // ── Imán de alineación (estilo Tiny Glade / design tools) ──
  // Para la mesa que mueves, alinea sus bordes/centro con los de las vecinas (y centrado entre dos =
  // equidistancia, regla de Juan 26-jun). Si no hay vecina cerca, cae a una rejilla fina. Devuelve la
  // posición imantada + las guías a pintar.
  function computeSnap(id: string, x: number, y: number, w: number, h: number, scale: number) {
    const th = SNAP / scale
    const others = mesasRef.current.filter((m) => m.id !== id)
    const gds: Guide[] = []
    // eje X (líneas verticales): left/centro/right de la mesa contra left/centro/right de cada vecina
    let bx = { d: th, v: x, pos: 0, lo: 0, hi: 0, hit: false }
    const offX = [0, w / 2, w]
    for (const o of others) {
      const oa = [o.x, o.x + o.w / 2, o.x + o.w]
      for (const off of offX) for (const op of oa) {
        const dist = Math.abs(x + off - op)
        if (dist < bx.d) bx = { d: dist, v: op - off, pos: op, lo: Math.min(y, o.y), hi: Math.max(y + h, o.y + o.h), hit: true }
      }
    }
    for (let i = 0; i < others.length; i++) for (let j = i + 1; j < others.length; j++) {
      const mid = (others[i].x + others[i].w / 2 + others[j].x + others[j].w / 2) / 2 // centrado entre dos
      const dist = Math.abs(x + w / 2 - mid)
      if (dist < bx.d) bx = { d: dist, v: mid - w / 2, pos: mid, lo: Math.min(y, others[i].y, others[j].y), hi: Math.max(y + h, others[i].y + others[i].h, others[j].y + others[j].h), hit: true }
    }
    const nx = bx.hit ? bx.v : Math.round(x / GRID) * GRID
    if (bx.hit) gds.push({ axis: 'v', pos: bx.pos, from: bx.lo, to: bx.hi })
    // eje Y (líneas horizontales)
    let by = { d: th, v: y, pos: 0, lo: 0, hi: 0, hit: false }
    const offY = [0, h / 2, h]
    for (const o of others) {
      const oa = [o.y, o.y + o.h / 2, o.y + o.h]
      for (const off of offY) for (const op of oa) {
        const dist = Math.abs(y + off - op)
        if (dist < by.d) by = { d: dist, v: op - off, pos: op, lo: Math.min(x, o.x), hi: Math.max(x + w, o.x + o.w), hit: true }
      }
    }
    for (let i = 0; i < others.length; i++) for (let j = i + 1; j < others.length; j++) {
      const mid = (others[i].y + others[i].h / 2 + others[j].y + others[j].h / 2) / 2
      const dist = Math.abs(y + h / 2 - mid)
      if (dist < by.d) by = { d: dist, v: mid - h / 2, pos: mid, lo: Math.min(x, others[i].x, others[j].x), hi: Math.max(x + w, others[i].x + others[i].w, others[j].x + others[j].w), hit: true }
    }
    const ny = by.hit ? by.v : Math.round(y / GRID) * GRID
    if (by.hit) gds.push({ axis: 'h', pos: by.pos, from: by.lo, to: by.hi })
    return { x: nx, y: ny, guides: gds }
  }
  function cancelGuideFade() {
    if (guideTimer.current) { clearTimeout(guideTimer.current); guideTimer.current = null }
    if (fadingGuides) setFadingGuides(false)
  }
  function endGuides() {
    setReadout(null)
    if (!guidesRef.current.length) return
    setFadingGuides(true) // desvanecer, no cortar en seco
    if (guideTimer.current) clearTimeout(guideTimer.current)
    guideTimer.current = window.setTimeout(() => { setGuides([]); setFadingGuides(false) }, 200)
  }

  function addMesa() {
    const nums = mesas.map((m) => parseInt(m.nombre, 10)).filter((n) => !isNaN(n))
    const next = (nums.length ? Math.max(...nums) : 0) + 1
    const w = 110
    const h = 110
    const spot = freeSpot(mesas, w, h) // primer hueco libre, sin solapar
    const id = 'm' + Date.now().toString(36)
    const nueva: Mesa = { id, nombre: String(next), x: spot.x, y: spot.y, w, h, sillas: 4, forma: 'cuadrada' }
    commit((ms) => [...ms, nueva])
    setSel(id)
    play('pop', 0.5, 1.3)
  }

  function removeMesa(id: string) {
    commit((ms) => ms.filter((m) => m.id !== id))
    setSel(null)
    play('toggle', 0.4, 0.8)
  }

  // Modo Servicio: tocar una mesa cicla su estado libre → ocupada → por cobrar → libre.
  function cycleEstado(m: Mesa, e?: RPE<HTMLDivElement>) {
    const ne = nextEstado(m.estado)
    // COBRO: cobrar → libre = se paga la mesa → moneditas vuelan a la cartera del día + apunte en el desglose
    if (m.estado === 'cobrar' && ne === 'libre') {
      const amount = cuentaTotal(m.id) || cobroAmount(m) // importe REAL de la mesa (cuenta fijada) o la semilla estable
      const r = e?.currentTarget?.getBoundingClientRect()
      const x = r ? r.left + r.width / 2 : window.innerWidth / 2
      const y = r ? r.top + r.height / 2 : window.innerHeight / 2
      addWallet(amount) // EL DINERO SUBE EN ORIGEN (robusto, aunque la animación de monedas fallara)
      logCobro(amount, 'mesa', `Mesa ${m.nombre}`)
      fireCobro({ amount, x, y, coins: 9 }) // monedas = adorno hacia la cartera
      clearCuenta(m.id) // la mesa queda saldada
      play('success', 0.5, 0.92)
    }
    patch(m.id, {
      estado: ne,
      since: ne === 'libre' ? undefined : ne === 'ocupada' ? Date.now() : (m.since ?? Date.now()),
      // al ocupar, reserva de 90 min por defecto (luego vendrá del booking real); al liberar, se borra
      reservaFin: ne === 'libre' ? undefined : ne === 'ocupada' ? Date.now() + 90 * 60000 : m.reservaFin,
    })
    play(ne === 'libre' ? 'success' : ne === 'cobrar' ? 'tap' : 'pop', 0.5, ne === 'cobrar' ? 1 : 1.12)
  }

  async function guardar() {
    saveSalon(mesas) // caché local instantánea
    play('success', 0.45, 1.1)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
    await saveSalonDB(mesas) // persiste en Supabase por local
  }

  // ── arrastre (pointer capture → suave dentro y fuera del elemento) ──
  function onDown(e: RPE<HTMLDivElement>, m: Mesa) {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    gestureSnap.current = snapshot() // foto para deshacer este arrastre
    cancelGuideFade()
    drag.current = { id: m.id, px: e.clientX, py: e.clientY, ox: m.x, oy: m.y, moved: false, touch0: isTouchingAny(m.id) }
    setDraggingId(m.id)
    setSel(m.id)
  }
  function onMove(e: RPE<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    // usa la transform ACTIVA (manual o auto-fit): convierte desplazamiento de pantalla a coords del plano.
    const t = viewRef.current ?? fit
    const dx = (e.clientX - d.px) / t.s
    const dy = (e.clientY - d.py) / t.s
    if (Math.abs(dx) * t.s > 3 || Math.abs(dy) * t.s > 3) d.moved = true
    let nx = d.ox + dx, ny = d.oy + dy
    const m = mesasRef.current.find((mm) => mm.id === d.id)
    if (snapOn && !e.altKey && m) {
      const s = computeSnap(d.id, nx, ny, m.w, m.h, t.s) // imán a vecinas/rejilla + guías
      nx = s.x; ny = s.y
      setGuides(s.guides)
    } else if (guidesRef.current.length) setGuides([]) // Alt o imán off → sin guías
    setMesas((ms) => ms.map((mm) => (mm.id === d.id ? { ...mm, x: Math.round(nx), y: Math.round(ny) } : mm)))
  }
  function onUp(e: RPE<HTMLDivElement>) {
    if (drag.current) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
      const d = drag.current
      drag.current = null
      setDraggingId(null)
      endGuides()
      endGesture(d.moved)
      // "clack" si la mesa acaba de PEGARSE a otra (no lo estaba al empezar el arrastre)
      if (d.moved && !d.touch0 && isTouchingAny(d.id)) { play('tap', 0.6, 0.82); play('success', 0.34, 1.0) }
    }
  }
  // pantalla → coords del plano (deshace el translate+scale de la vista activa)
  function pointerToPlano(e: RPE<HTMLElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const t = viewRef.current ?? fit
    return { x: (e.clientX - rect.left - t.ox) / t.s, y: (e.clientY - rect.top - t.oy) / t.s }
  }
  // ── redimensionar tirando de un borde/esquina (forma libre, funciona aunque la mesa esté ROTADA) ──
  function resizeDown(e: RPE<HTMLElement>, m: Mesa, h: string) {
    e.preventDefault()
    e.stopPropagation() // no arrastrar la mesa
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
    gestureSnap.current = snapshot()
    cancelGuideFade()
    rsz.current = { id: m.id, h, px: e.clientX, py: e.clientY, ox: m.x, oy: m.y, ow: m.w, oh: m.h, rot: m.rot || 0, moved: false }
    setDraggingId(m.id)
    setSel(m.id)
  }
  function resizeMove(e: RPE<HTMLElement>) {
    const r = rsz.current
    if (!r) return
    r.moved = true
    const t = viewRef.current ?? fit
    const dxs = (e.clientX - r.px) / t.s
    const dys = (e.clientY - r.py) / t.s
    const rad = (r.rot * Math.PI) / 180
    const cos = Math.cos(rad), sin = Math.sin(rad)
    // proyecta el desplazamiento al marco LOCAL de la mesa (sin rotar)
    const dx = dxs * cos + dys * sin
    const dy = -dxs * sin + dys * cos
    let w = r.ow, h = r.oh, ax = 0.5, ay = 0.5 // ax/ay = punto ANCLA (lado opuesto que queda fijo)
    if (r.h.includes('e')) { w = Math.max(MIN_LADO, r.ow + dx); ax = 0 }
    if (r.h.includes('w')) { w = Math.max(MIN_LADO, r.ow - dx); ax = 1 }
    if (r.h.includes('s')) { h = Math.max(MIN_LADO, r.oh + dy); ay = 0 }
    if (r.h.includes('n')) { h = Math.max(MIN_LADO, r.oh - dy); ay = 1 }
    // mantener el ancla FIJO en el mundo (rotación alrededor del centro)
    const cx0 = r.ox + r.ow / 2, cy0 = r.oy + r.oh / 2
    const la0x = ax * r.ow - r.ow / 2, la0y = ay * r.oh - r.oh / 2
    const awx = cx0 + (la0x * cos - la0y * sin), awy = cy0 + (la0x * sin + la0y * cos)
    const la1x = ax * w - w / 2, la1y = ay * h - h / 2
    const cx1 = awx - (la1x * cos - la1y * sin), cy1 = awy - (la1x * sin + la1y * cos)
    let x0 = cx1 - w / 2, y0 = cy1 - h / 2
    // Imán del BORDE que mueves → a bordes/centros de vecinas (o rejilla). Solo sin rotar (en mundo el
    // borde es eje-alineado); rotada, redimensiona libre. Mantiene el lado opuesto fijo.
    const gds: Guide[] = []
    if (snapOn && !e.altKey && r.rot === 0) {
      const th = SNAP / t.s
      const others = mesasRef.current.filter((m) => m.id !== r.id)
      if (r.h.includes('e') || r.h.includes('w')) {
        const moving = r.h.includes('e') ? x0 + w : x0
        let best = th, sv: number | null = null
        for (const o of others) for (const a of [o.x, o.x + o.w / 2, o.x + o.w]) { const d = Math.abs(moving - a); if (d < best) { best = d; sv = a } }
        const gv = Math.round(moving / GRID) * GRID
        if (sv === null && Math.abs(moving - gv) < th) sv = gv
        if (sv !== null) {
          if (r.h.includes('e')) w = Math.max(MIN_LADO, sv - x0)
          else { const right = x0 + w; x0 = Math.min(sv, right - MIN_LADO); w = right - x0 }
          const edge = r.h.includes('e') ? x0 + w : x0
          gds.push({ axis: 'v', pos: edge, from: Math.min(y0, ...others.map((o) => o.y)), to: Math.max(y0 + h, ...others.map((o) => o.y + o.h)) })
        }
      }
      if (r.h.includes('n') || r.h.includes('s')) {
        const moving = r.h.includes('s') ? y0 + h : y0
        let best = th, sv: number | null = null
        for (const o of others) for (const a of [o.y, o.y + o.h / 2, o.y + o.h]) { const d = Math.abs(moving - a); if (d < best) { best = d; sv = a } }
        const gh = Math.round(moving / GRID) * GRID
        if (sv === null && Math.abs(moving - gh) < th) sv = gh
        if (sv !== null) {
          if (r.h.includes('s')) h = Math.max(MIN_LADO, sv - y0)
          else { const bottom = y0 + h; y0 = Math.min(sv, bottom - MIN_LADO); h = bottom - y0 }
          const edge = r.h.includes('s') ? y0 + h : y0
          gds.push({ axis: 'h', pos: edge, from: Math.min(x0, ...others.map((o) => o.x)), to: Math.max(x0 + w, ...others.map((o) => o.x + o.w)) })
        }
      }
      setGuides(gds)
    } else if (guidesRef.current.length) setGuides([])
    patch(r.id, { x: Math.round(x0), y: Math.round(y0), w: Math.round(w), h: Math.round(h) })
    setReadout({ x: x0 + w / 2, y: y0 + h / 2 - Math.max(w, h) / 2 - 16, text: `${Math.round(w)} × ${Math.round(h)}` })
  }
  function resizeUp(e: RPE<HTMLElement>) {
    if (rsz.current) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
      endGesture(rsz.current.moved)
      rsz.current = null
      setDraggingId(null)
      endGuides()
    }
  }
  // ── ROTAR la mesa: arrastra el tirador superior; ángulo = del centro al puntero (snap a 45°) ──
  function rotateDown(e: RPE<HTMLElement>, m: Mesa) {
    e.preventDefault()
    e.stopPropagation()
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
    gestureSnap.current = snapshot()
    rotDrag.current = { id: m.id, cx: m.x + m.w / 2, cy: m.y + m.h / 2, moved: false }
    setSel(m.id)
  }
  function rotateMove(e: RPE<HTMLElement>) {
    const ro = rotDrag.current
    if (!ro) return
    ro.moved = true
    const p = pointerToPlano(e)
    const ang = (Math.atan2(p.y - ro.cy, p.x - ro.cx) * 180) / Math.PI
    let deg = (((ang + 90) % 360) + 360) % 360 // el tirador apunta ARRIBA (−90°)
    const near = Math.round(deg / 45) * 45 // snap a ángulos limpios (0/45/90…) si está cerca
    if (Math.abs(deg - near) < 5) deg = near % 360
    patch(ro.id, { rot: Math.round(deg) })
    const m = mesasRef.current.find((mm) => mm.id === ro.id)
    const rad = m ? Math.max(m.w, m.h) / 2 + 18 : 40
    setReadout({ x: ro.cx, y: ro.cy - rad, text: `${Math.round(deg)}°` })
  }
  function rotateUp(e: RPE<HTMLElement>) {
    if (rotDrag.current) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
      endGesture(rotDrag.current.moved)
      rotDrag.current = null
      endGuides()
    }
  }
  // ── Pan/zoom del lienzo con el ratón (vista manual) ──
  function canvasDown(e: RPE<HTMLDivElement>) {
    setSel(null)
    if (servicio) return
    const t = viewRef.current ?? fit
    pan.current = { px: e.clientX, py: e.clientY, ox: t.ox, oy: t.oy }
  }
  function canvasMove(e: RPE<HTMLDivElement>) {
    const p = pan.current
    if (!p) return
    setView((v) => ({ s: (v ?? fit).s, ox: p.ox + (e.clientX - p.px), oy: p.oy + (e.clientY - p.py) }))
  }
  function canvasUp() {
    pan.current = null
  }
  // Zoom con la rueda hacia el cursor (listener no-pasivo para poder preventDefault).
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = cv.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const t = viewRef.current ?? fit
      const ns = clamp(t.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.3, 5)
      const planeX = (mx - t.ox) / t.s
      const planeY = (my - t.oy) / t.s
      setView({ s: ns, ox: mx - planeX * ns, oy: my - planeY * ns })
    }
    cv.addEventListener('wheel', onWheel, { passive: false })
    return () => cv.removeEventListener('wheel', onWheel)
  }, [fit])

  function resize(dir: 1 | -1) {
    if (!selMesa) return
    const step = 16
    const w = clamp(selMesa.w + dir * step, 70, 320)
    const h = clamp(selMesa.h + dir * step, 70, 320)
    commit((ms) => ms.map((m) => (m.id === selMesa.id ? { ...m, w, h } : m)))
  }

  // Conecta las operaciones para el teclado (refs → sin closures viejos) + estado de los botones.
  opsRef.current = { undo, redo, duplicate: duplicateMesa, remove: removeMesa, nudge }
  const canUndo = hist.u
  const canRedo = hist.r

  const ocup = mesas.filter((m) => m.estado === 'ocupada').length
  const cobr = mesas.filter((m) => m.estado === 'cobrar').length
  const libr = mesas.length - ocup - cobr
  const ocupPct = mesas.length ? Math.round(((ocup + cobr) / mesas.length) * 100) : 0
  const servicio = modo === 'servicio'

  // ── Grupos por contacto (unión visual reversible): se recalculan en cada render ──
  const ESTADO_RANK: Record<MesaEstado, number> = { cobrar: 3, ocupada: 2, libre: 1 }
  const unionGroups = groupsOf(mesas).filter((g) => g.length >= 2)
  const groupedIds = new Set<string>(unionGroups.flatMap((g) => g.map((m) => m.id)))
  const groupOthers = new Map<string, Rect[]>() // por mesa: rects de las OTRAS del grupo (para ocultar sillas de la junta)
  unionGroups.forEach((g) => g.forEach((m) => groupOthers.set(m.id, g.filter((x) => x.id !== m.id).flatMap((x) => mesaRects(x)))))
  // caja + estado dominante de cada grupo (la superficie unida se pinta por composición en el render)
  const groupShapes = unionGroups.map((g) => {
    const minX = Math.min(...g.map((m) => m.x)), minY = Math.min(...g.map((m) => m.y))
    const maxX = Math.max(...g.map((m) => m.x + m.w)), maxY = Math.max(...g.map((m) => m.y + m.h))
    const estG = g.reduce<MesaEstado>((acc, m) => (ESTADO_RANK[m.estado || 'libre'] > ESTADO_RANK[acc] ? m.estado || 'libre' : acc), 'libre')
    return { key: g.map((m) => m.id).sort().join('-'), mesas: g, x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY), onG: g.some((m) => m.id === sel), estG }
  })

  return (
    <div className={'section salon-sec' + (servicio ? ' srv-mode' : '')}>
      <SectionHeader
        title="Salón"
        subtitle={servicio ? 'En vivo · toca una mesa para cambiar su estado' : 'Diseña tu sala · arrastra las mesas, ajústalas y guarda'}
        right={
          servicio ? (
            <div className="salon-tools">
              <Badge tone="gold">{ocupPct}% ocupación</Badge>
              <button className="salon-btn primary" onClick={() => { setModo('editar'); setSel(null); play('toggle', 0.4, 1.1) }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                Editar sala
              </button>
            </div>
          ) : (
            <div className="salon-tools">
              <Badge tone="muted">
                {mesas.length} mesas · {totalPlazas(mesas)} plazas
              </Badge>
              <button className="salon-btn" onClick={() => { setModo('servicio'); setSel(null); play('toggle', 0.4, 0.9) }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
                En vivo
              </button>
              <button className="salon-btn icon" onClick={undo} disabled={!canUndo} title="Deshacer (⌘Z)" aria-label="Deshacer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 14 4 9l5-5" /><path d="M4 9h11a4 4 0 0 1 0 8h-3" />
                </svg>
              </button>
              <button className="salon-btn icon" onClick={redo} disabled={!canRedo} title="Rehacer (⇧⌘Z)" aria-label="Rehacer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 14 5-5-5-5" /><path d="M20 9H9a4 4 0 0 0 0 8h3" />
                </svg>
              </button>
              <button className={'salon-btn' + (snapOn ? ' on' : '')} onClick={() => { play('tap', 0.35, snapOn ? 0.9 : 1.15); setSnapOn((s) => !s) }} title="Imán de alineación (Alt mientras arrastras = saltárselo)" aria-pressed={snapOn}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 4v7a6 6 0 0 0 12 0V4" /><path d="M4 4h4M16 4h4M5 9h3M16 9h3" />
                </svg>
                Imán
              </button>
              <button className="salon-btn" onClick={addMesa}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Añadir mesa
              </button>
              <button className={'salon-btn primary' + (saved ? ' ok' : '')} onClick={guardar}>
                {saved ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    Guardado
                  </>
                ) : (
                  'Guardar sala'
                )}
              </button>
            </div>
          )
        }
      />

      {servicio && mesas.length > 0 && (
        <div className="salon-stats">
          <StatRow className="salon-statrow">
            <Stat value={String(ocupPct)} unit="%" label="Ocupación" tone={ocupPct >= 70 ? 'green' : 'gold'} count={false} />
            <Stat value={String(libr)} label="Libres" count={false} />
            <Stat value={String(ocup)} label="Ocupadas" count={false} />
            <Stat value={String(cobr)} label="Por cobrar" count={false} />
          </StatRow>
        </div>
      )}

      <div className="salon-canvas" ref={canvasRef} onPointerDown={canvasDown} onPointerMove={canvasMove} onPointerUp={canvasUp} onPointerLeave={canvasUp}>
        {modo === 'editar' && (
          <button className="salon-fit" onClick={(e) => { e.stopPropagation(); setView(null) }} title="Ajustar vista al plano">⤢ Ajustar</button>
        )}
        <div className={'salon-stage' + (view ? ' manual' : '')} style={{ transform: `translate(${(view ?? fit).ox}px, ${(view ?? fit).oy}px) scale(${(view ?? fit).s})` }}>
        {/* Capa de UNIÓN por contacto (detrás de las mesas): una superficie continua por grupo. Se pinta por
            COMPOSICIÓN — capa "borde" (formas infladas) + capa "relleno" encima → contorno exterior continuo
            sin líneas en las juntas, conservando curvas de las redondas y la silueta de las L. */}
        {groupShapes.map((g) => {
          const nodes = () =>
            g.mesas.map((m) => {
              const tx = (m.x - g.x).toFixed(1), ty = (m.y - g.y).toFixed(1)
              const inner =
                m.forma === 'redonda' ? (
                  <ellipse cx={m.w / 2} cy={m.h / 2} rx={m.w / 2} ry={m.h / 2} />
                ) : m.forma === 'ele' ? (
                  <path d={elePath(m.w, m.h)} />
                ) : (
                  <rect width={m.w} height={m.h} rx={16} ry={16} />
                )
              return (
                <g key={m.id} transform={`translate(${tx},${ty})`}>
                  {inner}
                </g>
              )
            })
          return (
            <svg
              key={'grp-' + g.key}
              className={'salon-group-svg' + (servicio ? ' srv e-' + g.estG : '') + (g.onG ? ' on' : '')}
              style={{ left: g.x, top: g.y, width: g.w, height: g.h, ['--heat' as string]: ESTADO_COLOR[g.estG] } as CSSProperties}
              viewBox={`0 0 ${Math.round(g.w)} ${Math.round(g.h)}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <g className="grp-stroke">{nodes()}</g>
              <g className="grp-fill">{nodes()}</g>
            </svg>
          )
        })}
        <AnimatePresence>
          {mesas.map((m) => {
            const on = sel === m.id
            const est = m.estado || 'libre'
            const occ = servicio && est !== 'libre'
            // cuenta atrás de la RESERVA (modo servicio): lo que queda hasta que llega la próxima reserva.
            // Fallback: si una mesa ocupada no trae reservaFin (plano viejo persistido o walk-in), reserva por
            // defecto de 90 min desde que se sentó → SIEMPRE hay cuenta atrás.
            const fin = m.reservaFin ?? (m.since != null ? m.since + 90 * 60000 : null)
            const rem = occ && est === 'ocupada' && fin != null ? fin - now : null
            const over = rem != null && rem <= 0
            const heat = ESTADO_COLOR[est] // verde libre · rojo ocupada · ámbar por cobrar (solo se ve en servicio)
            return (
              <motion.div
                key={m.id}
                className={'salon-mesa' + (modo === 'editar' && on ? ' on' : '') + (servicio ? ' srv e-' + est : '') + (over ? ' over' : '') + (m.id === draggingId ? ' dragging' : '') + (groupedIds.has(m.id) ? ' grouped' : '')}
                style={{ left: m.x, top: m.y, width: m.w, height: m.h, ['--heat' as string]: heat } as CSSProperties}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  if (servicio) cycleEstado(m, e)
                  else onDown(e, m)
                }}
                onPointerMove={servicio ? undefined : onMove}
                onPointerUp={servicio ? undefined : onUp}
              >
                <div className="sm-rotor" style={m.rot ? { transform: `rotate(${m.rot}deg)` } : undefined}>
                {seatPositions(m)
                  .filter((s) => { const o = groupOthers.get(m.id); return !o || !seatBuried(m.x + s.x, m.y + s.y, o) })
                  .map((s, i) => (
                    <i key={i} className="sm-chair" style={{ left: s.x, top: s.y }} />
                  ))}
                <MesaTile mesa={m} rem={rem} over={over} cobrar={servicio && est === 'cobrar'} rot={m.rot} grouped={groupedIds.has(m.id)} />
                {modo === 'editar' && on && (
                  <>
                    {HANDLES.map((hd) => (
                      <i
                        key={hd}
                        className={'sm-rsz r-' + hd}
                        onPointerDown={(e) => resizeDown(e, m, hd)}
                        onPointerMove={resizeMove}
                        onPointerUp={resizeUp}
                      />
                    ))}
                    <i className="sm-rot" onPointerDown={(e) => rotateDown(e, m)} onPointerMove={rotateMove} onPointerUp={rotateUp} />
                  </>
                )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {/* Guías de alineación (imán) — viven en coords del plano → escalan con la vista */}
        {guides.map((g, i) =>
          g.axis === 'v' ? (
            <div key={'g' + i} className={'salon-guide v' + (fadingGuides ? ' fade' : '')} style={{ left: g.pos, top: g.from, height: Math.max(1, g.to - g.from) }} />
          ) : (
            <div key={'g' + i} className={'salon-guide h' + (fadingGuides ? ' fade' : '')} style={{ top: g.pos, left: g.from, width: Math.max(1, g.to - g.from) }} />
          ),
        )}
        {readout && <div className="sm-readout" style={{ left: readout.x, top: readout.y }}>{readout.text}</div>}
        </div>

        {!mesas.length && <div className="salon-empty">Sala vacía · pulsa “Añadir mesa” para empezar</div>}
      </div>

      {servicio && mesas.length > 0 && (
        <div className="salon-legend">
          <span className="sl-heat">Cada mesa muestra lo que queda de su reserva · verde = tranquilo · rojo = toca liberar</span>
        </div>
      )}

      <AnimatePresence>
        {!servicio && selMesa && (
          <motion.div
            className="salon-inspector"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ type: 'spring', stiffness: 460, damping: 30 }}
          >
            <div className="si-row">
              <label className="si-k">Nombre</label>
              <input
                className="si-name"
                value={selMesa.nombre}
                onFocus={() => { nameEditing.current = false }}
                onBlur={() => { nameEditing.current = false }}
                onChange={(e) => {
                  if (!nameEditing.current) { pushSnap(snapshot()); nameEditing.current = true } // 1 paso de undo por edición de nombre
                  patch(selMesa.id, { nombre: e.target.value.slice(0, 12) })
                }}
              />
            </div>

            <div className="si-row">
              <label className="si-k">Forma</label>
              <div className="si-seg">
                {FORMAS.map((f) => (
                  <button
                    key={f.k}
                    className={'si-opt' + (selMesa.forma === f.k ? ' on' : '')}
                    onClick={() => {
                      // Base = LADO CORTO (estable): así rect→cuadrada→rect NO multiplica el tamaño cada vez
                      // (antes usaba Math.max y crecía hasta el infinito). Bug de Juan (24-jun).
                      const s = clamp(Math.round(Math.min(selMesa.w, selMesa.h)), 70, 200)
                      const dims =
                        f.k === 'rect' ? { w: Math.round(s * 1.6), h: s } : f.k === 'ele' ? { w: Math.round(s * 1.4), h: Math.round(s * 1.4) } : { w: s, h: s }
                      commit((ms) => ms.map((m) => (m.id === selMesa.id ? { ...m, forma: f.k, ...dims } : m)))
                    }}
                  >
                    {f.t}
                  </button>
                ))}
              </div>
            </div>

            <div className="si-row">
              <label className="si-k">Plazas</label>
              <div className="si-step">
                <button onClick={() => { const v = clamp(selMesa.sillas - 1, 0, 14); commit((ms) => ms.map((m) => (m.id === selMesa.id ? { ...m, sillas: v } : m))) }}>−</button>
                <b>{selMesa.sillas}</b>
                <button onClick={() => { const v = clamp(selMesa.sillas + 1, 0, 14); commit((ms) => ms.map((m) => (m.id === selMesa.id ? { ...m, sillas: v } : m))) }}>+</button>
              </div>
            </div>

            <div className="si-row">
              <label className="si-k">Tamaño</label>
              <div className="si-step">
                <button onClick={() => resize(-1)}>−</button>
                <b className="si-dim">{Math.round(selMesa.w)}×{Math.round(selMesa.h)}</b>
                <button onClick={() => resize(1)}>+</button>
              </div>
            </div>
            <div className="si-hint">Tira de los <b>bordes</b> (forma libre) · el punto de arriba <b>rota</b> · <b>junta</b> mesas hasta que se toquen y se unen (sepáralas para soltarlas) · <b>⌘Z</b> deshacer · <b>⌘D</b> duplicar · <b>flechas</b> mueven</div>

            <div className="si-foot">
              <button className="si-dup" onClick={() => duplicateMesa(selMesa.id)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </svg>
                Duplicar
              </button>
              <button className="si-del" onClick={() => removeMesa(selMesa.id)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                </svg>
                Eliminar
              </button>
              <button className="si-done" onClick={() => setSel(null)}>
                Listo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
