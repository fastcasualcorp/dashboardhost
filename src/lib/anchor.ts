/* Anclaje a elementos — fuente ÚNICA de verdad.
   Calcula un selector CSS estable para CUALQUIER nodo del DOM y una etiqueta
   humana. Lo usan tanto el Modo Diseño (EditLayer) como el Modo Comentarios
   (CommentLayer): pinchas en algo → lo anclamos por selector + offset normalizado,
   de modo que sobrevive al re-render de React y a la recarga. */
export const STATE_CLS = new Set(['on', 'open', 'active', 'focus', 'focused', 'sel', 'hover', 'show', 'shown', 'visible', 'dragging', 'loading', 'disabled', 'pulse', 'dim', 'focus-mode', 'leaving'])
export const DECOR_CLS = new Set(['app', 'bg-aura', 'grain', 'el-layer', 'cm-layer'])
export const SKIP_CLS = /^el-|^cm-/

export const esc = (s: string) => {
  try {
    return CSS.escape(s)
  } catch {
    return s
  }
}
export const cn = (el: Element) => (typeof el.className === 'string' ? el.className : el.getAttribute('class') || '')
export const isDecor = (el: HTMLElement) => el.tagName === 'HTML' || el.tagName === 'BODY' || Array.from(el.classList).some((c) => DECOR_CLS.has(c))

function classChain(el: HTMLElement): string {
  const cls = Array.from(el.classList).filter((c) => c && !SKIP_CLS.test(c) && !STATE_CLS.has(c))
  return cls.length ? '.' + cls.map(esc).join('.') : ''
}

function structuralPath(el: HTMLElement): string {
  const parts: string[] = []
  let cur: HTMLElement | null = el
  while (cur && cur.tagName !== 'BODY' && parts.length < 8) {
    if (cur.id) {
      parts.unshift('#' + esc(cur.id))
      return parts.join(' > ')
    }
    const tag = cur.tagName.toLowerCase()
    const parent: HTMLElement | null = cur.parentElement
    if (!parent) {
      parts.unshift(tag)
      break
    }
    const node = cur
    const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName)
    const idx = same.indexOf(node) + 1
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${idx})` : tag)
    cur = parent
  }
  return parts.join(' > ')
}

export function selectorFor(el: HTMLElement): string {
  if (el.id) return '#' + esc(el.id)
  const ch = classChain(el)
  if (ch) return ch
  return structuralPath(el)
}

export function hasText(el: HTMLElement): boolean {
  return Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0)
}

export function describe(el: HTMLElement): { label: string; sec: string } {
  const tag = el.tagName
  const klass = cn(el)
  let label = tag.toLowerCase()
  if (tag === 'BUTTON' || el.getAttribute('role') === 'button') label = 'Botón'
  else if (tag === 'A') label = 'Enlace'
  else if (tag === 'IMG' || tag === 'svg' || tag === 'SVG') label = 'Imagen'
  else if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') label = 'Control'
  else if (/^H[1-6]$/.test(tag)) label = 'Título'
  else if (/odo|gauge|count|num\b/i.test(klass)) label = 'Número'
  else if (/kpi|stat|metric|dato/i.test(klass)) label = 'Dato'
  else if (hasText(el)) {
    const fs = parseFloat(getComputedStyle(el).fontSize) || 0
    label = fs >= 22 ? 'Título' : 'Texto'
  } else if (/card|panel|tile|cromo|hero/i.test(klass)) label = 'Tarjeta'
  else if (/list|grid|row|col|stack|wrap|group|nav/i.test(klass)) label = 'Contenedor'
  const firstCls = klass.trim().split(/\s+/).filter((c) => c && !SKIP_CLS.test(c))[0] || ''
  return { label, sec: (firstCls ? '.' + firstCls : tag.toLowerCase()).slice(0, 22) }
}

export const liveNode = (sel: string): HTMLElement | null => {
  try {
    return document.querySelector(sel) as HTMLElement | null
  } catch {
    return null
  }
}

/** Sube al bloque ESTABLE más cercano (con clase/id/data-ds propios) — evita
   anclar comentarios a spans volátiles (p.ej. dígitos de un número animado por
   GSAP) que el re-render destruye y dejan la nota huérfana. */
export function stableAnchor(el: HTMLElement): HTMLElement {
  let cur: HTMLElement | null = el
  for (let i = 0; i < 4 && cur && cur.tagName !== 'BODY'; i++) {
    const hasClass = Array.from(cur.classList).some((c) => !SKIP_CLS.test(c) && !STATE_CLS.has(c))
    if (cur.id || cur.getAttribute('data-ds') || hasClass) return cur
    cur = cur.parentElement
  }
  return el
}

/** Elemento "real" bajo unas coordenadas, saltando overlays propios y nodos decorativos. */
export function pickAt(x: number, y: number): HTMLElement | null {
  let el = document.elementFromPoint(x, y) as HTMLElement | null
  // ignorar nuestros overlays y los scrims/popovers (que aparecen/desaparecen)
  if (!el || el.closest('.el-ui, .el-fab, .el-layer, .cm-ui, .cm-fab, .cm-layer, .sp-scrim, .scrim, .settings-pop, .sp-pop')) return null
  while (el && isDecor(el)) el = el.parentElement
  return el && el.tagName !== 'BODY' && el.tagName !== 'HTML' ? el : null
}
