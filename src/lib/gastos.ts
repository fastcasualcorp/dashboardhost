/* ════════════════════════════════════════════════════════════════════
   GASTOS FIJOS — fuente ÚNICA reactiva (alquiler, luz, seguros…) con IVA REAL.
   Antes el IVA era un texto decorativo y el total no cuadraba con el Resumen
   (3 cifras distintas para "gastos fijos"). Ahora: cada gasto tiene BASE
   imponible + tipo de IVA (0/4/10/21) → cuota y total se CALCULAN; el total
   del mes lo lee el Resumen (P&L) → una sola cifra. (gaps 3.1 y 3.2)
   Patrón igual que lib/equipo.ts / lib/wallet.ts.
   ════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { isDemoMode } from './demo'

export type Gasto = { id: string; concepto: string; cat: string; base: number; iva: number }

export const CAT_META: Record<string, { color: string }> = {
  Alquiler: { color: '#ffbf10' },
  Suministros: { color: '#ff7a45' },
  Otros: { color: '#b58bf0' },
  Seguros: { color: '#4aa3ff' },
  Software: { color: '#34d399' },
}
export const CAT_ORDER = Object.keys(CAT_META)
export const IVA_TIPOS = [0, 4, 10, 21]

const SEED: Gasto[] = [
  { id: 'g1', concepto: 'Alquiler local', cat: 'Alquiler', base: 5500, iva: 21 },
  { id: 'g2', concepto: 'Luz (Endesa)', cat: 'Suministros', base: 520, iva: 21 },
  { id: 'g3', concepto: 'Agua', cat: 'Suministros', base: 130, iva: 10 },
  { id: 'g4', concepto: 'Gas natural', cat: 'Suministros', base: 360, iva: 21 },
  { id: 'g5', concepto: 'Seguro RC / incendios', cat: 'Seguros', base: 300, iva: 0 },
  { id: 'g6', concepto: 'Gestoría laboral', cat: 'Otros', base: 280, iva: 21 },
  { id: 'g7', concepto: 'Software TPV (REBELL)', cat: 'Software', base: 129, iva: 21 },
  { id: 'g8', concepto: 'Internet + teléfono', cat: 'Software', base: 95, iva: 21 },
  { id: 'g9', concepto: 'Limpieza', cat: 'Otros', base: 350, iva: 21 },
  { id: 'g10', concepto: 'Recogida de residuos', cat: 'Otros', base: 110, iva: 0 },
]

const r2 = (n: number) => Math.round(n * 100) / 100

// ── derivadas (la calculadora de IVA, en un solo sitio) ──
export const cuotaIva = (g: Gasto) => r2((g.base * g.iva) / 100)
export const totalGasto = (g: Gasto) => r2(g.base + (g.base * g.iva) / 100)

const KEY = 'rebell-gastos-v1'
function load(): Gasto[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const a = JSON.parse(raw) as Gasto[]
      if (Array.isArray(a) && a.length) return a
    }
  } catch {
    /* sin localStorage */
  }
  return SEED.map((g) => ({ ...g }))
}
let gastos: Gasto[] = load()

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(gastos))
  } catch {
    /* almacenamiento lleno/privado */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:gastos'))
}

export const getGastos = () => gastos

/* ── Cableado Supabase (gastos por local), solo si hay sesión. Sin realtime
   (un editor por local); hidrata + escribe. Siembra la demo la 1ª vez. ── */
let _syncStarted = false
let _live = false
async function initSync() {
  if (_syncStarted || !supabase) return
  if (isDemoMode()) return // INTERRUPTOR demo: datos de ejemplo, no sincroniza con la nube
  _syncStarted = true
  const { data } = await supabase.auth.getSession()
  const lid = (data.session?.user?.app_metadata as { local_id?: string })?.local_id
  if (!lid) return // demo → localStorage
  _live = true
  let rows = (await supabase.from('gastos').select('*').eq('local_id', lid).order('creado_at')).data
  if (!rows || !rows.length) {
    await supabase.from('gastos').insert(SEED.map((g) => ({ local_id: lid, concepto: g.concepto, cat: g.cat, base: g.base, iva: g.iva })))
    rows = (await supabase.from('gastos').select('*').eq('local_id', lid).order('creado_at')).data
  }
  if (rows) {
    gastos = rows.map((r) => ({ id: r.id as string, concepto: r.concepto, cat: r.cat, base: Number(r.base), iva: r.iva }))
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:gastos'))
  }
}

export function setGastoBase(id: string, base: number) {
  const v = Math.max(0, Math.round(base))
  gastos = gastos.map((g) => (g.id === id ? { ...g, base: v } : g))
  emit()
  if (_live && supabase) supabase.from('gastos').update({ base: v }).eq('id', id).then(() => {})
}
export function setGastoIva(id: string, iva: number) {
  gastos = gastos.map((g) => (g.id === id ? { ...g, iva } : g))
  emit()
  if (_live && supabase) supabase.from('gastos').update({ iva }).eq('id', id).then(() => {})
}

// Totales del mes (los que lee el Resumen → una sola cifra para "gastos fijos")
export const gastosBaseMes = () => r2(gastos.reduce((s, g) => s + g.base, 0))
export const gastosIvaMes = () => r2(gastos.reduce((s, g) => s + cuotaIva(g), 0))
export const gastosMes = () => r2(gastos.reduce((s, g) => s + totalGasto(g), 0)) // total CON IVA = lo que paga el local

export function useGastos(): Gasto[] {
  const [, force] = useState(0)
  useEffect(() => {
    void initSync()
    const on = () => force((n) => n + 1)
    window.addEventListener('rebell:gastos', on)
    return () => window.removeEventListener('rebell:gastos', on)
  }, [])
  return gastos
}
