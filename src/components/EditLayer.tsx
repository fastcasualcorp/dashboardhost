import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { play } from '../lib/sound'
import { zoneById } from '../lib/dsRegistry'

/* ════════════════════════════════════════════════════════════════
   MODO DISEÑO v3 — editor UNIVERSAL (toca CUALQUIER cosa y edítala)
   · Activas con el botón ⠿ (abajo-dcha) o la tecla D.
   · Pasas el ratón → se ilumina el elemento bajo el cursor; clicas → se
     selecciona y sale un panel con SUS props reales (texto/tamaño/espaciado/
     aspecto), tiradores para redimensionar, agarre para mover y migas para
     subir al elemento padre.
   · No depende de registrar zonas a mano: para CUALQUIER elemento se calcula
     un SELECTOR estable y el override cuelga de una hoja <style> inyectada →
     sobrevive al re-render de React y a la recarga (localStorage).  "Fijar"
     exporta el diff CSS limpio (sin !important) que el dev cocina en index.css.
   ════════════════════════════════════════════════════════════════ */

type Rules = Record<string, Record<string, string>> // selector → { prop: value }
type Labels = Record<string, { label: string; sec: string }>
const STORE = 'rebell-ds-v3'
const num = (v: string) => {
  const m = (v || '').match(/-?[\d.]+/)
  return m ? parseFloat(m[0]) : 0
}

/* ── catálogo universal de propiedades editables ── */
type Ctl = 'range' | 'color' | 'seg'
type PMeta = { g: string; label: string; ctl?: Ctl; min?: number; max?: number; step?: number; unit?: string; read?: string; opts?: string[] }
const P: Record<string, PMeta> = {
  'font-size': { g: 'Texto', label: 'Tamaño', min: 8, max: 140, step: 1, unit: 'px' },
  'font-weight': { g: 'Texto', label: 'Grosor', min: 100, max: 900, step: 100, unit: '' },
  'letter-spacing': { g: 'Texto', label: 'Interletra', min: -4, max: 12, step: 0.5, unit: 'px' },
  'line-height': { g: 'Texto', label: 'Interlínea', min: 0.8, max: 2.4, step: 0.05, unit: '' },
  'text-align': { g: 'Texto', label: 'Alinear', ctl: 'seg', opts: ['left', 'center', 'right'] },
  'color': { g: 'Texto', label: 'Color texto', ctl: 'color' },
  'width': { g: 'Tamaño', label: 'Ancho', min: 20, max: 1280, step: 2, unit: 'px' },
  'height': { g: 'Tamaño', label: 'Alto', min: 20, max: 1280, step: 2, unit: 'px' },
  'padding': { g: 'Espaciado', label: 'Relleno', min: 0, max: 80, step: 1, unit: 'px', read: 'padding-top' },
  'gap': { g: 'Espaciado', label: 'Separación', min: 0, max: 80, step: 1, unit: 'px' },
  'border-radius': { g: 'Aspecto', label: 'Esquinas', min: 0, max: 80, step: 1, unit: 'px', read: 'border-top-left-radius' },
  'border-width': { g: 'Aspecto', label: 'Borde', min: 0, max: 14, step: 1, unit: 'px', read: 'border-top-width' },
  'border-color': { g: 'Aspecto', label: 'Color borde', ctl: 'color' },
  'background-color': { g: 'Aspecto', label: 'Fondo', ctl: 'color' },
  'opacity': { g: 'Aspecto', label: 'Opacidad', min: 0, max: 1, step: 0.05, unit: '' },
}
const GROUPS = ['Texto', 'Tamaño', 'Espaciado', 'Aspecto']
const COLORS = [
  { name: 'Oro', value: '#ffbf10' },
  { name: 'Tinta', value: '#f5f5f7' },
  { name: 'Apagado', value: 'rgba(255,255,255,.55)' },
  { name: 'Panel', value: '#0e0e11' },
  { name: 'Verde', value: '#34d399' },
  { name: 'Ámbar', value: '#f5a524' },
  { name: 'Azul', value: '#4aa3ff' },
  { name: 'Rojo', value: '#ff5d5d' },
]

/* ── utilidades de selección/etiquetado de cualquier nodo ── */
const STATE_CLS = new Set(['on', 'open', 'active', 'focus', 'focused', 'sel', 'hover', 'show', 'shown', 'visible', 'dragging', 'loading', 'disabled', 'pulse', 'dim', 'focus-mode'])
const DECOR_CLS = new Set(['app', 'bg-aura', 'grain', 'el-layer'])
const SKIP_CLS = /^el-/
const esc = (s: string) => {
  try {
    return CSS.escape(s)
  } catch {
    return s
  }
}
const cn = (el: Element) => (typeof el.className === 'string' ? el.className : (el.getAttribute('class') || ''))
const isDecor = (el: HTMLElement) => el.tagName === 'HTML' || el.tagName === 'BODY' || Array.from(el.classList).some((c) => DECOR_CLS.has(c))

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

function selectorFor(el: HTMLElement): string {
  const ds = el.getAttribute('data-ds')
  if (ds && zoneById(ds)) return zoneById(ds)!.selector // zonas curadas → selector bonito
  if (el.id) return '#' + esc(el.id)
  const ch = classChain(el)
  if (ch) return ch
  return structuralPath(el)
}

function hasText(el: HTMLElement): boolean {
  return Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0)
}

function describe(el: HTMLElement): { label: string; sec: string } {
  const ds = el.getAttribute('data-ds')
  const z = ds ? zoneById(ds) : undefined
  if (z) return { label: z.label, sec: z.seccion }
  const tag = el.tagName
  const klass = cn(el)
  let label = tag.toLowerCase()
  if (tag === 'BUTTON' || el.getAttribute('role') === 'button') label = 'Botón'
  else if (tag === 'A') label = 'Enlace'
  else if (tag === 'IMG' || tag === 'svg' || tag === 'SVG') label = 'Imagen'
  else if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') label = 'Control'
  else if (/^H[1-6]$/.test(tag)) label = 'Título'
  else if (hasText(el)) {
    const fs = parseFloat(getComputedStyle(el).fontSize) || 0
    label = fs >= 22 ? 'Título' : 'Texto'
  } else if (/card|panel|tile|cromo|hero/i.test(klass)) label = 'Tarjeta'
  else if (/list|grid|row|col|stack|wrap|group|nav/i.test(klass)) label = 'Contenedor'
  const firstCls = klass.trim().split(/\s+/).filter((c) => c && !SKIP_CLS.test(c))[0] || ''
  return { label, sec: (firstCls ? '.' + firstCls : tag.toLowerCase()).slice(0, 22) }
}

function propsFor(el: HTMLElement): string[] {
  const cs = getComputedStyle(el)
  const out: string[] = []
  if (hasText(el)) out.push('font-size', 'font-weight', 'letter-spacing', 'line-height', 'text-align', 'color')
  out.push('width', 'height', 'padding')
  if (cs.display.includes('flex') || cs.display.includes('grid')) out.push('gap')
  out.push('border-radius', 'border-width', 'border-color', 'background-color', 'opacity')
  return out
}

const liveNode = (sel: string): HTMLElement | null => {
  try {
    return document.querySelector(sel) as HTMLElement | null
  } catch {
    return null
  }
}

function load(): { r: Rules; l: Labels } {
  try {
    const raw = localStorage.getItem(STORE)
    if (raw) {
      const o = JSON.parse(raw)
      return { r: o.r || {}, l: o.l || {} }
    }
  } catch {
    /* sin localStorage */
  }
  return { r: {}, l: {} }
}

function buildSheet(rules: Rules, labels: Labels, bang: boolean): string {
  const imp = bang ? ' !important' : ''
  const out: string[] = []
  for (const sel of Object.keys(rules)) {
    const props = rules[sel]
    const entries = Object.entries(props).filter(([, v]) => v != null && v !== '')
    if (!entries.length) continue
    const body = entries.map(([p, v]) => `  ${p}: ${v}${imp};`)
    // si suben el borde y no había estilo de borde, ponerlo sólido para que se vea
    if (entries.some(([p, v]) => p === 'border-width' && num(v) > 0) && !props['border-style']) {
      body.push(`  border-style: solid${imp};`)
    }
    const lab = labels[sel]
    const head = lab ? `/* ${lab.sec} · ${lab.label} */\n` : ''
    out.push(`${head}${sel} {\n${body.join('\n')}\n}`)
  }
  return out.join('\n\n')
}

export default function EditLayer() {
  const [on, setOn] = useState(false)
  const init = load()
  const [rules, setRules] = useState<Rules>(init.r)
  const [labels, setLabels] = useState<Labels>(init.l)
  const [hover, setHover] = useState<{ label: string; r: DOMRect } | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [selInfo, setSelInfo] = useState<{ label: string; sec: string } | null>(null)
  const [selRect, setSelRect] = useState<DOMRect | null>(null)
  const [crumbs, setCrumbs] = useState<{ sel: string; label: string }[]>([])
  const [copied, setCopied] = useState(false)
  const draggingRef = useRef(false)
  const selNodeRef = useRef<HTMLElement | null>(null) // nodo realmente clicado (el halo se queda aquí)

  // Hoja viva (con !important para ganar siempre la cascada en preview) + persistencia.
  useEffect(() => {
    let el = document.getElementById('rebell-ds-live') as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = 'rebell-ds-live'
      document.head.appendChild(el)
    }
    el.textContent = buildSheet(rules, labels, true)
    try {
      localStorage.setItem(STORE, JSON.stringify({ r: rules, l: labels }))
    } catch {
      /* sin localStorage */
    }
  }, [rules, labels])

  // Tecla D activa/desactiva; Esc deselecciona (no mientras se escribe en un input).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      if (e.key === 'd' || e.key === 'D') {
        setOn((o) => !o)
        play('tap')
      }
      if (e.key === 'Escape') setSel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function selectEl(el: HTMLElement) {
    const s = selectorFor(el)
    const d = describe(el)
    selNodeRef.current = el
    setSel(s)
    setSelInfo(d)
    setSelRect(el.getBoundingClientRect())
    setLabels((l) => ({ ...l, [s]: d }))
    // migas: ancestros editables (para subir al contenedor)
    const cr: { sel: string; label: string }[] = []
    let cur = el.parentElement
    while (cur && cur.tagName !== 'BODY' && cr.length < 3) {
      if (!isDecor(cur) && !SKIP_CLS.test(cn(cur))) cr.unshift({ sel: selectorFor(cur), label: describe(cur).label })
      cur = cur.parentElement
    }
    setCrumbs(cr)
    play('tap', 0.5, 1.12)
  }

  // Detección de elemento bajo el cursor + selección al clicar.
  useEffect(() => {
    if (!on) {
      setHover(null)
      return
    }
    const insideUI = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.('.el-ui, .el-fab')
    const pickAt = (x: number, y: number): HTMLElement | null => {
      let el = document.elementFromPoint(x, y) as HTMLElement | null
      if (!el || el.closest('.el-ui, .el-fab, .el-layer')) return null
      while (el && isDecor(el)) el = el.parentElement
      return el && el.tagName !== 'BODY' && el.tagName !== 'HTML' ? el : null
    }
    const onMove = (e: PointerEvent) => {
      if (draggingRef.current) return
      if (insideUI(e.target)) return
      const el = pickAt(e.clientX, e.clientY)
      if (el && selectorFor(el) !== sel) setHover({ label: describe(el).label, r: el.getBoundingClientRect() })
      else setHover(null)
    }
    const onClick = (e: MouseEvent) => {
      if (insideUI(e.target)) return
      const el = pickAt(e.clientX, e.clientY)
      if (el) {
        e.preventDefault()
        e.stopPropagation() // bloquea el onClick de la app (navegar, cobrar, etc.)
        setHover(null)
        selectEl(el)
      } else setSel(null)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('click', onClick, { capture: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('click', onClick, { capture: true } as EventListenerOptions)
    }
  }, [on, sel])

  // Mantener el halo de selección pegado al elemento (scroll / resize / re-render).
  useEffect(() => {
    if (!on || !sel) return
    let raf = 0
    const tick = () => {
      // el halo se queda en el nodo que clicaste; si se desmonta, cae al primer match del molde
      const el = selNodeRef.current?.isConnected ? selNodeRef.current : liveNode(sel)
      if (el) setSelRect(el.getBoundingClientRect())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on, sel])

  function setRule(s: string, prop: string, value: string) {
    setRules((r) => ({ ...r, [s]: { ...r[s], [prop]: value } }))
  }
  function resetZone(s: string) {
    setRules((r) => {
      const n = { ...r }
      delete n[s]
      return n
    })
    play('tap', 0.4, 0.92)
  }
  function resetAll() {
    setRules({})
    setLabels({})
    try {
      localStorage.removeItem(STORE)
    } catch {
      /* sin localStorage */
    }
    play('toggle')
  }

  // Valor actual de una prop: override si existe, si no el computado del nodo vivo.
  function readRaw(prop: string): string {
    if (!sel) return ''
    const ov = rules[sel]?.[prop]
    if (ov != null) return ov
    const node = selNodeRef.current?.isConnected ? selNodeRef.current : liveNode(sel)
    if (!node) return ''
    const cs = getComputedStyle(node)
    // line-height se computa en px → lo paso a proporción (lo que entiende el slider)
    if (prop === 'line-height') {
      if (cs.lineHeight === 'normal') return '1.2'
      const lh = parseFloat(cs.lineHeight)
      const fs = parseFloat(cs.fontSize) || 1
      return String(+(lh / fs).toFixed(2))
    }
    return cs.getPropertyValue(P[prop]?.read || prop).trim()
  }

  // Tiradores de tamaño (e / s / se). Snap 2px. Commit en vivo a la hoja.
  function startResize(e: RPointerEvent, dir: 'e' | 's' | 'se') {
    e.preventDefault()
    e.stopPropagation()
    const node = selNodeRef.current?.isConnected ? selNodeRef.current : liveNode(sel!)
    if (!node || !sel) return
    const r = node.getBoundingClientRect()
    const sx = e.clientX
    const sy = e.clientY
    draggingRef.current = true
    const snap = (n: number) => Math.max(20, Math.round(n / 2) * 2)
    const move = (ev: PointerEvent) => {
      if (dir.includes('e')) setRule(sel, 'width', snap(r.width + (ev.clientX - sx)) + 'px')
      if (dir.includes('s')) setRule(sel, 'height', snap(r.height + (ev.clientY - sy)) + 'px')
    }
    const up = () => {
      draggingRef.current = false
      play('tap', 0.45, 1.1)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Mover (nudge por margen → no pelea con los transform de las animaciones).
  function startMove(e: RPointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const node = selNodeRef.current?.isConnected ? selNodeRef.current : liveNode(sel!)
    if (!node || !sel) return
    const cs = getComputedStyle(node)
    const ml0 = parseFloat(rules[sel]?.['margin-left'] ?? cs.marginLeft) || 0
    const mt0 = parseFloat(rules[sel]?.['margin-top'] ?? cs.marginTop) || 0
    const sx = e.clientX
    const sy = e.clientY
    draggingRef.current = true
    const snap = (n: number) => Math.round(n / 2) * 2
    const move = (ev: PointerEvent) => {
      setRule(sel, 'margin-left', snap(ml0 + (ev.clientX - sx)) + 'px')
      setRule(sel, 'margin-top', snap(mt0 + (ev.clientY - sy)) + 'px')
    }
    const up = () => {
      draggingRef.current = false
      play('tap', 0.45, 1.05)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function fijar() {
    const css = buildSheet(rules, labels, false)
    if (!css) return
    try {
      navigator.clipboard?.writeText(css)
    } catch {
      /* clipboard bloqueado */
    }
    setCopied(true)
    play('success')
    window.setTimeout(() => setCopied(false), 2200)
  }

  const touched = Object.keys(rules).filter((k) => Object.keys(rules[k] || {}).length).length
  const elProps = sel ? propsFor((selNodeRef.current?.isConnected ? selNodeRef.current : liveNode(sel)) || document.createElement('div')) : []
  const matchCount = sel ? (() => { try { return document.querySelectorAll(sel).length } catch { return 0 } })() : 0

  // Posición del panel (origin-aware): al lado del elemento, dentro del viewport.
  const panelStyle: CSSProperties = (() => {
    if (!selRect) return {}
    const W = 268
    let left = selRect.right + 14
    if (left + W > window.innerWidth - 8) left = Math.max(8, selRect.left - W - 14)
    const top = Math.min(Math.max(12, selRect.top), window.innerHeight - 420)
    return { left, top, width: W }
  })()

  const haloStyle = (r: DOMRect): CSSProperties => ({ left: r.left, top: r.top, width: r.width, height: r.height })

  return (
    <>
      <button
        className={'el-fab' + (on ? ' on' : '')}
        onClick={() => {
          setOn((o) => !o)
          play('tap')
        }}
        aria-label="Modo diseño"
        title="Modo diseño (tecla D)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 4 7v10l8 5 8-5V7l-8-5Z" />
          <path d="M12 22V12M4 7l8 5 8-5" />
        </svg>
        {touched > 0 && <span className="el-badge">{touched}</span>}
      </button>

      {on && (
        <div className="el-layer">
          {/* halo de HOVER */}
          {hover && !draggingRef.current && (
            <div className="el-halo hover" style={haloStyle(hover.r)}>
              <span className="el-tag">{hover.label}</span>
            </div>
          )}

          {/* halo + agarres de la SELECCIÓN */}
          {sel && selInfo && selRect && (
            <div className="el-halo sel" style={haloStyle(selRect)}>
              <span className="el-tag on grab" onPointerDown={startMove} title="Arrastra para mover">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
                </svg>
                {selInfo.label}
              </span>
              <span className="el-handle e el-ui" onPointerDown={(e) => startResize(e, 'e')} />
              <span className="el-handle s el-ui" onPointerDown={(e) => startResize(e, 's')} />
              <span className="el-handle se el-ui" onPointerDown={(e) => startResize(e, 'se')} />
            </div>
          )}

          {/* panel contextual */}
          <AnimatePresence>
            {sel && selInfo && selRect && (
              <motion.div
                className="el-panel el-ui"
                style={panelStyle}
                initial={{ opacity: 0, scale: 0.96, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 460, damping: 32 }}
              >
                {crumbs.length > 0 && (
                  <div className="el-crumbs">
                    {crumbs.map((c) => (
                      <button
                        key={c.sel}
                        className="el-crumb"
                        onClick={() => {
                          const node = liveNode(c.sel)
                          if (node) selectEl(node)
                        }}
                      >
                        {c.label}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}

                <div className="el-phead">
                  <b>{selInfo.label}</b>
                  <span className="el-psec">{selInfo.sec}</span>
                  <button className="el-x" onClick={() => setSel(null)} aria-label="Cerrar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
                <div className="el-mold">{matchCount > 1 ? `Cambia las ${matchCount} a la vez (mismo molde)` : 'Edita este elemento'}</div>

                <div className="el-scroll">
                  {GROUPS.map((g) => {
                    const props = elProps.filter((p) => P[p]?.g === g)
                    if (!props.length) return null
                    return (
                      <div className="el-group" key={g}>
                        <div className="el-gtitle">{g}</div>
                        {props.map((prop) => {
                          const meta = P[prop]
                          if (meta.ctl === 'color') {
                            const cur = readRaw(prop)
                            return (
                              <div className="el-row" key={prop}>
                                <span className="el-rlab">{meta.label}</span>
                                <div className="el-swatches">
                                  {COLORS.map((c) => (
                                    <button key={c.value} className={'el-sw' + (cur === c.value ? ' on' : '')} style={{ background: c.value }} title={c.name} onClick={() => setRule(sel, prop, c.value)} />
                                  ))}
                                  <label className="el-sw custom" title="Color libre">
                                    <input type="color" onChange={(e) => setRule(sel, prop, e.target.value)} />
                                  </label>
                                </div>
                              </div>
                            )
                          }
                          if (meta.ctl === 'seg') {
                            const raw = readRaw(prop)
                            const cur = raw === 'center' ? 'center' : raw === 'right' || raw === 'end' ? 'right' : 'left'
                            return (
                              <div className="el-row" key={prop}>
                                <span className="el-rlab">{meta.label}</span>
                                <div className="el-seg">
                                  {meta.opts!.map((o) => (
                                    <button key={o} className={cur === o ? 'on' : ''} onClick={() => setRule(sel, prop, o)}>
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                        {o === 'left' && <path d="M3 6h18M3 12h12M3 18h16" />}
                                        {o === 'center' && <path d="M3 6h18M6 12h12M4 18h16" />}
                                        {o === 'right' && <path d="M3 6h18M9 12h12M5 18h16" />}
                                      </svg>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )
                          }
                          const cur = num(readRaw(prop))
                          const pct = meta.min != null && meta.max != null ? ((cur - meta.min) / (meta.max - meta.min)) * 100 : 0
                          return (
                            <div className="el-row" key={prop}>
                              <div className="el-rtop">
                                <span className="el-rlab">{meta.label}</span>
                                <span className="el-rval">
                                  {meta.step && meta.step < 1 ? cur.toFixed(2) : Math.round(cur)}
                                  {meta.unit}
                                </span>
                              </div>
                              <input
                                type="range"
                                min={meta.min}
                                max={meta.max}
                                step={meta.step}
                                value={cur}
                                onChange={(e) => setRule(sel, prop, e.target.value + (meta.unit || ''))}
                                style={{ ['--p' as string]: pct + '%' }}
                              />
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>

                <div className="el-pfoot">
                  <button className="el-reset" onClick={() => resetZone(sel)} disabled={!rules[sel]}>
                    Restablecer
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* barra inferior */}
          <div className="el-bar el-ui">
            <span className="el-bar-hint">{sel ? 'Arrastra para mover · tiradores para redimensionar · panel para ajustar' : 'Pasa el ratón y haz clic en cualquier elemento'}</span>
            <button className="el-bar-reset" onClick={resetAll} disabled={!touched}>
              Restablecer todo
            </button>
            <button className="el-bar-fix" onClick={fijar} disabled={!touched}>
              {copied ? '✓ Copiado — pásamelo' : touched ? `Fijar ${touched}` : 'Fijar'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
