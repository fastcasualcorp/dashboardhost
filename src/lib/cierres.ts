/* ════════════════════════════════════════════════════════════════════
   LIBRO DE CIERRES (ARQUEOS) — fuente ÚNICA del histórico de cierres de caja
   (turno apertura→cierre). Cada vez que el TPV cierra caja, `wallet.registrarCierre`
   llama a `appendCierre(...)` → cae en este libro al instante. Si hay sesión, la
   verdad va a Supabase (tabla `cierres`) y el realtime lo replica a otros
   dispositivos; en demo, persiste en localStorage. Documento AUDITABLE (A3/5.7).
   Mismo patrón reactivo que `lib/ventas` (SEED → el libro nunca sale vacío).
   ════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react'
import { supabase, localId } from './supabase'
import { isDemoMode } from './demo'

export type Cierre = { id: string; ts: number; total: number; efectivo: number; tarjeta: number; tickets: number }

// Histórico de demo (arqueos de días anteriores) → el libro arranca poblado y cuadra
// con la semilla del wallet (~1.8 k/día). efectivo + tarjeta = total.
const SEED: Cierre[] = [
  { id: 'C-20260626', ts: new Date(2026, 5, 26, 23, 40).getTime(), total: 1842.6, efectivo: 612.4, tarjeta: 1230.2, tickets: 58 },
  { id: 'C-20260625', ts: new Date(2026, 5, 25, 23, 35).getTime(), total: 1620.3, efectivo: 540.1, tarjeta: 1080.2, tickets: 51 },
  { id: 'C-20260624', ts: new Date(2026, 5, 24, 23, 50).getTime(), total: 1487.9, efectivo: 498.5, tarjeta: 989.4, tickets: 47 },
  { id: 'C-20260623', ts: new Date(2026, 5, 23, 23, 30).getTime(), total: 1733.1, efectivo: 583.6, tarjeta: 1149.5, tickets: 55 },
  { id: 'C-20260622', ts: new Date(2026, 5, 22, 23, 45).getTime(), total: 1958.4, efectivo: 651.2, tarjeta: 1307.2, tickets: 62 },
  { id: 'C-20260620', ts: new Date(2026, 5, 20, 23, 38).getTime(), total: 1402.0, efectivo: 470.0, tarjeta: 932.0, tickets: 44 },
]

const KEY = 'rebell-cierres-v1'
const r2 = (n: number) => Math.round(n * 100) / 100

function load(): Cierre[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const a = JSON.parse(raw) as Cierre[]
      if (Array.isArray(a)) return a
    }
  } catch {
    /* sin localStorage */
  }
  return SEED.map((c) => ({ ...c }))
}
let cierres: Cierre[] = load()

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cierres.slice(0, 200)))
  } catch {
    /* almacenamiento lleno/privado */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:cierres'))
}

export const getCierres = (): Cierre[] => cierres

/* ── Cableado Supabase (libro real por local), solo si hay sesión ── */
type CRow = { id: string; total: number; efectivo: number; tarjeta: number; tickets: number; creado_at: string }
function fromCRow(r: CRow): Cierre {
  return { id: r.id.slice(0, 8), ts: new Date(r.creado_at).getTime(), total: r.total, efectivo: r.efectivo, tarjeta: r.tarjeta, tickets: r.tickets }
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
  const { data: rows } = await supabase.from('cierres').select('*').eq('local_id', lid).order('creado_at', { ascending: false }).limit(200) // .eq además de la RLS (defensa en profundidad)
  if (rows) { cierres = (rows as CRow[]).map(fromCRow); if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:cierres')) }
  supabase
    .channel('cierres-' + lid)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cierres', filter: 'local_id=eq.' + lid }, (payload) => {
      const c = fromCRow(payload.new as CRow)
      if (!cierres.some((x) => x.id === c.id)) cierres = [c, ...cierres].slice(0, 200)
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:cierres'))
    })
    .subscribe()
}

// Registra un cierre (arqueo) → aparece en el libro al instante. Lo llama wallet al cerrar caja.
// La verdad va a Supabase (si hay sesión) y el realtime lo añade aquí y en otros dispositivos.
export function appendCierre(c: { total: number; efectivo: number; tarjeta: number; tickets: number }): Cierre {
  const cierre: Cierre = {
    id: 'C-' + String(Date.now()).slice(-8),
    ts: Date.now(),
    total: r2(c.total),
    efectivo: r2(c.efectivo),
    tarjeta: r2(c.tarjeta),
    tickets: Math.max(0, Math.round(c.tickets)),
  }
  if (_live && supabase) {
    const lid = localId()
    if (lid) {
      supabase.from('cierres').insert({ local_id: lid, total: cierre.total, efectivo: cierre.efectivo, tarjeta: cierre.tarjeta, tickets: cierre.tickets }).then(({ error }) => { if (error) { cierres = [cierre, ...cierres].slice(0, 200); emit() } })
      return cierre
    }
  }
  cierres = [cierre, ...cierres].slice(0, 200) // demo / sin sesión
  emit()
  return cierre
}

export function useCierres(): Cierre[] {
  const [, force] = useState(0)
  useEffect(() => {
    void initSync()
    const on = () => force((n) => n + 1)
    window.addEventListener('rebell:cierres', on)
    return () => window.removeEventListener('rebell:cierres', on)
  }, [])
  return cierres
}
