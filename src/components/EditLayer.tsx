import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { play } from '../lib/sound'
import { ZONES, zoneById, PROP_META, COLOR_TOKENS, type PropKey, type Zone } from '../lib/dsRegistry'

/* ════════════════════════════════════════════════════════════════
   MODO DISEÑO v2 — "Zonas REBELL" (toca cualquier zona y edítala)
   · Activas con el botón ⠿ (abajo-dcha) o la tecla D.
   · Pasas el ratón → se resalta la zona; clicas → se selecciona.
   · Panel contextual con SOLO lo que esa zona tiene + tiradores de tamaño.
   · Los cambios cuelgan del SELECTOR de clase (no del nodo) en una hoja
     <style> inyectada → sobreviven al re-render de React.  "Fijar" exporta
     un diff CSS por selector que el dev cocina en index.css.
   ════════════════════════════════════════════════════════════════ */

type Rules = Record<string, Partial<Record<PropKey, string>>>
const STORE = 'rebell-ds-v2'
const num = (v: string) => parseFloat(v) || 0

function loadRules(): Rules {
  try {
    const raw = localStorage.getItem(STORE)
    if (raw) return JSON.parse(raw)
  } catch {
    /* sin localStorage */
  }
  return {}
}

function serialize(rules: Rules): string {
  const out: string[] = []
  for (const z of ZONES) {
    const props = rules[z.id]
    if (!props) continue
    const body = Object.entries(props)
      .filter(([, v]) => v != null && v !== '')
      .map(([p, v]) => `  ${p}: ${v};`)
      .join('\n')
    if (body) out.push(`/* ${z.seccion} · ${z.label} */\n${z.selector} {\n${body}\n}`)
  }
  return out.join('\n\n')
}

export default function EditLayer() {
  const [on, setOn] = useState(false)
  const [rules, setRules] = useState<Rules>(loadRules)
  const [hover, setHover] = useState<{ id: string; r: DOMRect } | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [selRect, setSelRect] = useState<DOMRect | null>(null)
  const [copied, setCopied] = useState(false)
  const draggingRef = useRef(false)

  // Hoja viva por SELECTOR + persistencia. Cuelga de la clase → sobrevive al re-render.
  useEffect(() => {
    let el = document.getElementById('rebell-ds-live') as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = 'rebell-ds-live'
      document.head.appendChild(el)
    }
    el.textContent = serialize(rules)
    try {
      localStorage.setItem(STORE, JSON.stringify(rules))
    } catch {
      /* sin localStorage */
    }
  }, [rules])

  // Tecla D activa/desactiva (no mientras se escribe en un input).
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

  // Detección de zona bajo el cursor + selección al clicar (sin tocar el árbol React).
  useEffect(() => {
    if (!on) {
      setHover(null)
      return
    }
    const insideUI = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.('.el-ui')
    const onMove = (e: PointerEvent) => {
      if (draggingRef.current) return
      if (insideUI(e.target)) {
        setHover(null)
        return
      }
      const node = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('[data-ds]') as HTMLElement | null
      const id = node?.getAttribute('data-ds')
      if (node && id && zoneById(id)) setHover({ id, r: node.getBoundingClientRect() })
      else setHover(null)
    }
    const onClick = (e: MouseEvent) => {
      if (insideUI(e.target)) return // clic en el panel/tiradores: no cambia selección
      const node = (e.target as HTMLElement | null)?.closest?.('[data-ds]') as HTMLElement | null
      const id = node?.getAttribute('data-ds')
      if (node && id && zoneById(id)) {
        e.preventDefault()
        e.stopPropagation() // bloquea el onClick de la app (navegar, etc.)
        setSel(id)
        setSelRect(node.getBoundingClientRect())
        play('tap', 0.5, 1.12)
      } else setSel(null)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('click', onClick, { capture: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('click', onClick, { capture: true } as EventListenerOptions)
    }
  }, [on])

  // Mantener el halo de selección pegado al elemento (scroll / resize / re-render).
  useEffect(() => {
    if (!on || !sel) return
    let raf = 0
    const tick = () => {
      const el = document.querySelector(`[data-ds="${sel}"]`)
      if (el) setSelRect(el.getBoundingClientRect())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on, sel])

  function setRule(id: string, prop: PropKey, value: string) {
    setRules((r) => ({ ...r, [id]: { ...r[id], [prop]: value } }))
  }
  function resetZone(id: string) {
    setRules((r) => {
      const n = { ...r }
      delete n[id]
      return n
    })
    play('tap', 0.4, 0.92)
  }
  function resetAll() {
    setRules({})
    try {
      localStorage.removeItem(STORE)
    } catch {
      /* sin localStorage */
    }
    play('toggle')
  }

  // Valor actual de una prop: override si existe, si no el computado real.
  function readProp(z: Zone, prop: PropKey): string {
    const ov = rules[z.id]?.[prop]
    if (ov != null) return ov
    const first = document.querySelector(z.selector.split(',')[0].trim())
    if (!first) return ''
    return getComputedStyle(first).getPropertyValue(prop).trim()
  }

  // Tiradores de tamaño (e / s / se). Snap a 4px. Commit en vivo a la hoja.
  function startResize(e: RPointerEvent, dir: 'e' | 's' | 'se') {
    e.preventDefault()
    e.stopPropagation()
    const node = document.querySelector(`[data-ds="${sel}"]`) as HTMLElement | null
    if (!node || !sel) return
    const r = node.getBoundingClientRect()
    const sx = e.clientX
    const sy = e.clientY
    draggingRef.current = true
    const snap = (n: number) => Math.max(40, Math.round(n / 4) * 4)
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

  function fijar() {
    const css = serialize(rules)
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

  const z = zoneById(sel)
  const touched = Object.keys(rules).filter((k) => Object.keys(rules[k] || {}).length).length

  // Posición del panel (origin-aware): al lado del elemento, dentro del viewport.
  const panelStyle: CSSProperties = (() => {
    if (!selRect) return {}
    const W = 264
    let left = selRect.right + 14
    if (left + W > window.innerWidth - 8) left = Math.max(8, selRect.left - W - 14)
    const top = Math.min(Math.max(12, selRect.top), window.innerHeight - 360)
    return { left, top, width: W }
  })()

  const haloStyle = (r: DOMRect): CSSProperties => ({ left: r.left, top: r.top, width: r.width, height: r.height })

  return (
    <>
      <button className={'el-fab' + (on ? ' on' : '')} onClick={() => { setOn((o) => !o); play('tap') }} aria-label="Modo diseño" title="Modo diseño (tecla D)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 4 7v10l8 5 8-5V7l-8-5Z" /><path d="M12 22V12M4 7l8 5 8-5" />
        </svg>
        {touched > 0 && <span className="el-badge">{touched}</span>}
      </button>

      {on && (
        <div className="el-layer">
          {/* halo de HOVER */}
          {hover && hover.id !== sel && (
            <div className="el-halo hover el-ui-skip" style={haloStyle(hover.r)}>
              <span className="el-tag">{zoneById(hover.id)?.label}</span>
            </div>
          )}

          {/* halo + tiradores de la SELECCIÓN */}
          {z && selRect && (
            <div className="el-halo sel" style={haloStyle(selRect)}>
              <span className="el-tag on">{z.label}</span>
              {z.resize && (
                <>
                  <span className="el-handle e el-ui" onPointerDown={(e) => startResize(e, 'e')} />
                  <span className="el-handle s el-ui" onPointerDown={(e) => startResize(e, 's')} />
                  <span className="el-handle se el-ui" onPointerDown={(e) => startResize(e, 'se')} />
                </>
              )}
            </div>
          )}

          {/* panel contextual */}
          <AnimatePresence>
            {z && selRect && (
              <motion.div
                className="el-panel el-ui"
                style={panelStyle}
                initial={{ opacity: 0, scale: 0.96, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 460, damping: 32 }}
              >
                <div className="el-phead">
                  <b>{z.label}</b>
                  <span className="el-psec">{z.seccion}</span>
                  <button className="el-x" onClick={() => setSel(null)} aria-label="Cerrar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </div>
                <div className="el-mold">Edita el molde · cambia todas a la vez</div>

                {z.props.map((prop) => {
                  const meta = PROP_META[prop]
                  if (meta.type === 'color') {
                    const cur = readProp(z, prop)
                    return (
                      <div className="el-row" key={prop}>
                        <span className="el-rlab">{meta.label}</span>
                        <div className="el-swatches">
                          {COLOR_TOKENS.map((c) => (
                            <button key={c.value} className={'el-sw' + (cur === c.value ? ' on' : '')} style={{ background: c.value }} title={c.name} onClick={() => setRule(z.id, prop, c.value)} />
                          ))}
                          <label className="el-sw custom" title="Color libre">
                            <input type="color" onChange={(e) => setRule(z.id, prop, e.target.value)} />
                          </label>
                        </div>
                      </div>
                    )
                  }
                  const cur = num(readProp(z, prop))
                  const pct = meta.min != null && meta.max != null ? ((cur - meta.min) / (meta.max - meta.min)) * 100 : 0
                  return (
                    <div className="el-row" key={prop}>
                      <div className="el-rtop">
                        <span className="el-rlab">{meta.label}</span>
                        <span className="el-rval">{Math.round(cur)}{meta.unit}</span>
                      </div>
                      <input
                        type="range"
                        min={meta.min}
                        max={meta.max}
                        step={meta.step}
                        value={cur}
                        onChange={(e) => setRule(z.id, prop, e.target.value + (meta.unit || ''))}
                        style={{ ['--p' as string]: pct + '%' }}
                      />
                    </div>
                  )
                })}

                <div className="el-pfoot">
                  <button className="el-reset" onClick={() => resetZone(z.id)} disabled={!rules[z.id]}>Restablecer</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* barra inferior */}
          <div className="el-bar el-ui">
            <span className="el-bar-hint">{sel ? 'Arrastra los tiradores o usa el panel' : 'Pasa el ratón y haz clic en cualquier zona'}</span>
            <button className="el-bar-reset" onClick={resetAll} disabled={!touched}>Restablecer todo</button>
            <button className="el-bar-fix" onClick={fijar} disabled={!touched}>{copied ? '✓ Copiado — pásamelo' : touched ? `Fijar ${touched}` : 'Fijar'}</button>
          </div>
        </div>
      )}
    </>
  )
}
