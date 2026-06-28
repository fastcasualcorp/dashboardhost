/* ════════════════════════════════════════════════════════════════════
   VENTAS DEL TPV — fuente ÚNICA del libro de ventas (tickets y facturas).
   Antes el libro (VentasTpv) pintaba un mock fijo y el TPV cobraba por otro
   lado → un cobro NUNCA aparecía en el libro. Ahora: cada cobro del TPV hace
   `appendVenta(...)` y el libro lo lee al instante (mismo patrón reactivo que
   wallet/equipo/gastos). El histórico de demo va de SEMILLA → el libro nunca
   sale vacío. Persiste por navegador (localStorage). (gaps 0.3 / 3 del TPV)
   ════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react'
import type { Metodo } from './wallet'
import { supabase, localId } from './supabase'
import { isDemoMode } from './demo'

export type TipoDoc = 'ticket' | 'factura'
export type Venta = { id: string; tipo: TipoDoc; ts: number; arts: number; total: number; metodo?: Metodo; mesa?: string | null }

// Histórico de demo (tickets/facturas recientes) → el libro arranca poblado.
const SEED: Venta[] = [
  { id: 'F-0002', tipo: 'factura', ts: new Date(2026, 5, 21, 13, 11).getTime(), arts: 1, total: 10.85, metodo: 'tarjeta' },
  { id: 'T-0009', tipo: 'ticket', ts: new Date(2026, 5, 21, 12, 4).getTime(), arts: 3, total: 31.4, metodo: 'efectivo' },
  { id: 'T-0008', tipo: 'ticket', ts: new Date(2026, 5, 20, 22, 51).getTime(), arts: 2, total: 24.2, metodo: 'tarjeta' },
  { id: 'T-0007', tipo: 'ticket', ts: new Date(2026, 5, 20, 21, 18).getTime(), arts: 4, total: 47.3, metodo: 'tarjeta' },
  { id: 'F-0001', tipo: 'factura', ts: new Date(2026, 5, 20, 14, 2).getTime(), arts: 1, total: 11.5, metodo: 'tarjeta' },
  { id: 'T-0006', tipo: 'ticket', ts: new Date(2026, 5, 19, 23, 36).getTime(), arts: 1, total: 12.2, metodo: 'efectivo' },
  { id: 'T-0005', tipo: 'ticket', ts: new Date(2026, 5, 19, 23, 6).getTime(), arts: 2, total: 27.4, metodo: 'tarjeta' },
  { id: 'T-0004', tipo: 'ticket', ts: new Date(2026, 5, 18, 22, 57).getTime(), arts: 1, total: 13.0, metodo: 'efectivo' },
  { id: 'T-0003', tipo: 'ticket', ts: new Date(2026, 5, 18, 21, 40).getTime(), arts: 3, total: 33.6, metodo: 'tarjeta' },
  { id: 'T-0002', tipo: 'ticket', ts: new Date(2026, 5, 17, 22, 12).getTime(), arts: 2, total: 22.8, metodo: 'tarjeta' },
  { id: 'T-0001', tipo: 'ticket', ts: new Date(2026, 5, 17, 20, 5).getTime(), arts: 1, total: 11.0, metodo: 'efectivo' },
]

const KEY = 'rebell-ventas-v1'
const r2 = (n: number) => Math.round(n * 100) / 100

function load(): Venta[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const a = JSON.parse(raw) as Venta[]
      if (Array.isArray(a)) return a
    }
  } catch {
    /* sin localStorage */
  }
  return SEED.map((v) => ({ ...v }))
}
let ventas: Venta[] = load()

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(ventas.slice(0, 400)))
  } catch {
    /* almacenamiento lleno/privado */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:ventas'))
}

export const getVentas = (): Venta[] => ventas

/* ── Cableado Supabase (libro real por local), solo si hay sesión ── */
type VRow = { id: string; numero: number | null; doc: TipoDoc; total: number; metodo: Metodo | null; mesa: string | null; arts: number | null; creado_at: string }
const fmt = (n: number | null, id: string) => (n ? 'T-' + String(n).padStart(4, '0') : id.slice(0, 6))
function fromVRow(r: VRow): Venta {
  return { id: fmt(r.numero, r.id), tipo: r.doc, ts: new Date(r.creado_at).getTime(), arts: r.arts ?? 0, total: r.total, metodo: r.metodo ?? undefined, mesa: r.mesa }
}
let _syncStarted = false
let _live = false
async function initSync() {
  if (_syncStarted || !supabase) return
  if (isDemoMode()) return // INTERRUPTOR demo: datos de ejemplo, no sincroniza con la nube
  _syncStarted = true
  const { data } = await supabase.auth.getSession()
  const lid = (data.session?.user?.app_metadata as { local_id?: string })?.local_id
  if (!lid || !data.session) return // demo → localStorage
  _live = true
  supabase.realtime.setAuth(data.session.access_token) // token del usuario al socket realtime (RLS)
  const { data: rows } = await supabase.from('ventas').select('*').eq('local_id', lid).order('creado_at', { ascending: false }).limit(400) // .eq además de la RLS (defensa en profundidad)
  if (rows) { ventas = (rows as VRow[]).map(fromVRow); if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:ventas')) }
  supabase
    .channel('ventas-' + lid)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ventas', filter: 'local_id=eq.' + lid }, (payload) => {
      const v = fromVRow(payload.new as VRow)
      if (!ventas.some((x) => x.id === v.id && x.ts === v.ts)) ventas = [v, ...ventas].slice(0, 400)
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:ventas'))
    })
    .subscribe()
}

// Cada cobro del TPV cae aquí → aparece en el libro al instante. Devuelve la venta creada.
export function appendVenta(v: { tipo?: TipoDoc; arts: number; total: number; metodo?: Metodo; mesa?: string | null; id?: string | null; numero?: number }): Venta {
  const venta: Venta = {
    id: v.id || 'T-' + String(Date.now()).slice(-4),
    tipo: v.tipo ?? 'ticket',
    ts: Date.now(),
    arts: Math.max(0, Math.round(v.arts)),
    total: r2(v.total),
    metodo: v.metodo,
    mesa: v.mesa ?? null,
  }
  if (_live && supabase) {
    const lid = localId()
    if (lid) {
      // La verdad va a Supabase; el realtime lo añade al libro (aquí y en otros dispositivos).
      supabase.from('ventas').insert({ local_id: lid, total: venta.total, metodo: venta.metodo ?? 'tarjeta', mesa: venta.mesa, doc: venta.tipo, numero: v.numero ?? null, arts: venta.arts }).then(({ error }) => { if (error) { ventas = [venta, ...ventas].slice(0, 400); emit() } })
      return venta
    }
  }
  ventas = [venta, ...ventas].slice(0, 400) // demo / sin sesión
  emit()
  return venta
}

/* Clave de día local (año-mes-día) para cruzar con el calendario de Ventas. */
export const dayKey = (y: number, m: number, d: number) => `${y}-${m}-${d}`

/* Agrega las ventas REALES (TPV + online) por día → el calendario las suma sobre
   su base. Efectivo vs tarjeta por método; "domicilio" no aplica a estas. */
export function ventasPorDia(list: Venta[] = ventas): Map<string, { e: number; t: number; total: number }> {
  const map = new Map<string, { e: number; t: number; total: number }>()
  for (const v of list) {
    const dt = new Date(v.ts)
    const k = dayKey(dt.getFullYear(), dt.getMonth(), dt.getDate())
    const cur = map.get(k) || { e: 0, t: 0, total: 0 }
    const ef = v.metodo === 'efectivo' ? v.total : 0 // tarjeta o sin método → cuenta como tarjeta
    map.set(k, { e: cur.e + ef, t: cur.t + (v.total - ef), total: cur.total + v.total })
  }
  return map
}

/* ── AGREGADOS DE HOY (fuente real de la Caja del día en modo REAL) ──
   La Caja del día deja de inventar un SEED: en modo real DERIVA de estas sumas sobre las ventas reales del
   local (las mismas que ya guarda appendVenta + realtime). Sin doble-conteo: el total sale de aquí, no de un
   contador paralelo. (auditoría 28-jun, Fase 0 datos reales) */
export const isLive = () => _live
// Arranca la sincronización con Supabase (idempotente). La cartera/Caja del día la llama al montar para que
// el total real esté disponible aunque el "libro de ventas" (useVentas) no esté en pantalla. (Fase 0)
export const initVentas = () => { void initSync() }
const esHoy = (v: Venta) => {
  const d = new Date(v.ts)
  return dayKey(d.getFullYear(), d.getMonth(), d.getDate()) === (() => { const n = new Date(); return dayKey(n.getFullYear(), n.getMonth(), n.getDate()) })()
}
export const ventasHoy = (): Venta[] => ventas.filter(esHoy)
export const ventasHoyTotal = () => r2(ventasHoy().reduce((s, v) => s + v.total, 0))
export const ventasHoyPorMetodo = (m: Metodo) => r2(ventasHoy().filter((v) => (v.metodo ?? 'tarjeta') === m).reduce((s, v) => s + v.total, 0))
export const ventasHoyCount = () => ventasHoy().length

export function useVentas(): Venta[] {
  const [, force] = useState(0)
  useEffect(() => {
    void initSync()
    const on = () => force((n) => n + 1)
    window.addEventListener('rebell:ventas', on)
    return () => window.removeEventListener('rebell:ventas', on)
  }, [])
  return ventas
}
