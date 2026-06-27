/* ════════════════════════════════════════════════════════════════════
   CUENTAS por MESA — lo que una mesa ha consumido y aún no ha pagado.
   Antes, al cobrar una mesa, el importe era un HASH del id (cobroAmount) = un
   número inventado. Ahora: una mesa ACUMULA su cuenta cuando se le mandan
   comandas desde el TPV, y al cobrarla se carga el total REAL y se limpia.
   Las mesas que pasan a "por cobrar" por agotar su reserva (sin comandas en el
   demo) reciben una cuenta SEMILLA estable → el importe es consistente, no un
   hash al vuelo. (gap 1.2 de la auditoría, 27-jun)
   ════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react'

export type CuentaItem = { name: string; qty: number }
type Cuenta = { total: number; items: CuentaItem[] }

const KEY = 'rebell-cuentas-v1'
const r2 = (n: number) => Math.round(n * 100) / 100

function load(): Record<string, Cuenta> {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const o = JSON.parse(raw)
      if (o && typeof o === 'object') return o as Record<string, Cuenta>
    }
  } catch {
    /* sin localStorage */
  }
  return {}
}
let cuentas: Record<string, Cuenta> = load()

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cuentas))
  } catch {
    /* almacenamiento lleno/privado */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:cuentas'))
}

export const cuentaTotal = (mesaId: string | number) => r2(cuentas[String(mesaId)]?.total || 0)
export const cuentaItems = (mesaId: string | number) => cuentas[String(mesaId)]?.items || []

/* Suma una comanda a la cuenta de la mesa (consumo real). */
export function addToCuenta(mesaId: string | number, amount: number, items: CuentaItem[] = []) {
  const k = String(mesaId)
  const c = cuentas[k] || { total: 0, items: [] }
  cuentas = { ...cuentas, [k]: { total: r2(c.total + amount), items: [...c.items, ...items] } }
  emit()
}

/* Fija una cuenta SOLO si la mesa no tiene ninguna (mesas que piden cuenta por timeout → importe estable). */
export function seedCuenta(mesaId: string | number, amount: number, items: CuentaItem[] = []) {
  const k = String(mesaId)
  if (cuentas[k]) return
  cuentas = { ...cuentas, [k]: { total: r2(amount), items } }
  emit()
}

/* Cierra la cuenta de la mesa (tras cobrarla). */
export function clearCuenta(mesaId: string | number) {
  const k = String(mesaId)
  if (!cuentas[k]) return
  const next = { ...cuentas }
  delete next[k]
  cuentas = next
  emit()
}

export function useCuentas(): Record<string, Cuenta> {
  const [, force] = useState(0)
  useEffect(() => {
    const on = () => force((n) => n + 1)
    window.addEventListener('rebell:cuentas', on)
    return () => window.removeEventListener('rebell:cuentas', on)
  }, [])
  return cuentas
}
