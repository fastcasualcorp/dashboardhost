/* Modelo del Salón (plano de sala) — fuente única de la que beben el editor de
   Salón y el selector de mesa del TPV. Persiste en Supabase (tabla `mesas`, RLS por
   local) cuando hay sesión; localStorage hace de caché para pintar al instante. */
import { supabase, localId } from './supabase'

export type MesaForma = 'cuadrada' | 'redonda' | 'rect'

export type Mesa = {
  id: string
  nombre: string // "1", "2"… o nombre libre (Barra, Terraza 1)
  x: number // posición en el lienzo (px)
  y: number
  w: number // tamaño (px)
  h: number
  sillas: number // nº de plazas (se reparten alrededor)
  forma: MesaForma
}

const KEY = 'rebell-salon-v1'

// Plano de arranque (para que no esté vacío): unas mesas colocadas con gracia.
export const DEFAULT_SALON: Mesa[] = [
  { id: 'm1', nombre: '1', x: 60, y: 70, w: 150, h: 92, sillas: 4, forma: 'rect' },
  { id: 'm2', nombre: '2', x: 60, y: 240, w: 92, h: 150, sillas: 4, forma: 'rect' },
  { id: 'm3', nombre: '3', x: 300, y: 70, w: 110, h: 110, sillas: 4, forma: 'cuadrada' },
  { id: 'm4', nombre: '4', x: 320, y: 260, w: 96, h: 96, sillas: 4, forma: 'redonda' },
  { id: 'm5', nombre: '5', x: 520, y: 90, w: 96, h: 96, sillas: 2, forma: 'redonda' },
  { id: 'm6', nombre: '6', x: 520, y: 250, w: 96, h: 96, sillas: 2, forma: 'redonda' },
]

export function loadSalon(): Mesa[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length) return arr as Mesa[]
    }
  } catch {
    /* sin localStorage */
  }
  return DEFAULT_SALON
}

export function saveSalon(mesas: Mesa[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(mesas))
  } catch {
    /* sin localStorage */
  }
}

export const totalPlazas = (mesas: Mesa[]) => mesas.reduce((s, m) => s + m.sillas, 0)

// ── Persistencia en Supabase (por local, vía RLS) ──
async function resolveLocalId(): Promise<string | null> {
  if (localId()) return localId()
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return ((data.user?.app_metadata as { local_id?: string })?.local_id) ?? null
}

// Carga el plano del local desde la BD. null si no hay sesión o no hay mesas guardadas.
export async function loadSalonDB(): Promise<Mesa[] | null> {
  if (!supabase) return null
  const lid = await resolveLocalId()
  if (!lid) return null
  const { data, error } = await supabase.from('mesas').select('*').eq('local_id', lid).order('orden')
  if (error || !data || !data.length) return null
  return data.map((r) => ({ id: r.id as string, nombre: r.nombre, x: r.x, y: r.y, w: r.w, h: r.h, sillas: r.sillas, forma: r.forma }))
}

// Guarda el plano del local (reemplaza el suyo). Devuelve true si se guardó en BD.
export async function saveSalonDB(mesas: Mesa[]): Promise<boolean> {
  if (!supabase) return false
  const lid = await resolveLocalId()
  if (!lid) return false
  await supabase.from('mesas').delete().eq('local_id', lid)
  if (!mesas.length) return true
  const rows = mesas.map((m, i) => ({
    local_id: lid,
    nombre: m.nombre,
    x: Math.round(m.x),
    y: Math.round(m.y),
    w: Math.round(m.w),
    h: Math.round(m.h),
    sillas: m.sillas,
    forma: m.forma,
    orden: i,
  }))
  const { error } = await supabase.from('mesas').insert(rows)
  return !error
}

/* Posiciones de las sillas alrededor de una mesa (coordenadas relativas a su
   esquina sup-izq). Redonda → círculo; rectangular → lados largos. */
export function seatPositions(m: Mesa): { x: number; y: number }[] {
  const n = Math.max(0, Math.min(14, m.sillas))
  const pad = 9
  if (m.forma === 'redonda') {
    const r = Math.max(m.w, m.h) / 2 + pad
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      return { x: m.w / 2 + Math.cos(a) * r, y: m.h / 2 + Math.sin(a) * r }
    })
  }
  const tall = m.h > m.w * 1.3
  const aCount = Math.ceil(n / 2)
  const bCount = n - aCount
  const along = (count: number, len: number) => Array.from({ length: count }, (_, i) => (len * (i + 1)) / (count + 1))
  if (tall) {
    return [
      ...along(aCount, m.h).map((y) => ({ x: -pad, y })),
      ...along(bCount, m.h).map((y) => ({ x: m.w + pad, y })),
    ]
  }
  return [
    ...along(aCount, m.w).map((x) => ({ x, y: -pad })),
    ...along(bCount, m.w).map((x) => ({ x, y: m.h + pad })),
  ]
}
