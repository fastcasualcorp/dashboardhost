/* ════════════════════════════════════════════════════════════════════
   COMANDAS — fuente única reactiva del tablero de cocina (KDS).
   El TPV EMPUJA una comanda (pushComanda) al pulsar "Comanda"; el KDS la LEE
   en vivo (useComandas) y la hace avanzar (advanceComanda). Antes el KDS
   inventaba comandas con un timer y el TPV no llegaba nunca a cocina (gap 1.1
   de la auditoría). Patrón igual que lib/wallet.ts / lib/equipo.ts.
   En memoria (las comandas son efímeras): al recargar vuelve la semilla demo.
   ════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react'

export type CItem = { name: string; qty: number }
export type CStatus = 'nueva' | 'prep' | 'lista'
export type Comanda = { id: number; n: number; src: string; color: string; mesa: string | null; items: CItem[]; born: number; status: CStatus }

export const C_SOURCES: Record<string, string> = { Sala: '#ffbf10', Glovo: '#ffc244', 'Uber Eats': '#06c167', 'Just Eat': '#ff8000' }
export const colorForSrc = (src: string) => C_SOURCES[src] || '#ffbf10'

// semilla demo: unas comandas ya envejecidas para que el tablero no esté vacío y se vean los colores al entrar
const DISHES = ['REBELL Classic', 'Doble Bacon', 'Crispy Chicken', 'Veggie Deluxe', 'Patatas Rebell', 'Nuggets x6', 'Aros de cebolla', 'Refresco', 'Cerveza', 'Brownie']
function makeItems(s: number): CItem[] {
  const k = 2 + (s % 3)
  const out: CItem[] = []
  for (let i = 0; i < k; i++) out.push({ name: DISHES[(s * 3 + i * 5) % DISHES.length], qty: 1 + ((s + i) % 2) })
  return out
}
function seed(now: number): Comanda[] {
  const ages = [12 * 60000, 6 * 60000, 2 * 60000, 40000, 9 * 60000]
  const statuses: CStatus[] = ['prep', 'prep', 'nueva', 'nueva', 'lista']
  const srcs = Object.keys(C_SOURCES)
  return ages.map((a, i) => ({ id: i + 1, n: 34 + i, src: srcs[i % srcs.length], color: colorForSrc(srcs[i % srcs.length]), mesa: null, items: makeItems(i + 1), born: now - a, status: statuses[i] }))
}

let seq = 40
let comandas: Comanda[] = seed(Date.now())

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:comandas'))
}

export const getComandas = () => comandas

/* El TPV manda una comanda a cocina. Devuelve la comanda creada. */
export function pushComanda(input: { n?: number; mesa: string | null; items: CItem[]; src?: string }): Comanda {
  const src = input.src || 'Sala'
  seq += 1
  const c: Comanda = {
    id: 1000 + seq,
    n: input.n || seq,
    src,
    color: colorForSrc(src),
    mesa: input.mesa,
    items: input.items.filter((i) => i.qty > 0).map((i) => ({ name: i.name, qty: i.qty })),
    born: Date.now(),
    status: 'nueva',
  }
  comandas = [...comandas, c]
  emit()
  return c
}

/* Avanza una comanda: nueva → prep → lista → (servida = fuera). */
export function advanceComanda(id: number): CStatus | 'served' | null {
  const t = comandas.find((c) => c.id === id)
  if (!t) return null
  if (t.status === 'lista') {
    comandas = comandas.filter((c) => c.id !== id)
    emit()
    return 'served'
  }
  const next: CStatus = t.status === 'nueva' ? 'prep' : 'lista'
  comandas = comandas.map((c) => (c.id === id ? { ...c, status: next } : c))
  emit()
  return next
}

export function useComandas(): Comanda[] {
  const [, force] = useState(0)
  useEffect(() => {
    const on = () => force((n) => n + 1)
    window.addEventListener('rebell:comandas', on)
    return () => window.removeEventListener('rebell:comandas', on)
  }, [])
  return comandas
}
