/* ════════════════════════════════════════════════════════════════════
   COMANDAS — fuente única reactiva del tablero de cocina (KDS).
   El TPV EMPUJA una comanda (pushComanda); el KDS la LEE (useComandas) y la
   hace avanzar (advanceComanda).
   CABLEADO A SUPABASE (Fase 1): si hay sesión (personal logueado), las comandas
   viven en la tabla `comandas` (scoped por local vía RLS) y llegan EN VIVO por
   realtime → la cocina de OTRO dispositivo las ve aparecer. Sin sesión (demo),
   funciona en memoria como antes. Patrón igual que lib/wallet.ts.
   ════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react'
import { supabase, localId } from './supabase'
import { isDemoMode } from './demo'
import { consumirVenta, ensureAlmacenSync } from './almacen'

export type CItem = { name: string; qty: number; note?: string; aler?: string } // note = modificador (ámbar) · aler = alérgeno (rojo)
export type CStatus = 'nueva' | 'prep' | 'lista'
export type Comanda = { id: number; dbId?: string; n: number; src: string; color: string; mesa: string | null; items: CItem[]; born: number; status: CStatus }

export const C_SOURCES: Record<string, string> = { Sala: '#ffbf10', Online: '#3ad6c8', Glovo: '#ffc244', 'Uber Eats': '#06c167', 'Just Eat': '#ff8000' }
export const colorForSrc = (src: string) => C_SOURCES[src] || '#ffbf10'

// semilla demo: comandas reales (mesa + reparto, con notas/alérgenos) para que el tablero muestre los colores
// y los modificadores al entrar. SOLO demo; en real arranca vacío (la nube manda).
function seed(now: number): Comanda[] {
  const raw: Omit<Comanda, 'color'>[] = [
    { id: 1, n: 34, src: 'Sala', mesa: '7', items: [{ name: 'REBELL Classic', qty: 2, note: 'sin cebolla' }, { name: 'Patatas Rebell', qty: 1 }], born: now - 2 * 60000, status: 'nueva' },
    { id: 2, n: 35, src: 'Glovo', mesa: null, items: [{ name: 'Veggie Deluxe', qty: 1 }, { name: 'Nuggets x6', qty: 1 }], born: now - 40000, status: 'nueva' },
    { id: 3, n: 33, src: 'Sala', mesa: '5', items: [{ name: 'Doble Bacon', qty: 2, note: 'poco hecho' }, { name: 'Aros de cebolla', qty: 1 }], born: now - 9 * 60000, status: 'prep' },
    { id: 4, n: 36, src: 'Sala', mesa: '3', items: [{ name: 'Crispy Chicken', qty: 1, aler: 'SIN gluten' }, { name: 'Doble Bacon', qty: 1 }, { name: 'Refresco', qty: 2 }], born: now - 6 * 60000, status: 'prep' },
    { id: 5, n: 37, src: 'Uber Eats', mesa: null, items: [{ name: 'REBELL Classic', qty: 3 }], born: now - 4 * 60000, status: 'prep' },
    { id: 6, n: 32, src: 'Sala', mesa: '2', items: [{ name: 'Crispy Chicken', qty: 1 }, { name: 'Cerveza', qty: 1 }], born: now - 90000, status: 'lista' },
    // ── pedidos ONLINE (QR self-order) en vivo → alimentan el feed del panel Canal online ──
    { id: 7, n: 112, src: 'Online', mesa: '7', items: [{ name: 'REBELL Classic', qty: 2 }, { name: 'Patatas Rebell', qty: 1 }], born: now - 70000, status: 'nueva' },
    { id: 8, n: 110, src: 'Online', mesa: null, items: [{ name: 'Doble Bacon', qty: 1 }, { name: 'Refresco', qty: 1 }], born: now - 3 * 60000, status: 'prep' },
    { id: 9, n: 108, src: 'Online', mesa: '3', items: [{ name: 'Crispy Chicken', qty: 1 }], born: now - 5 * 60000, status: 'lista' },
  ]
  return raw.map((c) => ({ ...c, color: colorForSrc(c.src) }))
}

let seq = 40
// REAL: el tablero arranca VACÍO (la nube/realtime manda); la SEMILLA es solo DEMO (escaparate).
let comandas: Comanda[] = isDemoMode() ? seed(Date.now()) : []

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:comandas'))
}

export const getComandas = () => comandas

/* ── Cableado Supabase (realtime + hidratación), solo si hay sesión ── */
type Row = { id: string; numero: number; fuente: string; mesa: string | null; items: CItem[]; estado: string; creado_at: string }
const STATUSES: CStatus[] = ['nueva', 'prep', 'lista']
function fromRow(r: Row): Comanda {
  seq += 1
  return { id: 1000 + seq, dbId: r.id, n: r.numero, src: r.fuente, color: colorForSrc(r.fuente), mesa: r.mesa, items: r.items || [], born: new Date(r.creado_at).getTime(), status: (STATUSES.includes(r.estado as CStatus) ? r.estado : 'nueva') as CStatus }
}
let _syncStarted = false
let _live = false // hay sesión → la verdad está en Supabase
async function initSync() {
  if (_syncStarted || !supabase) return
  if (isDemoMode()) return // INTERRUPTOR demo: datos de ejemplo, no sincroniza con la nube
  _syncStarted = true
  const { data } = await supabase.auth.getSession()
  const lid = (data.session?.user?.app_metadata as { local_id?: string })?.local_id
  if (!lid || !data.session) return // demo → store en memoria
  _live = true
  void ensureAlmacenSync() // el stock debe estar "vivo" para que el descuento del pedido online PERSISTA aunque nadie abra Almacén
  supabase.realtime.setAuth(data.session.access_token) // el socket realtime necesita el token del usuario (si no, la RLS bloquea los avisos)
  // 1) hidratar las comandas ACTIVAS (no servidas) de mi local
  const { data: rows } = await supabase.from('comandas').select('*').eq('local_id', lid).neq('estado', 'servida').order('creado_at') // .eq además de la RLS (defensa en profundidad)
  comandas = (rows as Row[] | null)?.map(fromRow) ?? []
  emit()
  // 2) realtime: cualquier cambio en las comandas de MI local
  supabase
    .channel('kds-' + lid)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas', filter: 'local_id=eq.' + lid }, (payload) => {
      const ev = payload.eventType
      const row = payload.new as Row
      const oldId = (payload.old as { id?: string }).id
      if (ev === 'INSERT') {
        if (row.estado === 'servida') return
        if (!comandas.some((c) => c.dbId === row.id)) {
          comandas = [...comandas, fromRow(row)]
          // Pedido ONLINE (lo crea el cliente anónimo por la Edge Function) → al ENTRAR en vivo
          // baja su stock con la MISMA receta que el TPV (fuente única RECETAS en lib/almacen).
          // Solo 'Online': el TPV ya descuenta al cobrar → tocar el resto lo DOBLARÍA. Una vez por
          // INSERT (no en la hidratación) → no re-descuenta al recargar.
          // [lanzamiento] mover a decremento ATÓMICO server-side (recetas en BD) para que no dependa
          // de que un dispositivo del local esté abierto.
          if (row.fuente === 'Online') consumirVenta(row.items || [])
        }
      } else if (ev === 'UPDATE') {
        if (row.estado === 'servida') comandas = comandas.filter((c) => c.dbId !== row.id)
        else if (comandas.some((c) => c.dbId === row.id)) comandas = comandas.map((c) => (c.dbId === row.id ? { ...c, status: row.estado as CStatus } : c))
        else comandas = [...comandas, fromRow(row)] // re-aparece (p.ej. "deshacer servida" hecho en otro dispositivo)
      } else if (ev === 'DELETE') {
        comandas = comandas.filter((c) => c.dbId !== oldId)
      }
      emit()
    })
    .subscribe()
}

/* El TPV manda una comanda a cocina. Devuelve la comanda creada. */
export function pushComanda(input: { n?: number; mesa: string | null; items: CItem[]; src?: string }): Comanda {
  const src = input.src || 'Sala'
  seq += 1
  const items = input.items.filter((i) => i.qty > 0).map((i) => ({ name: i.name, qty: i.qty }))
  const c: Comanda = { id: 1000 + seq, n: input.n || seq, src, color: colorForSrc(src), mesa: input.mesa, items, born: Date.now(), status: 'nueva' }
  if (_live && supabase) {
    // La verdad va a Supabase; el realtime la añade al tablero (aquí y en cocina).
    const lid = localId()
    if (lid) {
      supabase.from('comandas').insert({ local_id: lid, numero: c.n, fuente: src, mesa: input.mesa, items, estado: 'nueva' }).then(({ error }) => { if (error) { /* sin conexión: cae a local */ comandas = [...comandas, c]; emit() } })
      return c
    }
  }
  comandas = [...comandas, c] // demo / sin sesión
  emit()
  return c
}

// Última comanda servida (para DESHACER un toque accidental). Se pisa con cada nueva servida.
let lastServed: Comanda | null = null

/* Avanza una comanda: nueva → prep → lista → (servida = fuera). */
export function advanceComanda(id: number): CStatus | 'served' | null {
  const t = comandas.find((c) => c.id === id)
  if (!t) return null
  const next: CStatus | 'servida' = t.status === 'lista' ? 'servida' : t.status === 'nueva' ? 'prep' : 'lista'
  if (next === 'servida') lastServed = { ...t } // guardar ANTES de quitarla, por si hay que deshacer
  if (_live && supabase && t.dbId) {
    // optimista local + persiste (el realtime reconcilia los demás dispositivos)
    if (next === 'servida') comandas = comandas.filter((c) => c.id !== id)
    else comandas = comandas.map((c) => (c.id === id ? { ...c, status: next } : c))
    emit()
    supabase.from('comandas').update({ estado: next }).eq('id', t.dbId).then(() => {})
    return next === 'servida' ? 'served' : next
  }
  // demo / sin sesión
  if (t.status === 'lista') {
    comandas = comandas.filter((c) => c.id !== id)
    emit()
    return 'served'
  }
  comandas = comandas.map((c) => (c.id === id ? { ...c, status: next as CStatus } : c))
  emit()
  return next as CStatus
}

/* Deshacer la última "Servida": la devuelve al tablero como 'lista'. Un toque sin querer ya no pierde el pedido. */
export function undoLastServed(): boolean {
  if (!lastServed) return false
  const c = lastServed
  lastServed = null
  const restored: Comanda = { ...c, status: 'lista' }
  if (_live && supabase && c.dbId) {
    if (!comandas.some((x) => x.dbId === c.dbId)) comandas = [...comandas, restored]
    emit()
    supabase.from('comandas').update({ estado: 'lista' }).eq('id', c.dbId).then(() => {})
    return true
  }
  if (!comandas.some((x) => x.id === c.id)) comandas = [...comandas, restored]
  emit()
  return true
}

export function useComandas(): Comanda[] {
  const [, force] = useState(0)
  useEffect(() => {
    void initSync()
    const on = () => force((n) => n + 1)
    window.addEventListener('rebell:comandas', on)
    return () => window.removeEventListener('rebell:comandas', on)
  }, [])
  return comandas
}
