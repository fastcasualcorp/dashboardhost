/* ════════════════════════════════════════════════════════════════════
   ALMACÉN — fuente ÚNICA reactiva del STOCK. Antes el stock vivía en el
   componente y bajaba con un timer FALSO. Ahora: el stock es un store del que
   cualquiera puede tirar; cuando el TPV COBRA un plato, `consumirVenta()` baja
   sus ingredientes (receta) → las barras del almacén drenan AL VENDER de verdad.
   En memoria (se re-siembra al recargar, como antes) + evento `rebell:almacen`.
   Patrón igual que wallet/equipo/ventas. (audit · Almacén: stock real)
   CABLEADO A SUPABASE (Fase 1): si hay sesión, el stock del local se persiste
   como un blob jsonb (tabla `inventario`, 1 fila/local) con escritura DEBOUNCED
   (para no spamear por el drenaje ambiente). Sin sesión, demo en memoria.
   ════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { isDemoMode } from './demo'

export type Tipo = 'obrador' | 'refrigerado' | 'congelado' | 'seco'
export type Item = { pid: string; nivel: number; actual: string; umbral: string; cad?: number; max?: number }
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

/* ── Cableado Supabase (stock por local como blob jsonb; escritura DEBOUNCED) ── */
let _syncStarted = false
let _live = false
let _lid: string | null = null
let _saveTimer: ReturnType<typeof setTimeout> | null = null
function persistDebounced() {
  if (!_live || !supabase || !_lid) return
  if (_saveTimer) clearTimeout(_saveTimer)
  const sb = supabase
  const lid = _lid
  // OJO: el query-builder de supabase-js es LAZY — solo lanza la petición al hacer await/.then().
  // Sin el .then() la escritura NO se enviaba (el stock nunca persistía). (bug pre-existente)
  _saveTimer = setTimeout(() => {
    void sb.from('inventario').upsert({ local_id: lid, data: almacenes, updated_at: new Date().toISOString() }).then(({ error }) => { if (error && import.meta.env.DEV) console.warn('[almacen] persist:', error.message) })
  }, 3000)
}
// Exportada para que el KDS (lib/comandas) arranque la sync del stock aunque NADIE
// abra la sección Almacén → el pedido online persiste su descuento server-side igualmente.
export async function ensureAlmacenSync() {
  await initSync()
}
async function initSync() {
  if (_syncStarted || !supabase) return
  if (isDemoMode()) return // INTERRUPTOR demo: datos de ejemplo, no sincroniza con la nube
  _syncStarted = true
  const { data } = await supabase.auth.getSession()
  const lid = (data.session?.user?.app_metadata as { local_id?: string })?.local_id
  if (!lid) return // demo → memoria
  _live = true
  _lid = lid
  const { data: row } = await supabase.from('inventario').select('data').eq('local_id', lid).maybeSingle()
  if (row?.data && Array.isArray(row.data) && (row.data as unknown[]).length) {
    almacenes = row.data as Almacen[]
    emit()
  } else {
    // .then() obligatorio: sin él el builder lazy NO envía la petición (el blob no se sembraba).
    void supabase.from('inventario').upsert({ local_id: lid, data: almacenes }).then(({ error }) => { if (error && import.meta.env.DEV) console.warn('[almacen] seed:', error.message) }) // 1ª vez: sembrar
  }
}

export const getAlmacenes = (): Almacen[] => almacenes

// Mutador genérico (lo usan las ediciones de la sección: alta, borrar, renombrar, cargar, drenaje ambiente).
export function updateAlmacenes(fn: (list: Almacen[]) => Almacen[]) {
  almacenes = fn(almacenes)
  emit()
  persistDebounced()
}

// ACTUALIZAR el stock de UN producto a mano (recepción de mercancía / ajuste de inventario) (Juan 28-jun).
export function setItemStock(almId: string, pid: string, patch: Partial<Item>) {
  updateAlmacenes((list) => list.map((a) => (a.id !== almId ? a : {
    ...a,
    items: a.items.map((it) => (it.pid === pid ? { ...it, ...patch } : it)),
  })))
}
// Quitar un producto del almacén.
export function removeItem(almId: string, pid: string) {
  updateAlmacenes((list) => list.map((a) => (a.id !== almId ? a : { ...a, items: a.items.filter((it) => it.pid !== pid) })))
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
  if (tocados.size) {
    emit()
    persistDebounced()
  }
  return Array.from(tocados)
}

export function useAlmacen(): Almacen[] {
  const [, force] = useState(0)
  useEffect(() => {
    void initSync()
    const on = () => force((n) => n + 1)
    window.addEventListener('rebell:almacen', on)
    return () => window.removeEventListener('rebell:almacen', on)
  }, [])
  return almacenes
}
