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
export const GASTOS_FIJOS_MES = 11000 // gastos fijos del mes (alquiler/luz/seguros…) — fuente única provisional

/* desgloses por franjas (para las shift-cards) */
export const FRANJAS_M: [string, number, number][] = [
  ['09–12h', 286.4, 62],
  ['12–15h', 360.0, 100],
]
export const FRANJAS_T: [string, number, number][] = [
  ['16–19h', 421.0, 74],
  ['19–23h', 720.0, 100],
]

/* ── Serie de ventas (últimos 10 días) — para la gráfica con protagonismo ──
   Cada día lleva su desglose efectivo/tarjeta/domicilio (para el tooltip). */
export type SalesPoint = { day: number; wd: string; value: number; e: number; t: number; d: number; today?: boolean }
const r2 = (n: number) => Math.round(n * 100) / 100
type Raw = { day: number; wd: string; value: number; re: number; rt: number }
const RAW: Raw[] = [
  { day: 12, wd: 'Jue', value: 1180, re: 0.26, rt: 0.45 },
  { day: 13, wd: 'Vie', value: 1520, re: 0.22, rt: 0.49 },
  { day: 14, wd: 'Sáb', value: 1610, re: 0.25, rt: 0.46 },
  { day: 15, wd: 'Dom', value: 1340, re: 0.28, rt: 0.43 },
  { day: 16, wd: 'Lun', value: 980, re: 0.3, rt: 0.42 },
  { day: 17, wd: 'Mar', value: 1120, re: 0.27, rt: 0.45 },
  { day: 18, wd: 'Mié', value: 1245, re: 0.24, rt: 0.48 },
  { day: 19, wd: 'Jue', value: 1290, re: 0.23, rt: 0.5 },
  { day: 20, wd: 'Vie', value: 1655, re: 0.21, rt: 0.49 },
]
export const SALES: SalesPoint[] = [
  ...RAW.map((r) => {
    const e = r2(r.value * r.re),
      t = r2(r.value * r.rt)
    return { day: r.day, wd: r.wd, value: r.value, e, t, d: r2(r.value - e - t) }
  }),
  {
    day: 21,
    wd: 'Sáb',
    value: totalDia,
    today: true,
    e: r2(CAJA.manana.efectivo + CAJA.tarde.efectivo),
    t: r2(CAJA.manana.tarjeta + CAJA.tarde.tarjeta),
    d: r2(CAJA.manana.domicilio + CAJA.tarde.domicilio),
  },
]
export const salesMedian = SALES.reduce((s, p) => s + p.value, 0) / SALES.length

/* ── Ventas diarias para el calendario (mock determinista) ──
   "Hoy" del mundo demo = 21 jun 2026 (coincide con la barra superior y SALES).
   Cada día devuelve su desglose efectivo/tarjeta/domicilio, o null si es futuro
   (sin datos → gris). Determinista (sin Math.random) para no parpadear al re-render. */
export const HOY = new Date(2026, 5, 21)
export type DiaVenta = { e: number; t: number; d: number; total: number }

const frac = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function salesForDay(y: number, m: number, day: number): DiaVenta | null {
  if (y !== 2026) return null
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

/* ── formato ── */
export const eur = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const eur0 = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export const reduceMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
