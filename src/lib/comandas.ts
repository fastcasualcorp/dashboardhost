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

export type CItem = { name: string; qty: number }
export type CStatus = 'nueva' | 'prep' | 'lista'
export type Comanda = { id: number; dbId?: string; n: number; src: string; color: string; mesa: string | null; items: CItem[]; born: number; status: CStatus }

export const C_SOURCES: Record<string, string> = { Sala: '#ffbf10', Online: '#3ad6c8', Glovo: '#ffc244', 'Uber Eats': '#06c167', 'Just Eat': '#ff8000' }
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
  _syncStarted = true
  const { data } = await supabase.auth.getSession()
  const lid = (data.session?.user?.app_metadata as { local_id?: string })?.local_id
  if (!lid || !data.session) return // demo → store en memoria
  _live = true
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
        if (!comandas.some((c) => c.dbId === row.id)) comandas = [...comandas, fromRow(row)]
      } else if (ev === 'UPDATE') {
        if (row.estado === 'servida') comandas = comandas.filter((c) => c.dbId !== row.id)
        else comandas = comandas.map((c) => (c.dbId === row.id ? { ...c, status: row.estado as CStatus } : c))
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

/* Avanza una comanda: nueva → prep → lista → (servida = fuera). */
export function advanceComanda(id: number): CStatus | 'served' | null {
  const t = comandas.find((c) => c.id === id)
  if (!t) return null
  const next: CStatus | 'servida' = t.status === 'lista' ? 'servida' : t.status === 'nueva' ? 'prep' : 'lista'
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
