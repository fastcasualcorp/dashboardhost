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

export type Gasto = { id: string; concepto: string; cat: string; base: number; iva: number; diaPago: number }

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
  { id: 'g1', concepto: 'Alquiler local', cat: 'Alquiler', base: 5500, iva: 21, diaPago: 1 },
  { id: 'g2', concepto: 'Luz (Endesa)', cat: 'Suministros', base: 520, iva: 21, diaPago: 20 },
  { id: 'g3', concepto: 'Agua', cat: 'Suministros', base: 130, iva: 10, diaPago: 15 },
  { id: 'g4', concepto: 'Gas natural', cat: 'Suministros', base: 360, iva: 21, diaPago: 20 },
  { id: 'g5', concepto: 'Seguro RC / incendios', cat: 'Seguros', base: 300, iva: 0, diaPago: 5 },
  { id: 'g6', concepto: 'Gestoría laboral', cat: 'Otros', base: 280, iva: 21, diaPago: 28 },
  { id: 'g7', concepto: 'Software TPV (REBELL)', cat: 'Software', base: 129, iva: 21, diaPago: 1 },
  { id: 'g8', concepto: 'Internet + teléfono', cat: 'Software', base: 95, iva: 21, diaPago: 10 },
  { id: 'g9', concepto: 'Limpieza', cat: 'Otros', base: 350, iva: 21, diaPago: 30 },
  { id: 'g10', concepto: 'Recogida de residuos', cat: 'Otros', base: 110, iva: 0, diaPago: 10 },
]

const r2 = (n: number) => Math.round(n * 100) / 100

// ── derivadas (la calculadora de IVA, en un solo sitio) ──
export const cuotaIva = (g: Gasto) => r2((g.base * g.iva) / 100)
export const totalGasto = (g: Gasto) => r2(g.base + (g.base * g.iva) / 100)

const KEY = 'rebell-gastos-v1'
function load(): Gasto[] {
  // REAL: la nube manda → sin gastos hasta sincronizar. La SEED es solo DEMO (evita P&L incoherente).
  if (!isDemoMode()) return []
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const a = JSON.parse(raw) as Gasto[]
      // compatibilidad: gastos guardados antes de existir diaPago → por defecto el día 1
      if (Array.isArray(a) && a.length) return a.map((g) => ({ ...g, diaPago: g.diaPago ?? 1 }))
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
  // REAL: NO se siembran gastos de ejemplo en la BD del cliente (ensuciaba su tabla — auditoría 28-jun).
  // Empresa nueva = sin gastos. La SEED es solo para DEMO.
  const rows = (await supabase.from('gastos').select('*').eq('local_id', lid).order('creado_at')).data
  gastos = (rows || []).map((r) => ({ id: r.id as string, concepto: r.concepto, cat: r.cat, base: Number(r.base), iva: r.iva, diaPago: Number((r as { dia_pago?: number }).dia_pago) || 1 }))
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:gastos'))
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
export function setGastoCat(id: string, cat: string) {
  gastos = gastos.map((g) => (g.id === id ? { ...g, cat } : g))
  emit()
  if (_live && supabase) supabase.from('gastos').update({ cat }).eq('id', id).then(() => {})
}
export function setGastoConcepto(id: string, concepto: string) {
  gastos = gastos.map((g) => (g.id === id ? { ...g, concepto } : g))
  emit()
  if (_live && supabase) supabase.from('gastos').update({ concepto }).eq('id', id).then(() => {})
}
export function setGastoDiaPago(id: string, diaPago: number) {
  const v = Math.min(31, Math.max(1, Math.round(diaPago) || 1))
  gastos = gastos.map((g) => (g.id === id ? { ...g, diaPago: v } : g))
  emit()
  if (_live && supabase) supabase.from('gastos').update({ dia_pago: v }).eq('id', id).then(() => {})
}

const newId = () => { try { return crypto.randomUUID() } catch { return 'g' + Date.now() } }

/* Alta de un gasto fijo (optimista en local; en REAL escribe a la nube + re-sincroniza para cuadrar el id). */
export function addGasto(g: Omit<Gasto, 'id'>): Gasto {
  const nuevo: Gasto = { id: newId(), concepto: g.concepto.trim() || 'Nuevo gasto', cat: g.cat, base: Math.max(0, Math.round(g.base)), iva: g.iva, diaPago: Math.min(31, Math.max(1, Math.round(g.diaPago) || 1)) }
  gastos = [...gastos, nuevo]
  emit()
  if (_live && supabase && _lid) {
    supabase.from('gastos').insert({ concepto: nuevo.concepto, cat: nuevo.cat, base: nuevo.base, iva: nuevo.iva, dia_pago: nuevo.diaPago, local_id: _lid }).then(() => { void resync() })
  }
  return nuevo
}
export function removeGasto(id: string) {
  gastos = gastos.filter((g) => g.id !== id)
  emit()
  if (_live && supabase) supabase.from('gastos').delete().eq('id', id).then(() => {})
}
async function resync() {
  if (!_live || !supabase || !_lid) return
  const rows = (await supabase.from('gastos').select('*').eq('local_id', _lid).order('creado_at')).data
  if (rows) {
    gastos = rows.map((r) => ({ id: r.id as string, concepto: r.concepto, cat: r.cat, base: Number(r.base), iva: r.iva, diaPago: Number((r as { dia_pago?: number }).dia_pago) || 1 }))
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:gastos'))
  }
}

// Gastos ordenados por día de pago (para la lista "por vencimiento")
export const gastosOrdenados = () => [...gastos].sort((a, b) => a.diaPago - b.diaPago)
// Próximo pago a partir del día de HOY (busca el más cercano hacia delante; si no, el 1º del mes que viene)
export function proximoPago(hoyDia: number, diasDelMes = 30): { gasto: Gasto; enDias: number } | null {
  if (!gastos.length) return null
  const orden = gastosOrdenados()
  const futuros = orden.filter((g) => g.diaPago >= hoyDia)
  const g = futuros[0] || orden[0]
  const enDias = g.diaPago >= hoyDia ? g.diaPago - hoyDia : diasDelMes - hoyDia + g.diaPago
  return { gasto: g, enDias }
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
