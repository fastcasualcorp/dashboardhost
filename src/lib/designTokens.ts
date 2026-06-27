/* Escala tipográfica + botones EDITABLES desde el panel "Sistema de diseño" (Canon).
   Sobreescriben los tokens --fs-* / --btn-* en el elemento .app (inline → ganan sobre :root) y se
   guardan en localStorage → el cambio entra en TODA la app y sobrevive a recargas. (Juan, 26-jun) */

export type TypeToken = { key: string; varName: string; label: string; role: string; sample: string; min: number; max: number }

// 11 escalones canónicos (los ~480 tamaños sueltos del CSS se unificaron a éstos).
export const TYPE_SCALE: TypeToken[] = [
  { key: '4xl', varName: '--fs-4xl', label: 'Héroe', role: 'números gigantes', sample: '47.280', min: 36, max: 76 },
  { key: '3xl', varName: '--fs-3xl', label: 'Display', role: 'cifras grandes', sample: '1.787 €', min: 28, max: 60 },
  { key: '2xl', varName: '--fs-2xl', label: 'Título grande', role: 'títulos hero', sample: 'Resumen', min: 22, max: 48 },
  { key: 'xl', varName: '--fs-xl', label: 'H1 · titular', role: 'titulares', sample: 'Caja diaria', min: 18, max: 40 },
  { key: 'lg', varName: '--fs-lg', label: 'H2 · título', role: 'título de sección/card', sample: 'Ventas hoy', min: 15, max: 30 },
  { key: 'md', varName: '--fs-md', label: 'H3 · subtítulo', role: 'subtítulos', sample: 'Por franjas', min: 14, max: 26 },
  { key: 'base', varName: '--fs-base', label: 'Cuerpo', role: 'texto de lectura', sample: 'Texto de lectura del panel.', min: 13, max: 22 },
  { key: 'sm', varName: '--fs-sm', label: 'Texto / etiqueta', role: 'labels, valores', sample: 'Efectivo · Tarjeta · Domicilio', min: 12, max: 20 },
  { key: 'xs', varName: '--fs-xs', label: 'Pequeño', role: 'celdas, ayudas', sample: 'subtítulo · ayuda · celda', min: 10, max: 18 },
  { key: '2xs', varName: '--fs-2xs', label: 'Mini', role: 'etiquetas UPPER, chips', sample: 'POR FRANJAS HORARIAS', min: 9, max: 16 },
  { key: '3xs', varName: '--fs-3xs', label: 'Micro', role: 'pies, kbd', sample: 'pie de tabla · atajo', min: 8, max: 14 },
]
export const TYPE_DEFAULTS: Record<string, number> = { '4xl': 52, '3xl': 42, '2xl': 32, xl: 26, lg: 21, md: 19, base: 16, sm: 15, xs: 13, '2xs': 11, '3xs': 10 }

export type BtnToken = { key: string; varName: string; label: string; min: number; max: number }
export const BTN_TOKENS: BtnToken[] = [
  { key: 'fs', varName: '--btn-fs', label: 'Texto', min: 12, max: 22 },
  { key: 'py', varName: '--btn-py', label: 'Alto (padding ↕)', min: 6, max: 24 },
  { key: 'px', varName: '--btn-px', label: 'Ancho (padding ↔)', min: 10, max: 44 },
  { key: 'radius', varName: '--btn-radius', label: 'Redondeo', min: 0, max: 30 },
]
export const BTN_DEFAULTS: Record<string, number> = { fs: 15, py: 13, px: 24, radius: 14 }

const TYPE_KEY = 'rebell-typescale-v1'
const BTN_KEY = 'rebell-buttons-v1'
const WIDE_KEY = 'rebell-fontwide-v1'

// Anchura de fuente: factor scaleX que ESTIRA horizontalmente los números-héroe y titulares
// (Inter se ve más fina/estrecha que Clash → así se puede ensanchar hasta verse premium tipo SF Pro
// "wide"). 1.0 = sin estirar. Pedido de Juan (28-jun): meterlo como control vivo en Canon.
export const WIDE_MIN = 1.0
export const WIDE_MAX = 1.12
export const WIDE_DEFAULT = 1.0

const read = (k: string, def: Record<string, number>): Record<string, number> => {
  try {
    const r = localStorage.getItem(k)
    if (r) return { ...def, ...JSON.parse(r) }
  } catch {
    /* sin localStorage */
  }
  return { ...def }
}
const write = (k: string, v: Record<string, number>) => {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* */ }
}

const appEl = () => document.querySelector('.app') as HTMLElement | null

export const loadType = () => read(TYPE_KEY, TYPE_DEFAULTS)
export const saveType = (v: Record<string, number>) => write(TYPE_KEY, v)
export function applyType(v: Record<string, number>) {
  const app = appEl()
  if (!app) return
  for (const t of TYPE_SCALE) if (v[t.key] != null) app.style.setProperty(t.varName, v[t.key] + 'px')
}

export const loadBtn = () => read(BTN_KEY, BTN_DEFAULTS)
export const saveBtn = (v: Record<string, number>) => write(BTN_KEY, v)
export function applyBtn(v: Record<string, number>) {
  const app = appEl()
  if (!app) return
  for (const t of BTN_TOKENS) if (v[t.key] != null) app.style.setProperty(t.varName, v[t.key] + 'px')
}

export function loadWide(): number {
  try {
    const r = parseFloat(localStorage.getItem(WIDE_KEY) || '')
    if (r >= WIDE_MIN && r <= WIDE_MAX) return r
  } catch { /* sin localStorage */ }
  return WIDE_DEFAULT
}
export function saveWide(v: number) {
  try { localStorage.setItem(WIDE_KEY, String(v)) } catch { /* */ }
}
export function applyWide(v: number) {
  const app = appEl()
  if (app) app.style.setProperty('--font-wide', String(v))
}

// Al arrancar la app: re-aplica lo guardado para que el diseño persista entre recargas.
export function applySavedDesign() {
  applyType(loadType())
  applyBtn(loadBtn())
  applyWide(loadWide())
}
