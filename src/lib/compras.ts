/* ════════════════════════════════════════════════════════════════════
   COMPRAS — fuente ÚNICA reactiva de albaranes/facturas de proveedor.
   Antes Compras era una tabla fija (sin alta, sin persistencia, año 2025).
   Ahora: cada albarán tiene base + IVA → cuota/total calculados; das de ALTA
   uno y entran a la vez la tabla, las barras por proveedor y los KPIs. El
   estado pagado/pendiente se alterna con un clic. Mismo patrón que
   wallet/equipo/gastos/ventas. Cableado a Supabase por local (hidrata + siembra
   + escribe) con fallback demo si no hay sesión. (audit · Compras)
   ════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { isDemoMode } from './demo'

export type EstadoPago = 'pagado' | 'pendiente'
export type Albaran = { id: string; ts: number; proveedor: string; concepto: string; base: number; iva: number; estado: EstadoPago }

// Paleta por proveedor (tonos válidos del sistema) → barras y leyendas coherentes.
export const PROV_COLORS = ['gold', 'amber', 'blue', 'green', 'muted'] as const

const d = (day: number) => new Date(2026, 5, day, 9, 0).getTime()
const SEED: Albaran[] = [
  { id: 'a1', ts: d(18), proveedor: 'Makro', concepto: 'Carne / frescos sem. 25', base: 1234.5, iva: 12, estado: 'pagado' },
  { id: 'a2', ts: d(17), proveedor: 'Transgourmet', concepto: 'Salsas, congelados', base: 876, iva: 12, estado: 'pagado' },
  { id: 'a3', ts: d(16), proveedor: 'Campofrío / Frigoríficos', concepto: 'Bacon, queso lonchas', base: 1020, iva: 12, estado: 'pagado' },
  { id: 'a4', ts: d(15), proveedor: 'Cervecería Estrella Galicia', concepto: 'Barriles Estrella 30L ×6', base: 960, iva: 12, estado: 'pendiente' },
  { id: 'a5', ts: d(14), proveedor: 'Makro', concepto: 'Papas, aceites, misc.', base: 654.2, iva: 12, estado: 'pagado' },
  { id: 'a6', ts: d(12), proveedor: 'Unilever Food Sol.', concepto: 'Ketchup, mostaza, mayonesa', base: 430, iva: 12, estado: 'pagado' },
  { id: 'a7', ts: d(11), proveedor: 'Panadería Galega', concepto: 'Pan brioche artesano ×400', base: 540, iva: 5, estado: 'pagado' },
  { id: 'a8', ts: d(10), proveedor: 'Transgourmet', concepto: 'Bebidas y refrescos', base: 380, iva: 12, estado: 'pendiente' },
  { id: 'a9', ts: d(8), proveedor: 'Unilever Food Sol.', concepto: 'Productos limpieza cocina', base: 210, iva: 21, estado: 'pagado' },
]

const r2 = (n: number) => Math.round(n * 100) / 100
export const cuotaIva = (a: Albaran) => r2((a.base * a.iva) / 100)
export const totalAlbaran = (a: Albaran) => r2(a.base + (a.base * a.iva) / 100)

const KEY = 'rebell-compras-v1'
function load(): Albaran[] {
  // REAL: la nube manda → sin albaranes de ejemplo hasta sincronizar. La SEED es solo DEMO (escaparate).
  if (!isDemoMode()) return []
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const a = JSON.parse(raw) as Albaran[]
      if (Array.isArray(a) && a.length) return a
    }
  } catch {
    /* sin localStorage */
  }
  return SEED.map((a) => ({ ...a }))
}
let albaranes: Albaran[] = load()
let seq = albaranes.length

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(albaranes.slice(0, 300)))
  } catch {
    /* almacenamiento lleno/privado */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:compras'))
}

export const getCompras = (): Albaran[] => albaranes

/* ── Cableado Supabase (albaranes por local; hidrata + siembra + escribe) ── */
type ARow = { id: string; ts: number; proveedor: string; concepto: string | null; base: number; iva: number; estado: EstadoPago }
const fromRow = (r: ARow): Albaran => ({ id: r.id, ts: Number(r.ts), proveedor: r.proveedor, concepto: r.concepto ?? '—', base: Number(r.base), iva: r.iva, estado: r.estado })
let _syncStarted = false
let _live = false
let _lid: string | null = null
async function initSync() {
  if (_syncStarted || !supabase) return
  if (isDemoMode()) return // INTERRUPTOR demo: datos de ejemplo, no sincroniza con la nube
  _syncStarted = true
  const { data } = await supabase.auth.getSession()
  const lid = (data.session?.user?.app_metadata as { local_id?: string })?.local_id
  if (!lid) return // demo → localStorage
  _live = true
  _lid = lid
  // En REAL NO se siembra la tabla del cliente: una empresa nueva arranca con compras VACÍAS, nunca con
  // albaranes de ejemplo (eso ensuciaba la BD real del tenant — auditoría 28-jun). La SEED es solo para DEMO.
  const rows = (await supabase.from('compras').select('*').eq('local_id', lid).order('ts', { ascending: false })).data as ARow[] | null
  albaranes = (rows || []).map(fromRow)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:compras'))
}

export function addAlbaran(a: { proveedor: string; concepto: string; base: number; iva: number; estado?: EstadoPago }): Albaran {
  const nuevo: Albaran = {
    id: 'a' + ++seq + '_' + String(Date.now()).slice(-4),
    ts: Date.now(),
    proveedor: a.proveedor.trim() || 'Proveedor',
    concepto: a.concepto.trim() || '—',
    base: Math.max(0, r2(a.base)),
    iva: a.iva,
    estado: a.estado ?? 'pendiente',
  }
  if (_live && supabase && _lid) {
    // La verdad va a Supabase; el store se actualiza con la fila real (uuid).
    supabase.from('compras').insert({ local_id: _lid, ts: nuevo.ts, proveedor: nuevo.proveedor, concepto: nuevo.concepto, base: nuevo.base, iva: nuevo.iva, estado: nuevo.estado }).select().single().then(({ data }) => {
      if (data) { albaranes = [fromRow(data as ARow), ...albaranes].slice(0, 300); emit() }
    })
    return nuevo
  }
  albaranes = [nuevo, ...albaranes].slice(0, 300) // demo
  emit()
  return nuevo
}

export function toggleEstado(id: string) {
  let nuevoEstado: EstadoPago = 'pagado'
  albaranes = albaranes.map((a) => { if (a.id !== id) return a; nuevoEstado = a.estado === 'pagado' ? 'pendiente' : 'pagado'; return { ...a, estado: nuevoEstado } })
  emit()
  if (_live && supabase) supabase.from('compras').update({ estado: nuevoEstado }).eq('id', id).then(() => {})
}

export function removeAlbaran(id: string) {
  albaranes = albaranes.filter((a) => a.id !== id)
  emit()
  if (_live && supabase) supabase.from('compras').delete().eq('id', id).then(() => {})
}

// ── Derivadas del mes (una sola fuente para tabla, barras y KPIs) ──
export const comprasMes = () => r2(albaranes.reduce((s, a) => s + totalAlbaran(a), 0))
export const pendienteMes = () => r2(albaranes.filter((a) => a.estado === 'pendiente').reduce((s, a) => s + totalAlbaran(a), 0))
export const pagadoMes = () => r2(comprasMes() - pendienteMes())
export const proveedoresActivos = () => new Set(albaranes.map((a) => a.proveedor)).size

export function gastoPorProveedor(): { proveedor: string; total: number; color: string }[] {
  const map = new Map<string, number>()
  for (const a of albaranes) map.set(a.proveedor, (map.get(a.proveedor) || 0) + totalAlbaran(a))
  return Array.from(map.entries())
    .map(([proveedor, total]) => ({ proveedor, total: r2(total) }))
    .sort((x, y) => y.total - x.total)
    .map((row, i) => ({ ...row, color: PROV_COLORS[i % PROV_COLORS.length] }))
}

export function useCompras(): Albaran[] {
  const [, force] = useState(0)
  useEffect(() => {
    void initSync()
    const on = () => force((n) => n + 1)
    window.addEventListener('rebell:compras', on)
    return () => window.removeEventListener('rebell:compras', on)
  }, [])
  return albaranes
}
