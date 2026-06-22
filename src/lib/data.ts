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

/* ── formato ── */
export const eur = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const eur0 = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export const reduceMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
