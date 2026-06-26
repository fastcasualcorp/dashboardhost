/* ════════════════════════════════════════════════════════════════════
   Cierre por FECHA — modelo determinista para navegar días sin backend.
   El mismo día siempre da los mismos números (semilla = fecha) → se ve real
   y no "baila" entre renders. Escala el cierre base (CAJA de data.ts) por un
   factor de día (finde más fuerte) y reparte por platos; cruza ventas × stock
   para la alerta del día siguiente. Con Supabase, esto vendrá de la tabla
   `ventas`/`comandas` del local; la FORMA de salida ya es la definitiva.
   ════════════════════════════════════════════════════════════════════ */
import { CAJA, FRANJAS_M, FRANJAS_T } from './data'

export type DiaTurno = { efectivo: number; tarjeta: number; domicilio: number }
export type Plato = { name: string; emoji: string; uds: number; eur: number }
// `unidad` = cómo se cuenta el producto (uds / kg / cajas…). Por ahora se fija aquí; en el futuro se
// elegirá en Almacén al dar de alta el producto (pedido de Juan, 25-jun).
export type Alerta = { item: string; emoji: string; nivel: 'alta' | 'media' | 'ok'; quedan: number; necesita: number; unidad: string }
export type Franja = [string, number, number]
export type Cierre = {
  total: number
  tickets: number
  medio: number
  descuadre: number // 0 = cuadrada; <0 = falta dinero
  deltaSemana: number // % vs mismo día de la semana pasada
  manana: DiaTurno
  tarde: DiaTurno
  subM: number
  subT: number
  franjasM: Franja[]
  franjasT: Franja[]
  topPlatos: Plato[]
  alertas: Alerta[]
}

const seedOf = (d: Date) => d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate()
// PRNG determinista (Lehmer) → reproducible por día.
function rng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}
function factorFecha(d: Date, r: () => number) {
  const dow = d.getDay() // 0 dom … 6 sáb
  const wk = dow === 5 || dow === 6 ? 1.28 : dow === 0 ? 1.12 : dow === 1 ? 0.8 : 0.96
  return wk * (0.86 + r() * 0.3) // 0,86 … 1,16
}

const PLATOS_BASE = [
  { name: 'REBELL Classic', emoji: '🍔', peso: 23, precio: 11 },
  { name: 'Doble Bacon', emoji: '🥓', peso: 20, precio: 13 },
  { name: 'Crispy Chicken', emoji: '🍗', peso: 15, precio: 12 },
  { name: 'Patatas Rebell', emoji: '🍟', peso: 18, precio: 4.5 },
  { name: 'Veggie Deluxe', emoji: '🥬', peso: 9, precio: 12 },
  { name: 'Alitas BBQ', emoji: '🔥', peso: 8, precio: 8 },
]
// Ingredientes y cuánto consume cada plato vendido (aprox) → cruce ventas×stock.
const STOCK_BASE = [
  { item: 'Pan brioche', emoji: '🍞', stock: 64, porPlato: 0.55, unidad: 'uds' },
  { item: 'Bacon', emoji: '🥓', stock: 60, porPlato: 0.12, unidad: 'kg' }, // bien surtido → ejemplo en VERDE
  { item: 'Pechuga de pollo', emoji: '🍗', stock: 42, porPlato: 0.3, unidad: 'kg' },
  { item: 'Queso cheddar', emoji: '🧀', stock: 130, porPlato: 0.7, unidad: 'kg' },
  { item: 'Patata', emoji: '🥔', stock: 28, porPlato: 0.22, unidad: 'kg' },
]

export function cierreDia(fecha: Date): Cierre {
  const r = rng(seedOf(fecha))
  const f = factorFecha(fecha, r)
  const scaleTurno = (t: DiaTurno): DiaTurno => ({
    efectivo: Math.round(t.efectivo * f),
    tarjeta: Math.round(t.tarjeta * f),
    domicilio: Math.round(t.domicilio * f),
  })
  const manana = scaleTurno(CAJA.manana)
  const tarde = scaleTurno(CAJA.tarde)
  const subM = manana.efectivo + manana.tarjeta + manana.domicilio
  const subT = tarde.efectivo + tarde.tarjeta + tarde.domicilio
  const total = subM + subT
  const tickets = Math.max(1, Math.round(CAJA.pedidos * f))
  const medio = total / tickets

  // descuadre ocasional (1 de cada 6 días), determinista
  const descuadre = seedOf(fecha) % 6 === 0 ? -(4 + Math.round(r() * 14)) : 0

  // Δ vs el MISMO día de la semana pasada
  const prev = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() - 7)
  const fPrev = factorFecha(prev, rng(seedOf(prev)))
  const deltaSemana = ((f - fPrev) / fPrev) * 100

  // reparto por platos (≈1,7 platos por ticket), con jitter por día
  const pesoTotal = PLATOS_BASE.reduce((s, p) => s + p.peso, 0)
  const udsTotal = tickets * 1.7
  const topPlatos: Plato[] = PLATOS_BASE.map((p) => {
    const uds = Math.max(1, Math.round((p.peso / pesoTotal) * udsTotal * (0.82 + r() * 0.36)))
    return { name: p.name, emoji: p.emoji, uds, eur: Math.round(uds * p.precio) }
  }).sort((a, b) => b.uds - a.uds)

  // ALERTA STOCK MAÑANA: si mañana vendes parecido a hoy, ¿qué se acaba?
  const platosVendidos = topPlatos.reduce((s, p) => s + p.uds, 0)
  const computadas: Alerta[] = STOCK_BASE.map((s) => {
    const necesita = Math.round(platosVendidos * s.porPlato)
    // alta = no llega; media = va justo (≥70% del stock); ok = vas sobrado (verde)
    const nivel: Alerta['nivel'] = necesita > s.stock ? 'alta' : necesita > s.stock * 0.7 ? 'media' : 'ok'
    return { item: s.item, emoji: s.emoji, nivel, quedan: s.stock, necesita, unidad: s.unidad }
  })
  // Mostramos los 2 más justos (rojo/ámbar) + 1 BIEN SURTIDO (verde) como referencia de "voy sobrado".
  const justos = computadas
    .filter((a) => a.nivel !== 'ok')
    .sort((a, b) => b.necesita - b.quedan - (a.necesita - a.quedan))
  const sobrado = computadas
    .filter((a) => a.nivel === 'ok')
    .sort((a, b) => b.quedan - b.necesita - (a.quedan - a.necesita))[0]
  const alertas: Alerta[] = [...justos.slice(0, 2), ...(sobrado ? [sobrado] : [])]

  // franjas escaladas (recalculando el % relativo dentro del turno)
  const scaleFr = (fr: Franja[]): Franja[] => {
    const v = fr.map(([h, e]) => [h, Math.round(e * f)] as [string, number])
    const mx = Math.max(...v.map((x) => x[1]), 1)
    return v.map(([h, e]) => [h, e, Math.round((e / mx) * 100)] as Franja)
  }

  return {
    total, tickets, medio, descuadre, deltaSemana,
    manana, tarde, subM, subT,
    franjasM: scaleFr(FRANJAS_M as Franja[]),
    franjasT: scaleFr(FRANJAS_T as Franja[]),
    topPlatos: topPlatos.slice(0, 5),
    alertas,
  }
}

/* ── helpers de fecha para el stepper ── */
export const esMismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const fmtDiaLargo = (d: Date, hoy: Date) =>
  esMismoDia(d, hoy) ? 'Hoy' : `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`
export const addDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
