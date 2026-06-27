/* ════════════════════════════════════════════════════════════════════
   FOOD COST — escandallo (coste de materia prima) por plato de la CARTA REAL.
   Antes la ficha técnica listaba platos que ni existen en el TPV (BBQ Smash,
   Onion Rings…) con cifras inventadas. Ahora el PVP sale de `products.ts`
   (única carta) y el coste sale de aquí; FC y margen se CALCULAN. El coste es
   editable (como Gastos) → FC/margen/KPIs recalculan en vivo. Persiste.
   Patrón igual que wallet/equipo/gastos/compras. (audit · Food cost)
   ════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react'
import { PRODUCTOS } from './products'

// Coste de materia prima (€) por id de plato. Los platos salen de la carta; esto es su escandallo.
const SEED: Record<string, number> = {
  classic: 2.97, doble: 3.77, crispy: 3.48, veggie: 4.2,
  patatas: 1.35, nuggets: 1.65, aros: 1.5,
  refresco: 0.45, cerveza: 0.7, agua: 0.25, brownie: 1.4,
}

const KEY = 'rebell-escandallo-v1'
const r2 = (n: number) => Math.round(n * 100) / 100

function load(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...SEED, ...(JSON.parse(raw) as Record<string, number>) }
  } catch {
    /* sin localStorage */
  }
  return { ...SEED }
}
let costes = load()

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(costes))
  } catch {
    /* almacenamiento lleno/privado */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:escandallo'))
}

export const getCoste = (id: string) => costes[id] ?? 0
export function setCoste(id: string, v: number) {
  costes = { ...costes, [id]: Math.max(0, r2(v)) }
  emit()
}

export type FichaFC = { id: string; name: string; cat: string; pvp: number; coste: number; fc: number; margen: number }

// La ficha derivada: solo platos que tienen escandallo (excluye Menús = bundle, para no doblar coste).
export function fichaFoodCost(): FichaFC[] {
  return PRODUCTOS.filter((p) => costes[p.id] != null).map((p) => {
    const coste = getCoste(p.id)
    return { id: p.id, name: p.name, cat: p.cat, pvp: p.price, coste, fc: p.price ? Math.round((coste / p.price) * 1000) / 10 : 0, margen: r2(p.price - coste) }
  })
}

export const fcMedio = () => {
  const f = fichaFoodCost()
  return f.length ? Math.round((f.reduce((s, x) => s + x.fc, 0) / f.length) * 10) / 10 : 0
}

export function useFoodcost(): Record<string, number> {
  const [, force] = useState(0)
  useEffect(() => {
    const on = () => force((n) => n + 1)
    window.addEventListener('rebell:escandallo', on)
    return () => window.removeEventListener('rebell:escandallo', on)
  }, [])
  return costes
}

/* ── ESCANDALLO POR INGREDIENTE: el coste de cada materia prima (€/unidad) y su consumo mensual estimado.
   Editar un céntimo aquí muestra EN VIVO cuánto se ahorra al mes en toda la carta → el norte ROI de Juan
   ("baja X céntimos la carne → +X € de margen al mes"). Persiste y avisa con el mismo evento. (Juan 28-jun) */
export type Ingrediente = { id: string; name: string; emo: string; unit: string; coste: number; usoMes: number }
const ING_SEED: Ingrediente[] = [
  { id: 'carne', name: 'Carne picada', emo: '🥩', unit: 'kg', coste: 8.2, usoMes: 180 },
  { id: 'pan', name: 'Pan brioche', emo: '🍞', unit: 'ud', coste: 0.42, usoMes: 2600 },
  { id: 'cheddar', name: 'Queso cheddar', emo: '🧀', unit: 'kg', coste: 9.5, usoMes: 42 },
  { id: 'bacon', name: 'Bacon', emo: '🥓', unit: 'kg', coste: 7.8, usoMes: 30 },
  { id: 'pollo', name: 'Pollo crispy', emo: '🍗', unit: 'kg', coste: 6.4, usoMes: 55 },
  { id: 'patata', name: 'Patata congelada', emo: '🍟', unit: 'kg', coste: 1.3, usoMes: 240 },
  { id: 'salsa', name: 'Salsa Rebell', emo: '🥫', unit: 'L', coste: 4.1, usoMes: 60 },
  { id: 'lechuga', name: 'Lechuga', emo: '🥬', unit: 'kg', coste: 1.8, usoMes: 40 },
  { id: 'tomate', name: 'Tomate', emo: '🍅', unit: 'kg', coste: 2.1, usoMes: 38 },
]
const ING_KEY = 'rebell-escandallo-ing-v1'
function loadIng(): Record<string, number> {
  try {
    const raw = localStorage.getItem(ING_KEY)
    if (raw) return JSON.parse(raw) as Record<string, number>
  } catch { /* sin localStorage */ }
  return {}
}
let ingCostes = loadIng()
export function getIngredientes(): Ingrediente[] {
  return ING_SEED.map((i) => ({ ...i, coste: ingCostes[i.id] ?? i.coste }))
}
export function setIngredienteCoste(id: string, v: number) {
  ingCostes = { ...ingCostes, [id]: Math.max(0, Math.round(v * 100) / 100) }
  try { localStorage.setItem(ING_KEY, JSON.stringify(ingCostes)) } catch { /* */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:escandallo'))
}
// Coste de materia prima al mes (suma de coste × consumo de cada ingrediente).
export const costeMateriaMes = () => getIngredientes().reduce((s, i) => s + i.coste * i.usoMes, 0)
