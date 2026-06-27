/* ════════════════════════════════════════════════════════════════════
   ALMACÉN — fuente ÚNICA reactiva del STOCK. Antes el stock vivía en el
   componente y bajaba con un timer FALSO. Ahora: el stock es un store del que
   cualquiera puede tirar; cuando el TPV COBRA un plato, `consumirVenta()` baja
   sus ingredientes (receta) → las barras del almacén drenan AL VENDER de verdad.
   En memoria (se re-siembra al recargar, como antes) + evento `rebell:almacen`.
   Patrón igual que wallet/equipo/ventas. (audit · Almacén: stock real)
   ════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react'

export type Tipo = 'obrador' | 'refrigerado' | 'congelado' | 'seco'
export type Item = { pid: string; nivel: number; actual: string; umbral: string; cad?: number }
export type Almacen = { id: string; nombre: string; tipo: Tipo; foto: string; valor: number; ocupacion: number; items: Item[] }

export const FOTO: Record<Tipo, string> = {
  obrador: '/img/almacen-obrador.jpg',
  refrigerado: '/img/almacen-refrigerados.jpg',
  congelado: '/img/almacen-congelados.jpg',
  seco: '/img/almacen-seco.jpg',
}

const ALM0: Almacen[] = [
  {
    id: 'a1', nombre: 'Obrador central', tipo: 'obrador', foto: FOTO.obrador, valor: 1980, ocupacion: 72,
    items: [
      { pid: 'pan', nivel: 20, actual: '24 uds', umbral: '30 uds' },
      { pid: 'carne', nivel: 46, actual: '18,5 kg', umbral: '10 kg' },
      { pid: 'cheddar', nivel: 84, actual: '4,2 kg', umbral: '2 kg' },
      { pid: 'bacon', nivel: 38, actual: '3,8 kg', umbral: '3 kg' },
      { pid: 'salsa', nivel: 24, actual: '1,9 L', umbral: '2 L' },
    ],
  },
  {
    id: 'a2', nombre: 'Cámara refrigerada', tipo: 'refrigerado', foto: FOTO.refrigerado, valor: 1240, ocupacion: 64,
    items: [
      { pid: 'lechuga', nivel: 22, actual: '2,1 kg', umbral: '2 kg' },
      { pid: 'tomate', nivel: 74, actual: '5,6 kg', umbral: '3 kg' },
      { pid: 'cebolla', nivel: 70, actual: '4,0 kg', umbral: '2 kg' },
      { pid: 'pepinillos', nivel: 66, actual: '3,2 kg', umbral: '1,5 kg' },
    ],
  },
  {
    id: 'a3', nombre: 'Congelados', tipo: 'congelado', foto: FOTO.congelado, valor: 430, ocupacion: 48,
    items: [
      { pid: 'patata', nivel: 80, actual: '28 kg', umbral: '15 kg' },
      { pid: 'aros', nivel: 58, actual: '6,5 kg', umbral: '4 kg' },
    ],
  },
  {
    id: 'a4', nombre: 'Seco y bebidas', tipo: 'seco', foto: FOTO.seco, valor: 1200, ocupacion: 81,
    items: [
      { pid: 'cola', nivel: 67, actual: '96 uds', umbral: '48 uds' },
      { pid: 'cola-zero', nivel: 60, actual: '72 uds', umbral: '48 uds' },
      { pid: 'cerveza', nivel: 72, actual: '48 uds', umbral: '24 uds' },
      { pid: 'agua', nivel: 78, actual: '120 uds', umbral: '60 uds' },
    ],
  },
]

// RECETA: qué ingredientes (y cuánto NIVEL %) gasta vender UNA unidad de cada plato de la carta.
// Clave = nombre del plato tal cual viaja en el ticket (cart `name`). pct = % de nivel que baja por unidad.
const RECETAS: Record<string, { pid: string; pct: number }[]> = {
  'REBELL Classic': [{ pid: 'pan', pct: 3 }, { pid: 'carne', pct: 2.5 }, { pid: 'cheddar', pct: 1.5 }, { pid: 'salsa', pct: 1.5 }, { pid: 'lechuga', pct: 1 }, { pid: 'tomate', pct: 1 }],
  'Doble Bacon': [{ pid: 'pan', pct: 3 }, { pid: 'carne', pct: 5 }, { pid: 'bacon', pct: 3 }, { pid: 'cheddar', pct: 2 }, { pid: 'salsa', pct: 1.5 }],
  'Crispy Chicken': [{ pid: 'pan', pct: 3 }, { pid: 'lechuga', pct: 1.5 }, { pid: 'salsa', pct: 1.5 }],
  'Veggie Deluxe': [{ pid: 'pan', pct: 3 }, { pid: 'lechuga', pct: 2 }, { pid: 'tomate', pct: 1.5 }, { pid: 'cebolla', pct: 1.5 }, { pid: 'salsa', pct: 1.5 }],
  'Menú REBELL': [{ pid: 'pan', pct: 3 }, { pid: 'carne', pct: 2.5 }, { pid: 'cheddar', pct: 1.5 }, { pid: 'patata', pct: 3 }, { pid: 'cola', pct: 4 }],
  'Patatas Rebell': [{ pid: 'patata', pct: 4 }, { pid: 'salsa', pct: 1 }],
  'Nuggets x6': [{ pid: 'aros', pct: 1 }],
  'Aros de cebolla': [{ pid: 'aros', pct: 4 }],
  'Refresco': [{ pid: 'cola', pct: 4 }],
  'Cerveza': [{ pid: 'cerveza', pct: 4 }],
  'Agua': [{ pid: 'agua', pct: 3 }],
}

const clone = (list: Almacen[]): Almacen[] => list.map((a) => ({ ...a, items: a.items.map((it) => ({ ...it })) }))
let almacenes: Almacen[] = clone(ALM0)

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:almacen'))
}

export const getAlmacenes = (): Almacen[] => almacenes

// Mutador genérico (lo usan las ediciones de la sección: alta, borrar, renombrar, cargar, drenaje ambiente).
export function updateAlmacenes(fn: (list: Almacen[]) => Almacen[]) {
  almacenes = fn(almacenes)
  emit()
}

// EL TPV cobra → baja el stock de los ingredientes vendidos (receta). Devuelve qué ingredientes se tocaron.
export function consumirVenta(items: { name: string; qty: number }[]): string[] {
  const tocados = new Set<string>()
  almacenes = almacenes.map((a) => {
    let changed = false
    const nuevos = a.items.map((it) => {
      let baja = 0
      for (const ln of items) {
        const receta = RECETAS[ln.name]
        if (!receta) continue
        const ing = receta.find((r) => r.pid === it.pid)
        if (ing) baja += ing.pct * Math.max(1, ln.qty)
      }
      if (baja > 0) {
        changed = true
        tocados.add(it.pid)
        return { ...it, nivel: Math.max(4, +(it.nivel - baja).toFixed(2)) }
      }
      return it
    })
    return changed ? { ...a, items: nuevos } : a
  })
  if (tocados.size) emit()
  return Array.from(tocados)
}

export function useAlmacen(): Almacen[] {
  const [, force] = useState(0)
  useEffect(() => {
    const on = () => force((n) => n + 1)
    window.addEventListener('rebell:almacen', on)
    return () => window.removeEventListener('rebell:almacen', on)
  }, [])
  return almacenes
}
