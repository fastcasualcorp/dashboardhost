import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { isDemoMode } from './demo'

/* ── Datos demo de la caja (un día) ── */
export const CAJA = {
  manana: { efectivo: 180.5, tarjeta: 320.0, domicilio: 145.9 },
  tarde: { efectivo: 240.0, tarjeta: 520.4, domicilio: 380.6 },
  pedidos: 84,
}

export const subM = CAJA.manana.efectivo + CAJA.manana.tarjeta + CAJA.manana.domicilio
export const subT = CAJA.tarde.efectivo + CAJA.tarde.tarjeta + CAJA.tarde.domicilio
export const totalDia = subM + subT
export const avgT = totalDia / CAJA.pedidos
export const OBJ = 1492 // media objetivo (€) — referencia del "peso emocional"
export const META_DIA = 2000 // meta de facturación del día (€) — la que mide el anillo
// Facturación del MES — fuente ÚNICA compartida (Resumen P&L y Coste personal % s/ventas la usan IGUAL).
// En DEMO = 42000 (escaparate). En REAL la reescribe initRealAggregates() con la suma real del mes (RPC
// server-side, no el .limit del cliente). Es `let` → live binding: los consumidores ven el valor real al
// re-renderizar (useRealAgg). (auditoría 28-jun, datos reales)
export let VENTAS_MES = isDemoMode() ? 42000 : 0 // DEMO=escaparate; REAL=0 hasta que el RPC traiga la suma real
export const FOOD_COST_PCT = 0.3 // food cost objetivo del mes (30% s/facturación)
// Los gastos fijos del mes ahora son fuente única reactiva en lib/gastos.ts (gastosMes), no una constante.

/* desgloses por franjas (para las shift-cards) */
export const FRANJAS_M: [string, number, number][] = [
  ['09–12h', 286.4, 62],
  ['12–15h', 360.0, 100],
]
export const FRANJAS_T: [string, number, number][] = [
  ['16–19h', 421.0, 74],
  ['19–23h', 720.0, 100],
]

/* ── Serie de ventas (últimos 10 días, terminando HOY) ──
   Se genera RELATIVA a HOY (abajo) con el mismo motor determinista del calendario → el último punto es
   SIEMPRE hoy y la gráfica nunca se ve "vieja". Cada día lleva su desglose efectivo/tarjeta/domicilio. */
export type SalesPoint = { day: number; wd: string; value: number; e: number; t: number; d: number; today?: boolean }

/* ── Ventas diarias para el calendario (mock determinista) ──
   "Hoy" = el día REAL del sistema (a medianoche). Toda la demo navega relativa a HOY (la tira de fechas, el
   calendario y la serie de ventas) → la app SIEMPRE se ve al día. Con datos reales esto seguirá siendo hoy.
   Cada día devuelve su desglose efectivo/tarjeta/domicilio, o null si es futuro (sin datos → gris).
   Determinista (sin Math.random) para no parpadear al re-render. */
const _hoy = new Date()
export const HOY = new Date(_hoy.getFullYear(), _hoy.getMonth(), _hoy.getDate())
export type DiaVenta = { e: number; t: number; d: number; total: number }

const frac = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

// Caché de ventas reales por día (clave y-m-d), poblada por initRealAggregates() en modo REAL. null = aún demo.
const _realByDay = new Map<string, DiaVenta>()
let _realLoaded = false
const _dk = (y: number, m: number, day: number) => `${y}-${m}-${day}`

export function salesForDay(y: number, m: number, day: number): DiaVenta | null {
  const date = new Date(y, m, day)
  if (date > HOY) return null // futuro: sin datos (gris)
  // REAL: devuelve la venta real de ese día (0 si ese día no vendió), NUNCA el mock Math.sin.
  if (_realLoaded) return _realByDay.get(_dk(y, m, day)) ?? { e: 0, t: 0, d: 0, total: 0 }
  // REAL pero aún sin cargar (o el RPC falló): 0 honesto. El mock Math.sin es SOLO demo (escaparate).
  if (!isDemoMode()) return { e: 0, t: 0, d: 0, total: 0 }
  if (y !== HOY.getFullYear()) return null // la demo solo tiene datos del año en curso
  const wd = date.getDay() // 0 dom … 6 sáb
  const boost = wd === 5 || wd === 6 ? 1.5 : wd === 0 ? 1.2 : wd === 1 ? 0.82 : 1
  const seed = (m + 1) * 100 + day
  const total = Math.round((780 + frac(seed) * 1480) * boost)
  const e = Math.round(total * (0.2 + frac(seed + 7) * 0.12))
  const d = Math.round(total * (0.16 + frac(seed + 13) * 0.16))
  return { e, t: total - e - d, d, total }
}

export function salesForMonth(y: number, m: number): DiaVenta & { dias: number } {
  const days = new Date(y, m + 1, 0).getDate()
  let e = 0, t = 0, d = 0, total = 0, dias = 0
  for (let day = 1; day <= days; day++) {
    const s = salesForDay(y, m, day)
    if (s) {
      e += s.e
      t += s.t
      d += s.d
      total += s.total
      dias++
    }
  }
  return { e, t, d, total, dias }
}

export function salesForYear(y: number): number {
  let total = 0
  for (let m = 0; m < 12; m++) total += salesForMonth(y, m).total
  return total
}

/* ── Serie de los últimos 10 días terminando HOY (último punto = hoy) ── */
const DOW_AB = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MES_AB = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export let SALES: SalesPoint[] = Array.from({ length: 10 }, (_, k) => {
  const off = 9 - k
  const d = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() - off)
  const s = salesForDay(d.getFullYear(), d.getMonth(), d.getDate())
  return {
    day: d.getDate(),
    wd: DOW_AB[d.getDay()],
    value: s ? s.total : 0,
    e: s ? s.e : 0,
    t: s ? s.t : 0,
    d: s ? s.d : 0,
    today: off === 0,
  }
})
export let salesMedian = SALES.reduce((s, p) => s + p.value, 0) / SALES.length
/* Rango legible de la serie para subtítulos ("18–27 jun"); contempla el cruce de mes. */
const _d0 = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() - 9)
export const SALES_RANGE =
  _d0.getMonth() === HOY.getMonth()
    ? `${_d0.getDate()}–${HOY.getDate()} ${MES_AB[HOY.getMonth()]}`
    : `${_d0.getDate()} ${MES_AB[_d0.getMonth()]} – ${HOY.getDate()} ${MES_AB[HOY.getMonth()]}`

/* ════════════════════════════════════════════════════════════════════
   DATOS REALES (modo REAL) — reescriben los agregados demo con las ventas reales del local vía el RPC
   server-side `ventas_resumen` (suma TODAS las filas, no el .limit del cliente → el mes no miente). Math.sin
   queda solo como DEMO. Live bindings (let) + evento 'rebell:realagg' → los consumidores con useRealAgg() se
   actualizan al aterrizar los datos. (auditoría 28-jun, Fase datos reales) ════════════════════════════════ */
function recomputeSales() {
  SALES = Array.from({ length: 10 }, (_, k) => {
    const off = 9 - k
    const d = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() - off)
    const s = salesForDay(d.getFullYear(), d.getMonth(), d.getDate())
    return { day: d.getDate(), wd: DOW_AB[d.getDay()], value: s ? s.total : 0, e: s ? s.e : 0, t: s ? s.t : 0, d: s ? s.d : 0, today: off === 0 }
  })
  salesMedian = SALES.reduce((s, p) => s + p.value, 0) / SALES.length
}

let _aggStarted = false
export async function initRealAggregates() {
  if (_aggStarted || isDemoMode() || !supabase) return
  _aggStarted = true
  const { data: sess } = await supabase.auth.getSession()
  if (!sess.session) { _aggStarted = false; return } // sin sesión aún → reintentar luego
  const y = HOY.getFullYear()
  const { data, error } = await supabase.rpc('ventas_resumen', { desde: `${y}-01-01`, hasta: `${y}-12-31` })
  if (error || !data) return
  _realByDay.clear()
  for (const r of data as Array<{ dia: string; total: number; efectivo: number; tarjeta: number }>) {
    const dt = new Date(r.dia + 'T00:00:00')
    _realByDay.set(_dk(dt.getFullYear(), dt.getMonth(), dt.getDate()), { e: Number(r.efectivo), t: Number(r.tarjeta), d: 0, total: Number(r.total) })
  }
  _realLoaded = true
  VENTAS_MES = salesForMonth(y, HOY.getMonth()).total // suma real del mes en curso
  recomputeSales()
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:realagg'))
}

/** Suscribe un componente a los agregados reales: dispara la carga y re-renderiza cuando aterrizan. */
export function useRealAgg() {
  const [, force] = useState(0)
  useEffect(() => {
    void initRealAggregates()
    const on = () => force((n) => n + 1)
    window.addEventListener('rebell:realagg', on)
    return () => window.removeEventListener('rebell:realagg', on)
  }, [])
}

/* ── formato ──
   eur: ENTEROS sin decimales (722 €), con decimales solo cuando los hay (722,20 €) → más visual en TODO el
   dashboard (Juan, 28-jun). Se redondea a 2 antes de decidir para evitar falsos decimales por float. */
export const eur = (n: number) => {
  const r = Math.round(n * 100) / 100
  return Number.isInteger(r)
    ? r.toLocaleString('es-ES', { maximumFractionDigits: 0 })
    : r.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
export const eur0 = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export const reduceMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
