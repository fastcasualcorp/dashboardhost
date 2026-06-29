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

// RADIOS editables por uso (Juan 28-jun): el redondeo de TODA la app desde 3 mandos.
// Sobreescriben --r-input / --r-chip / --card-r en .app → entran en todo a la vez (el login queda fuera, usa :root).
export type RadiusToken = { key: string; varName: string; label: string; role: string; min: number; max: number }
export const RADIUS_TOKENS: RadiusToken[] = [
  { key: 'input', varName: '--r-input', label: 'Campos', role: 'inputs, celdas, controles ceñidos', min: 4, max: 18 },
  { key: 'chip', varName: '--r-chip', label: 'Chips / botón', role: 'chips, etiquetas, botones pequeños', min: 4, max: 22 },
  { key: 'card', varName: '--card-r', label: 'Paneles', role: 'tarjetas y paneles rectangulares', min: 8, max: 30 },
]
export const RADIUS_DEFAULTS: Record<string, number> = { input: 10, chip: 12, card: 18 }

const TYPE_KEY = 'rebell-typescale-v1'
const BTN_KEY = 'rebell-buttons-v1'
const RADIUS_KEY = 'rebell-radius-v1'
const WIDE_KEY = 'rebell-fontwide-v1'

// Anchura de fuente: factor scaleX que ESTIRA horizontalmente los números-héroe y titulares
// (Inter se ve más fina/estrecha que Clash → así se puede ensanchar hasta verse premium tipo SF Pro
// "wide"). 1.0 = sin estirar. Pedido de Juan (28-jun): meterlo como control vivo en Canon.
export const WIDE_MIN = 1.0
export const WIDE_MAX = 1.30
export const WIDE_DEFAULT = 1.0

// Espaciado entre caracteres (tracking) de los números-héroe → controla --num-spacing en vivo.
// Juan lo llama "interlineado": cuánto aire hay entre cifras. 0 = neutro.
const TRACK_KEY = 'rebell-fonttrack-v1'
export const TRACK_MIN = -4
export const TRACK_MAX = 3
export const TRACK_DEFAULT = 1 // un pelín de aire entre cifras (Clash es muy expanded → si no, se juntan). Juan 30-jun

// Peso de la tipografía POR USO (Juan 28-jun): números (héroe) y títulos de panel.
// Pasos de 100 = los pesos que Inter tiene cargados (600-900 / 500-900).
// Clash Display carga 400-700 → ese es el rango real. 900 caía en synthetic-bold (MUY gorda, cifras pegadas);
// 500 quedó demasiado fina. Default 600 = punto medio (Juan 30-jun: "ni tan gorda ni tan fina").
const NUMW_KEY = 'rebell-numweight-v1'
export const NUMW_MIN = 400
export const NUMW_MAX = 700
export const NUMW_DEFAULT = 600
const TITLEW_KEY = 'rebell-titleweight-v1'
export const TITLEW_MIN = 500
export const TITLEW_MAX = 900
export const TITLEW_DEFAULT = 800

// Grosor de las BARRAS (controla --bar-h: Resumen, Caja, Almacén, KDS… a la vez). (Juan 28-jun)
const BAR_KEY = 'rebell-barh-v1'
export const BAR_MIN = 8
export const BAR_MAX = 34
export const BAR_DEFAULT = 20

// INTENSIDAD de color del panel (Juan 30-jun): satura los colores del área de contenido. 1 = normal.
const INTENSITY_KEY = 'rebell-intensity-v1'
export const INTENSITY_MIN = 1
export const INTENSITY_MAX = 1.6
export const INTENSITY_DEFAULT = 1

// TAMAÑO de la interfaz (Juan 28-jun): zoom del ÁREA DE CONTENIDO para que cada usuario ajuste a su pantalla
// hasta que le quede "a medida". Usa `zoom` (no transform) → REFLUYE, así que sigue siendo responsive.
// 1 = tamaño base; <1 encoge (cabe más de un golpe), >1 agranda. El menú lateral no se toca (es el "marco").
const SCALE_KEY = 'rebell-uiscale-v1'
export const SCALE_MIN = 0.8
export const SCALE_MAX = 1.2
export const SCALE_DEFAULT = 1

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

export const loadRadius = () => read(RADIUS_KEY, RADIUS_DEFAULTS)
export const saveRadius = (v: Record<string, number>) => write(RADIUS_KEY, v)
export function applyRadius(v: Record<string, number>) {
  const app = appEl()
  if (!app) return
  for (const t of RADIUS_TOKENS) if (v[t.key] != null) app.style.setProperty(t.varName, v[t.key] + 'px')
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

export function loadTrack(): number {
  try {
    const r = parseFloat(localStorage.getItem(TRACK_KEY) || '')
    if (r >= TRACK_MIN && r <= TRACK_MAX) return r
  } catch { /* sin localStorage */ }
  return TRACK_DEFAULT
}
export function saveTrack(v: number) {
  try { localStorage.setItem(TRACK_KEY, String(v)) } catch { /* */ }
}
export function applyTrack(v: number) {
  const app = appEl()
  if (app) app.style.setProperty('--num-spacing', v + 'px')
}

const readNum = (k: string, min: number, max: number, def: number): number => {
  try { const r = parseFloat(localStorage.getItem(k) || ''); if (r >= min && r <= max) return r } catch { /* */ }
  return def
}
export const loadNumW = () => readNum(NUMW_KEY, NUMW_MIN, NUMW_MAX, NUMW_DEFAULT)
export const saveNumW = (v: number) => { try { localStorage.setItem(NUMW_KEY, String(v)) } catch { /* */ } }
export function applyNumW(v: number) { const app = appEl(); if (app) app.style.setProperty('--num-weight', String(v)) }
export const loadTitleW = () => readNum(TITLEW_KEY, TITLEW_MIN, TITLEW_MAX, TITLEW_DEFAULT)
export const saveTitleW = (v: number) => { try { localStorage.setItem(TITLEW_KEY, String(v)) } catch { /* */ } }
export function applyTitleW(v: number) { const app = appEl(); if (app) app.style.setProperty('--title-weight', String(v)) }
export const loadBar = () => readNum(BAR_KEY, BAR_MIN, BAR_MAX, BAR_DEFAULT)
export const saveBar = (v: number) => { try { localStorage.setItem(BAR_KEY, String(v)) } catch { /* */ } }
export function applyBar(v: number) { const app = appEl(); if (app) app.style.setProperty('--bar-h', v + 'px') }

// INTENSIDAD: satura SOLO el panel de contenido (.panel-main). La barra lateral y los overlays (scrim de
// mesa, modales) cuelgan de .app por PORTAL → no se ven afectados, así que filtrar .panel-main es seguro
// (no rompe el position:fixed de los overlays). Por DEFECTO 1 = SIN filtro → cero capa, cero coste/calor
// (regla de ahorro de energía de Juan); la capa de saturación solo se crea al subir el slider.
const panelEl = () => document.querySelector('.panel-main') as HTMLElement | null
export const loadIntensity = () => readNum(INTENSITY_KEY, INTENSITY_MIN, INTENSITY_MAX, INTENSITY_DEFAULT)
export const saveIntensity = (v: number) => { try { localStorage.setItem(INTENSITY_KEY, String(v)) } catch { /* */ } }
export function applyIntensity(v: number) { const el = panelEl(); if (el) el.style.filter = v <= 1.001 ? '' : `saturate(${v})` }

// TAMAÑO: fija --ui-scale en .app; el CSS hace `zoom: var(--ui-scale)` sobre .panel-content (y compensa el
// alto en las vistas a pantalla completa para que no quede hueco). 1 = sin tocar (cero coste).
export const loadScale = () => readNum(SCALE_KEY, SCALE_MIN, SCALE_MAX, SCALE_DEFAULT)
export const saveScale = (v: number) => { try { localStorage.setItem(SCALE_KEY, String(v)) } catch { /* */ } }
export function applyScale(v: number) { const app = appEl(); if (app) app.style.setProperty('--ui-scale', String(v)) }
// Cambia el tamaño desde CUALQUIER control (Canon o el mando flotante) y AVISA al resto para que se
// sincronicen (los dos sliders muestran el mismo %). Aplica + guarda + emite evento.
export function setUiScale(v: number) {
  const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, v))
  applyScale(clamped)
  saveScale(clamped)
  try { window.dispatchEvent(new CustomEvent('rebell:uiscale', { detail: clamped })) } catch { /* */ }
}
// "AJUSTAR A PANTALLA": calcula el % al que TODO el contenido de la vista actual cabe en el alto de la
// pantalla, sin scroll (lo que aquí tenemos validado que se ve perfecto). Mide en bruto (--ui-scale=1),
// divide alto-disponible / alto-que-pide, y lo deja redondeado y dentro de los topes.
export function autoFitScale(): number {
  const app = appEl()
  const content = document.querySelector('.panel-content') as HTMLElement | null
  if (!app || !content) return loadScale()
  const prev = getComputedStyle(app).getPropertyValue('--ui-scale').trim() || '1'
  app.style.setProperty('--ui-scale', '1') // medir en bruto
  // Mide el contenido REAL de la vista. En Caja (inmersiva) es .ck-content; en el resto, el propio
  // panel-content. (Así evitamos el alto fantasma del .wrap, que falseaba la medida.)
  const target = (content.querySelector('.ck-content') as HTMLElement | null) || content
  const required = target.scrollHeight // alto natural del contenido a escala 1
  const avail = window.innerHeight
  app.style.setProperty('--ui-scale', prev) // restaurar (el llamante aplica el valor final)
  if (!required || !avail) return loadScale()
  let s = (avail - 6) / required // -6px de respiro para que no roce el borde
  s = Math.max(SCALE_MIN, Math.min(SCALE_MAX, s))
  return Math.round(s * 100) / 100
}

// Al arrancar la app: re-aplica lo guardado para que el diseño persista entre recargas.
export function applySavedDesign() {
  applyType(loadType())
  applyBtn(loadBtn())
  applyRadius(loadRadius())
  applyWide(loadWide())
  applyTrack(loadTrack())
  applyNumW(loadNumW())
  applyTitleW(loadTitleW())
  applyBar(loadBar())
  applyIntensity(loadIntensity())
  applyScale(loadScale())
}
