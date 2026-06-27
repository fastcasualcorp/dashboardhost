/* Modelo del Salón (plano de sala) — fuente única de la que beben el editor de
   Salón y el selector de mesa del TPV. Persiste en Supabase (tabla `mesas`, RLS por
   local) cuando hay sesión; localStorage hace de caché para pintar al instante. */
import { supabase, localId } from './supabase'

export type MesaForma = 'cuadrada' | 'redonda' | 'rect' | 'ele'
export type MesaEstado = 'libre' | 'ocupada' | 'cobrar' // estado de servicio ("mesa viva")

// Color SEMÁNTICO de mesa (servicio): libre = VERDE (siéntate), ocupada = ROJO (cogida), por cobrar = ÁMBAR.
// Fuente ÚNICA que comparten el editor de Salón y el selector de mesa del TPV (mismo lenguaje de color).
export const ESTADO_COLOR: Record<MesaEstado, string> = { libre: '#34d399', ocupada: '#ff5c5c', cobrar: '#f5b341' }

// Cuenta atrás de la RESERVA de una mesa ocupada (ms hasta que llega la próxima reserva). null si no aplica.
// Fallback: ocupada sin reservaFin (walk-in / plano viejo) → 90 min desde que se sentó → SIEMPRE hay timer.
export function mesaRemaining(m: Mesa, now: number): number | null {
  if (m.estado !== 'ocupada') return null
  const fin = m.reservaFin ?? (m.since != null ? m.since + 90 * 60000 : null)
  return fin != null ? fin - now : null
}
export const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
// Importe (demo) de una mesa por cobrar: estable por mesa (hash del id + plazas) → ~25-90 €. Fuente única que
// usan el TPV y el Salón al cobrar una mesa (las moneditas que vuelan suman este importe a la caja del día).
export function cobroAmount(m: Mesa): number {
  let h = 0
  for (let i = 0; i < m.id.length; i++) h = (h * 31 + m.id.charCodeAt(i)) >>> 0
  return Math.round((18 + (m.sillas || 2) * 7 + (h % 40)) * 100) / 100
}
// Etiqueta humana de la reserva ("38 min", "Liberar" si ya pasó) — para tarjetas grandes (TPV).
export const mesaReservaLabel = (rem: number | null) => {
  if (rem == null) return null
  if (rem <= 0) return 'Liberar'
  return Math.max(1, Math.round(rem / 60000)) + ' min'
}

export type Mesa = {
  id: string
  nombre: string // "1", "2"… o nombre libre (Barra, Terraza 1)
  x: number // posición en el lienzo (px)
  y: number
  w: number // tamaño (px)
  h: number
  sillas: number // nº de plazas (se reparten alrededor)
  forma: MesaForma
  rot?: number // rotación en grados (0 = sin rotar)
  estado?: MesaEstado // estado en vivo (no se persiste en BD, solo layout)
  since?: number // timestamp en que se ocupó
  reservaFin?: number // timestamp en que ACABA la reserva (llega la siguiente) → cuenta atrás de presión
  merged?: Mesa[] // si es un BANCO fusionado: guarda las mesas originales para poder "Separar"
}

const KEY = 'rebell-salon-v1'

// Plano de arranque (para que no esté vacío): unas mesas colocadas con gracia.
export const DEFAULT_SALON: Mesa[] = [
  { id: 'm1', nombre: '1', x: 60, y: 90, w: 160, h: 100, sillas: 4, forma: 'rect' },
  { id: 'm3', nombre: '3', x: 470, y: 80, w: 120, h: 120, sillas: 4, forma: 'cuadrada' },
  { id: 'm5', nombre: '5', x: 880, y: 96, w: 104, h: 104, sillas: 2, forma: 'redonda' },
  { id: 'm2', nombre: '2', x: 60, y: 320, w: 100, h: 160, sillas: 4, forma: 'rect' },
  { id: 'm4', nombre: '4', x: 470, y: 330, w: 104, h: 104, sillas: 4, forma: 'redonda' },
  { id: 'm6', nombre: '6', x: 880, y: 330, w: 104, h: 104, sillas: 2, forma: 'redonda' },
]

export function loadSalon(): Mesa[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length) return arr as Mesa[]
    }
  } catch {
    /* sin localStorage */
  }
  return DEFAULT_SALON
}

export function saveSalon(mesas: Mesa[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(mesas))
  } catch {
    /* sin localStorage */
  }
}

export const totalPlazas = (mesas: Mesa[]) => mesas.reduce((s, m) => s + m.sillas, 0)

// Siembra estados de DEMO si el plano no trae ninguna mesa con servicio VIVO → siempre se ve vivo.
// "Vivo" = mesa por-cobrar, u ocupada cuya reserva AÚN no ha pasado. Si todos los timers ya caducaron
// (demo de una sesión anterior → todo "Liberar") se RE-SIEMBRA → siempre hay cuentas atrás corriendo.
// (se aplica tanto al plano de localStorage como al de Supabase, que no guarda estado de servicio).
export function seedStates(list: Mesa[]): Mesa[] {
  const t = Date.now()
  // "Vivo" = hay al menos una mesa OCUPADA con cuenta atrás todavía corriendo. Una mesa "cobrar" NO cuenta
  // (no tiene timer): si solo quedan cobrar + ocupadas caducadas, se RE-SIEMBRA → siempre se ven tiempos.
  const hasLive = list.some((m) => {
    const rem = mesaRemaining(m, t)
    return rem != null && rem > 0
  })
  if (hasLive) return list
  // age = hace cuánto se sentaron; rem = lo que queda de su reserva (negativo = pasada → liberar)
  const demo: Record<number, { e: MesaEstado; age: number; rem?: number }> = {
    0: { e: 'ocupada', age: 8 * 60000, rem: 34 * 60000 }, // a media comida (sana, NO se debe tocar)
    1: { e: 'cobrar', age: 33 * 60000 }, // lista para cobrar
    3: { e: 'ocupada', age: 64 * 60000, rem: -1 * 60000 }, // tiempo agotado → pasará a "por cobrar" sola
    4: { e: 'ocupada', age: 50 * 60000, rem: 3 * 60000 }, // a punto de acabar → cobrar en ~3 min
  }
  return list.map((m, i) =>
    demo[i]
      ? { ...m, estado: demo[i].e, since: t - demo[i].age, reservaFin: demo[i].rem != null ? t + (demo[i].rem as number) : undefined }
      : { ...m, estado: 'libre' as MesaEstado },
  )
}

// Plano CON estado de servicio, PERSISTIENDO la siembra → Salón y TPV leen exactamente lo MISMO
// (el primero que entra fija los timestamps de la demo; el otro los reutiliza → cuentas atrás coherentes).
export function loadSalonLive(): Mesa[] {
  const seeded = seedStates(loadSalon())
  saveSalon(seeded)
  return seeded
}

// Todas las mesas LIBRES (local CERRADO): sin ocupación ni reservas. La caja cerrada ⟹ no hay nadie en el
// local (la caja se cierra cuando ya no queda cliente) → no puede haber mesas ocupadas/por cobrar. (Juan, 27-jun)
export function allLibre(list: Mesa[]): Mesa[] {
  return list.map((m) => ({ ...m, estado: 'libre' as MesaEstado, since: undefined, reservaFin: undefined }))
}

// ── Persistencia en Supabase (por local, vía RLS) ──
async function resolveLocalId(): Promise<string | null> {
  if (localId()) return localId()
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return ((data.user?.app_metadata as { local_id?: string })?.local_id) ?? null
}

// Carga el plano del local desde la BD. null si no hay sesión o no hay mesas guardadas.
export async function loadSalonDB(): Promise<Mesa[] | null> {
  if (!supabase) return null
  const lid = await resolveLocalId()
  if (!lid) return null
  const { data, error } = await supabase.from('mesas').select('*').eq('local_id', lid).order('orden')
  if (error || !data || !data.length) return null
  return data.map((r) => ({ id: r.id as string, nombre: r.nombre, x: r.x, y: r.y, w: r.w, h: r.h, sillas: r.sillas, forma: r.forma }))
}

// Guarda el plano del local (reemplaza el suyo). Devuelve true si se guardó en BD.
export async function saveSalonDB(mesas: Mesa[]): Promise<boolean> {
  if (!supabase) return false
  const lid = await resolveLocalId()
  if (!lid) return false
  await supabase.from('mesas').delete().eq('local_id', lid)
  if (!mesas.length) return true
  const rows = mesas.map((m, i) => ({
    local_id: lid,
    nombre: m.nombre,
    x: Math.round(m.x),
    y: Math.round(m.y),
    w: Math.round(m.w),
    h: Math.round(m.h),
    sillas: m.sillas,
    forma: m.forma,
    orden: i,
  }))
  const { error } = await supabase.from('mesas').insert(rows)
  return !error
}

/* ── Geometría de formas (path SVG) — fuente única para el editor y el TPV ──
   roundedPolyPath: polígono con esquinas redondeadas. elePath: silueta en L. */
export function roundedPolyPath(pts: [number, number][], r: number) {
  const n = pts.length
  let d = ''
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]
    const cur = pts[i]
    const nxt = pts[(i + 1) % n]
    const v1x = cur[0] - prev[0], v1y = cur[1] - prev[1]
    const v2x = nxt[0] - cur[0], v2y = nxt[1] - cur[1]
    const l1 = Math.hypot(v1x, v1y) || 1
    const l2 = Math.hypot(v2x, v2y) || 1
    const rr = Math.min(r, l1 / 2, l2 / 2)
    const ax = cur[0] - (v1x / l1) * rr, ay = cur[1] - (v1y / l1) * rr
    const bx = cur[0] + (v2x / l2) * rr, by = cur[1] + (v2y / l2) * rr
    d += i === 0 ? `M ${ax.toFixed(1)} ${ay.toFixed(1)}` : ` L ${ax.toFixed(1)} ${ay.toFixed(1)}`
    d += ` Q ${cur[0].toFixed(1)} ${cur[1].toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`
  }
  return d + ' Z'
}
// L = columna izquierda (brazo vertical) + base inferior (brazo horizontal); muesca arriba-derecha.
export function elePath(w: number, h: number) {
  const aw = w * 0.46 // ancho del brazo vertical
  const ny = h * 0.54 // y donde arranca el brazo horizontal inferior
  const pts: [number, number][] = [[0, 0], [aw, 0], [aw, ny], [w, ny], [w, h], [0, h]]
  return roundedPolyPath(pts, Math.min(16, aw / 2, (h - ny) / 2))
}

/* Posiciones de las sillas alrededor de una mesa (coordenadas relativas a su
   esquina sup-izq). Redonda → círculo; rectangular → lados largos. */
export function seatPositions(m: Mesa): { x: number; y: number }[] {
  const n = Math.max(0, Math.min(20, m.sillas)) // hasta 20 para bancos fusionados (mesas normales tope 14 por UI)
  const pad = 9
  if (m.forma === 'redonda') {
    const r = Math.max(m.w, m.h) / 2 + pad
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      return { x: m.w / 2 + Math.cos(a) * r, y: m.h / 2 + Math.sin(a) * r }
    })
  }
  const along = (count: number, len: number) => Array.from({ length: count }, (_, i) => (len * (i + 1)) / (count + 1))
  // Mesa en L → sillas en los dos lados largos EXTERIORES de la L (borde izquierdo + borde inferior).
  if (m.forma === 'ele') {
    const aCount = Math.ceil(n / 2)
    const bCount = n - aCount
    return [
      ...along(aCount, m.h).map((y) => ({ x: -pad, y })), // lado izquierdo (columna vertical de la L)
      ...along(bCount, m.w).map((x) => ({ x, y: m.h + pad })), // lado inferior (base de la L)
    ]
  }
  const tall = m.h > m.w * 1.3
  const aCount = Math.ceil(n / 2)
  const bCount = n - aCount
  if (tall) {
    return [
      ...along(aCount, m.h).map((y) => ({ x: -pad, y })),
      ...along(bCount, m.h).map((y) => ({ x: m.w + pad, y })),
    ]
  }
  return [
    ...along(aCount, m.w).map((x) => ({ x, y: -pad })),
    ...along(bCount, m.w).map((x) => ({ x, y: m.h + pad })),
  ]
}
