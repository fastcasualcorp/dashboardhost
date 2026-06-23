/* Modelo del Salón (plano de sala) — fuente única de la que beben el editor de
   Salón y el selector de mesa del TPV. Persistencia interina en localStorage; en
   cuanto esté la auth real de Supabase, guardar/cargar por local (tabla `mesas`). */

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
