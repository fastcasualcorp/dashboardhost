import { useEffect, useRef, useState, type CSSProperties, type ClipboardEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { play } from '../lib/sound'
import { selectorFor, describe, pickAt, stableAnchor } from '../lib/anchor'

/* ════════════════════════════════════════════════════════════════
   MODO COMENTARIOS — Juan deja notas ancladas por toda la página y yo
   (Claude) las reviso luego y las clavo todas de una. Se activa desde el
   panel de perfil. Cada nota se ancla a un elemento (selector + instancia +
   offset normalizado) → sobrevive al re-render y a la recarga. Puede llevar
   una CAPTURA pegada (Cmd/Ctrl+V) como referencia. "Exportar" baja un JSON
   con todo (textos + capturas) que Claude lee y corrige con talcual.
   ════════════════════════════════════════════════════════════════ */

export type Cmt = {
  id: string
  sel: string
  idx: number // qué instancia del selector (si hay varias)
  nx: number
  ny: number
  text: string
  img?: string // dataURL jpeg comprimido
  section: string
  label: string
  done: boolean
  ts: number
}
const STORE = 'rebell-comments-v1'

function load(): Cmt[] {
  try {
    const raw = localStorage.getItem(STORE)
    if (raw) return JSON.parse(raw)
  } catch {
    /* sin localStorage */
  }
  return []
}

// id sin Date.now()/Math.random (van por contador + ts inyectado al exportar)
let _seq = 0
const newId = () => 'c' + (++_seq) + '_' + (load().length)

function nodeOf(c: Pick<Cmt, 'sel' | 'idx'>): HTMLElement | null {
  try {
    const nodes = document.querySelectorAll(c.sel)
    return (nodes[c.idx] || nodes[0] || null) as HTMLElement | null
  } catch {
    return null
  }
}

/** Reduce una imagen pegada a <=1280px y JPEG 0.82 para no reventar el localStorage. */
function compress(file: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const max = 1280
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      const ctx = c.getContext('2d')
      if (!ctx) return rej(new Error('no ctx'))
      ctx.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      res(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = rej
    img.src = url
  })
}

export default function CommentLayer({ on, setOn, active }: { on: boolean; setOn: (v: boolean) => void; active: string }) {
  const [list, setList] = useState<Cmt[]>(load)
  const [openId, setOpenId] = useState<string | null>(null)
  const [, forceTick] = useState(0)
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  // persistencia
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(list))
    } catch {
      /* quota / privado */
    }
  }, [list])

  // re-render por frame para reposicionar los pines pegados a sus elementos
  useEffect(() => {
    if (!on) return
    let raf = 0
    const tick = () => {
      forceTick((t) => (t + 1) % 1000000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on])

  // crear nota al clicar en cualquier sitio (que no sea UI propia)
  useEffect(() => {
    if (!on) {
      setOpenId(null)
      return
    }
    const insideUI = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.('.cm-ui, .cm-fab')
    const onClick = (e: MouseEvent) => {
      if (insideUI(e.target)) return
      const picked = pickAt(e.clientX, e.clientY)
      if (!picked) return
      e.preventDefault()
      e.stopPropagation()
      const el = stableAnchor(picked) // anclar al bloque estable, no a un span volátil
      const sel = selectorFor(el)
      let idx = 0
      try {
        idx = Array.from(document.querySelectorAll(sel)).indexOf(el)
      } catch {
        idx = 0
      }
      const r = el.getBoundingClientRect()
      const nx = r.width ? (e.clientX - r.left) / r.width : 0.5
      const ny = r.height ? (e.clientY - r.top) / r.height : 0.5
      const id = newId()
      const c: Cmt = { id, sel, idx: idx < 0 ? 0 : idx, nx, ny, text: '', img: undefined, section: active, label: describe(el).label, done: false, ts: 0 }
      setList((l) => [...l, c])
      setOpenId(id)
      play('tap', 0.5, 1.14)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openId) setOpenId(null)
        else setOn(false)
      }
    }
    window.addEventListener('click', onClick, { capture: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', onClick, { capture: true } as EventListenerOptions)
      window.removeEventListener('keydown', onKey)
    }
  }, [on, active, openId, setOn])

  // enfocar el textarea al abrir una nota
  useEffect(() => {
    if (openId) requestAnimationFrame(() => taRef.current?.focus())
  }, [openId])

  function update(id: string, patch: Partial<Cmt>) {
    setList((l) => l.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }
  function remove(id: string) {
    setList((l) => l.filter((c) => c.id !== id))
    if (openId === id) setOpenId(null)
    play('tap', 0.4, 0.9)
  }
  function clearAll() {
    setList([])
    setOpenId(null)
    try {
      localStorage.removeItem(STORE)
    } catch {
      /* */
    }
    play('toggle')
  }

  function onPasteImg(id: string, e: ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        const file = it.getAsFile()
        if (file) {
          compress(file).then((d) => update(id, { img: d })).catch(() => {})
          e.preventDefault()
          play('success', 0.4, 1.1)
          return
        }
      }
    }
  }
  function onPickFile(id: string, files: FileList | null) {
    const f = files?.[0]
    if (f && f.type.startsWith('image/')) compress(f).then((d) => update(id, { img: d })).catch(() => {})
  }

  function exportar() {
    // marca de tiempo legible sin Date.now(): la pone el navegador aquí, en runtime real
    const stamp = new Date().toISOString()
    const payload = {
      generatedAt: stamp,
      url: location.href,
      count: list.length,
      comments: list.map((c, i) => ({ n: i + 1, section: c.section, label: c.label, selector: c.sel, instance: c.idx, text: c.text, hasImage: !!c.img, image: c.img || null, done: c.done })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'rebell-comments.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    play('success')
  }

  const pending = list.filter((c) => !c.done).length
  const openCmt = list.find((c) => c.id === openId) || null

  // posición del popover (origin-aware) respecto a su pin
  const popStyle: CSSProperties = (() => {
    if (!openCmt) return {}
    const node = nodeOf(openCmt)
    if (!node) return { left: 80, top: 120, width: 300 }
    const r = node.getBoundingClientRect()
    const px = r.left + openCmt.nx * r.width
    const py = r.top + openCmt.ny * r.height
    const W = 300
    let left = px + 18
    if (left + W > window.innerWidth - 8) left = Math.max(8, px - W - 18)
    const top = Math.min(Math.max(12, py - 10), window.innerHeight - 320)
    return { left, top, width: W }
  })()

  return (
    <>
      {on && (
        <div className="cm-layer">
          {/* pines */}
          {list.map((c, i) => {
            const node = nodeOf(c)
            if (!node) return null
            const r = node.getBoundingClientRect()
            const x = r.left + c.nx * r.width
            const y = r.top + c.ny * r.height
            if (x < -40 || y < -40 || x > window.innerWidth + 40 || y > window.innerHeight + 40) return null
            return (
              <button
                key={c.id}
                className={'cm-pin cm-ui' + (c.done ? ' done' : '') + (openId === c.id ? ' open' : '')}
                style={{ left: x, top: y }}
                onClick={() => {
                  setOpenId(c.id)
                  play('tap', 0.45, 1.05)
                }}
                title={c.text || 'Sin texto aún'}
              >
                {c.done ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
                {c.img && <span className="cm-pin-clip" />}
              </button>
            )
          })}

          {/* popover de edición de una nota */}
          <AnimatePresence>
            {openCmt && (
              <motion.div
                className="cm-pop cm-ui"
                style={popStyle}
                initial={{ opacity: 0, scale: 0.96, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 460, damping: 32 }}
              >
                <div className="cm-pop-head">
                  <span className="cm-n">{list.findIndex((c) => c.id === openCmt.id) + 1}</span>
                  <div className="cm-pop-meta">
                    <b>{openCmt.label}</b>
                    <small>{openCmt.section}</small>
                  </div>
                  <button className="cm-icon" onClick={() => remove(openCmt.id)} title="Borrar nota">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                    </svg>
                  </button>
                  <button className="cm-icon" onClick={() => setOpenId(null)} title="Cerrar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>

                <textarea
                  ref={taRef}
                  className="cm-ta"
                  value={openCmt.text}
                  placeholder="Qué quieres que cambie aquí… (pega una captura con Cmd/Ctrl+V)"
                  onChange={(e) => update(openCmt.id, { text: e.target.value })}
                  onPaste={(e) => onPasteImg(openCmt.id, e)}
                />

                {openCmt.img ? (
                  <div className="cm-thumb">
                    <img src={openCmt.img} alt="referencia" />
                    <button className="cm-thumb-x" onClick={() => update(openCmt.id, { img: undefined })} title="Quitar captura">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <label className="cm-clip-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7-7l8.5-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.6 1.6 0 0 1-2.3-2.3l7.8-7.8" />
                    </svg>
                    Adjuntar captura de referencia
                    <input type="file" accept="image/*" onChange={(e) => onPickFile(openCmt.id, e.target.files)} />
                  </label>
                )}

                <button className={'cm-done-btn' + (openCmt.done ? ' on' : '')} onClick={() => update(openCmt.id, { done: !openCmt.done })}>
                  <span className="cm-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  {openCmt.done ? 'Resuelto' : 'Marcar como resuelto'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* barra inferior */}
          <div className="cm-bar cm-ui">
            <span className="cm-bar-hint">
              {list.length ? (
                <>
                  <b>{list.length}</b> nota{list.length === 1 ? '' : 's'} · {pending} pendiente{pending === 1 ? '' : 's'}
                </>
              ) : (
                'Haz clic en cualquier sitio para dejar una nota'
              )}
            </span>
            <button className="cm-bar-btn" onClick={clearAll} disabled={!list.length}>
              Vaciar
            </button>
            <button className="cm-bar-btn ghost" onClick={() => setOn(false)}>
              Salir
            </button>
            <button className="cm-bar-fix" onClick={exportar} disabled={!list.length}>
              Exportar para Claude
            </button>
          </div>
        </div>
      )}
    </>
  )
}
