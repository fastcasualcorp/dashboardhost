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
// Facturación del MES — fuente ÚNICA compartida (Resumen P&L y Coste personal % s/ventas la usan IGUAL → no se contradicen).
// PENDIENTE (0.3): cuando exista la fuente VENTAS real, derivar esto de las ventas reales del mes.
export const VENTAS_MES = 42000
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

export function salesForDay(y: number, m: number, day: number): DiaVenta | null {
  if (y !== HOY.getFullYear()) return null // la demo solo tiene datos del año en curso
  const date = new Date(y, m, day)
  if (date > HOY) return null
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
export const SALES: SalesPoint[] = Array.from({ length: 10 }, (_, k) => {
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
export const salesMedian = SALES.reduce((s, p) => s + p.value, 0) / SALES.length
/* Rango legible de la serie para subtítulos ("18–27 jun"); contempla el cruce de mes. */
const _d0 = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() - 9)
export const SALES_RANGE =
  _d0.getMonth() === HOY.getMonth()
    ? `${_d0.getDate()}–${HOY.getDate()} ${MES_AB[HOY.getMonth()]}`
    : `${_d0.getDate()} ${MES_AB[_d0.getMonth()]} – ${HOY.getDate()} ${MES_AB[HOY.getMonth()]}`

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
