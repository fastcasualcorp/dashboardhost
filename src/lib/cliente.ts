/* ════════════════════════════════════════════════════════════════════
   CLIENTE — el "ADN" del comensal. Una cuenta ligera que APRENDE de lo que
   pide para personalizar su experiencia: saludo de vuelta, "lo de siempre" y
   mensajes a medida al pagar ("casi siempre pides Brownie 🍫 ¿esta vez también?").
   Demo SIN backend: vive en localStorage de SU móvil (rebell-cliente-v1). En
   producción esto será un perfil de Supabase (mismo modelo) compartido entre
   visitas y locales. Patrón reactivo igual que wallet/ventas. (visión personalización)
   ════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react'
import { PRODUCTOS } from './products'

export type Cliente = {
  name?: string
  visits: number // nº de pedidos cerrados
  lastVisit: number // ts del último pedido
  spent: number // total gastado histórico
  items: Record<string, number> // nombre de plato → veces pedido (la "huella")
  stamps: number // sellos de fidelidad acumulados (0..STAMP_GOAL-1 tras canjear)
  rewards: number // recompensas ganadas pendientes de canjear
}

const KEY = 'rebell-cliente-v1'
export const STAMP_GOAL = 8 // cada 8 pedidos → 1 recompensa (un postre gratis)
export const REWARD_VALUE = 4.5 // valor del premio (un Brownie) en €
const DIA = 86400000
const EMPTY: Cliente = { visits: 0, lastVisit: 0, spent: 0, items: {}, stamps: 0, rewards: 0 }
const catByName: Record<string, string> = Object.fromEntries(PRODUCTOS.map((p) => [p.name, p.cat]))

function load(): Cliente {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { const o = JSON.parse(raw); if (o && typeof o === 'object') return { ...EMPTY, ...o, items: o.items || {} } }
  } catch {
    /* sin localStorage */
  }
  return { ...EMPTY }
}
let cliente: Cliente = load()

function emit() {
  try { localStorage.setItem(KEY, JSON.stringify(cliente)) } catch { /* lleno/privado */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:cliente'))
}

export const getCliente = (): Cliente => cliente
export const isReturning = (): boolean => cliente.visits > 0

export function setNombre(name: string) {
  cliente = { ...cliente, name: name.trim() || undefined }
  emit()
}

/* Aprende del pedido recién pagado: suma visita, gasto, huella y un SELLO de fidelidad. */
export function recordOrder(lines: { name: string; qty: number }[], total: number) {
  const items = { ...cliente.items }
  for (const l of lines) items[l.name] = (items[l.name] || 0) + Math.max(1, l.qty)
  let stamps = (cliente.stamps || 0) + 1
  let rewards = cliente.rewards || 0
  if (stamps >= STAMP_GOAL) { rewards += 1; stamps -= STAMP_GOAL } // tarjeta llena → premio
  cliente = { ...cliente, visits: cliente.visits + 1, lastVisit: Date.now(), spent: Math.round((cliente.spent + total) * 100) / 100, items, stamps, rewards }
  emit()
}

/* Suma UN sello suelto (premio por valorar = "te sellamos doble"). Rueda a recompensa igual que un pedido. */
export function addStamp() {
  let stamps = (cliente.stamps || 0) + 1
  let rewards = cliente.rewards || 0
  if (stamps >= STAMP_GOAL) { rewards += 1; stamps -= STAMP_GOAL }
  cliente = { ...cliente, stamps, rewards }
  emit()
}

/* Canjea una recompensa (al pagar un pedido que la usa). */
export function redeemReward() {
  if ((cliente.rewards || 0) <= 0) return
  cliente = { ...cliente, rewards: cliente.rewards - 1 }
  emit()
}

/* Días desde la última visita (para "te echamos de menos"). */
export function daysSince(): number | null {
  if (!cliente.lastVisit) return null
  return Math.floor((Date.now() - cliente.lastVisit) / DIA)
}
/* ¿Hace mucho que no viene? (≥14 días) → saludo cálido de reencuentro. */
export function weMissYou(): boolean {
  const d = daysSince()
  return cliente.visits > 0 && d !== null && d >= 14
}

/* El plato que más repite (su "lo de siempre"). */
export function topItem(): string | null {
  const e = Object.entries(cliente.items).sort((a, b) => b[1] - a[1])
  return e.length ? e[0][0] : null
}

/* Su postre habitual (si tiene uno) — para el mensaje personalizado al pagar. */
export function favEnCategoria(cat: string): string | null {
  const e = Object.entries(cliente.items)
    .filter(([name]) => catByName[name] === cat)
    .sort((a, b) => b[1] - a[1])
  return e.length ? e[0][0] : null
}

/* Saludo a medida según el historial. */
export function saludo(): string {
  if (!cliente.visits) return ''
  const n = cliente.name ? `, ${cliente.name}` : ''
  if (cliente.visits >= 5) return `¡Qué bueno verte de nuevo${n}! 🔥`
  return `¡Hola otra vez${n}! 👋`
}

export function useCliente(): Cliente {
  const [, force] = useState(0)
  useEffect(() => {
    const on = () => force((n) => n + 1)
    window.addEventListener('rebell:cliente', on)
    return () => window.removeEventListener('rebell:cliente', on)
  }, [])
  return cliente
}
