import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SectionHeader, Badge } from '../components/ui'
import { play } from '../lib/sound'
import { type Mesa, type MesaForma, loadSalon, saveSalon, loadSalonDB, saveSalonDB, seatPositions, totalPlazas } from '../lib/salon'

/* Editor de Salón — diseñas tu sala arrastrando mesas, ajustando tamaño/forma y
   plazas. El plano alimenta el selector de mesa del TPV. Diseño REBELL (cromo +
   acentos), no el del panel del socio. Persistencia interina en localStorage;
   se conecta a Supabase (tabla `mesas` por local) con la auth real. */

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const FORMAS: { k: MesaForma; t: string }[] = [
  { k: 'cuadrada', t: 'Cuadrada' },
  { k: 'rect', t: 'Alargada' },
  { k: 'redonda', t: 'Redonda' },
]

// Primer hueco LIBRE en una rejilla alineada a las mesas existentes (no solapa con
// ninguna, con margen). Como el lienzo hace zoom-to-fit, si el plano crece todo se
// reescala para seguir cabiendo → nunca quedan mesas una encima de otra al añadir.
function freeSpot(list: Mesa[], w: number, h: number): { x: number; y: number } {
  const gap = 38
  if (!list.length) return { x: 70, y: 80 }
  const minX = Math.min(...list.map((m) => m.x))
  const minY = Math.min(...list.map((m) => m.y))
  const overlaps = (x: number, y: number) =>
    list.some((m) => x < m.x + m.w + gap && x + w + gap > m.x && y < m.y + m.h + gap && y + h + gap > m.y)
  const stepX = w + gap
  const stepY = h + gap
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      const x = Math.round(minX + col * stepX)
      const y = Math.round(minY + row * stepY)
      if (!overlaps(x, y)) return { x, y }
    }
  }
  const maxX = Math.max(...list.map((m) => m.x + m.w))
  return { x: Math.round(maxX + gap), y: Math.round(minY) }
}

export default function Salon() {
  const [mesas, setMesas] = useState<Mesa[]>(() => loadSalon())
  const [sel, setSel] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null)
  const mesasRef = useRef(mesas)
  mesasRef.current = mesas
  const [fit, setFit] = useState({ s: 1, ox: 0, oy: 0 })

  // Encaja (zoom-to-fit) el plano para que LLENE el lienzo, centrado y con margen.
  function computeFit() {
    const cv = canvasRef.current
    const list = mesasRef.current
    if (!cv || !list.length) return
    const pad = 70
    const minX = Math.min(...list.map((m) => m.x))
    const minY = Math.min(...list.map((m) => m.y))
    const maxX = Math.max(...list.map((m) => m.x + m.w))
    const maxY = Math.max(...list.map((m) => m.y + m.h))
    const bw = Math.max(1, maxX - minX)
    const bh = Math.max(1, maxY - minY)
    const cw = cv.clientWidth
    const ch = cv.clientHeight
    const s = Math.max(0.5, Math.min((cw - pad * 2) / bw, (ch - pad * 2) / bh, 3))
    setFit({ s, ox: (cw - bw * s) / 2 - minX * s, oy: (ch - bh * s) / 2 - minY * s })
  }

  // Re-encaja al cargar/añadir/borrar y al redimensionar (NUNCA mientras se arrastra).
  useEffect(() => {
    if (drag.current) return
    computeFit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesas])
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => computeFit())
    ro.observe(cv)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Carga el plano real del local desde Supabase (si hay sesión y mesas guardadas).
  useEffect(() => {
    let alive = true
    loadSalonDB().then((rows) => {
      if (alive && rows) setMesas(rows)
    })
    return () => {
      alive = false
    }
  }, [])

  // Auto-guardado local en cada cambio (red de seguridad); el botón confirma + suena.
  useEffect(() => {
    saveSalon(mesas)
  }, [mesas])

  // Teclado: Esc deselecciona, Supr/Backspace borra la mesa elegida (si no escribo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'Escape') setSel(null)
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault()
        removeMesa(sel)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel])

  const selMesa = mesas.find((m) => m.id === sel) || null

  function patch(id: string, p: Partial<Mesa>) {
    setMesas((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)))
  }

  function addMesa() {
    const nums = mesas.map((m) => parseInt(m.nombre, 10)).filter((n) => !isNaN(n))
    const next = (nums.length ? Math.max(...nums) : 0) + 1
    const w = 110
    const h = 110
    const spot = freeSpot(mesas, w, h) // primer hueco libre, sin solapar
    const id = 'm' + Date.now().toString(36)
    const nueva: Mesa = { id, nombre: String(next), x: spot.x, y: spot.y, w, h, sillas: 4, forma: 'cuadrada' }
    setMesas((ms) => [...ms, nueva])
    setSel(id)
    play('pop', 0.5, 1.3)
  }

  function removeMesa(id: string) {
    setMesas((ms) => ms.filter((m) => m.id !== id))
    setSel(null)
    play('toggle', 0.4, 0.8)
  }

  async function guardar() {
    saveSalon(mesas) // caché local instantánea
    play('success', 0.45, 1.1)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
    await saveSalonDB(mesas) // persiste en Supabase por local
  }

  // ── arrastre (pointer capture → suave dentro y fuera del elemento) ──
  function onDown(e: RPE<HTMLDivElement>, m: Mesa) {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { id: m.id, px: e.clientX, py: e.clientY, ox: m.x, oy: m.y, moved: false }
    setSel(m.id)
  }
  function onMove(e: RPE<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    // el lienzo está escalado (zoom-to-fit): convierte el desplazamiento de pantalla
    // a coordenadas del plano dividiendo por la escala, y limita al área visible.
    const dx = (e.clientX - d.px) / fit.s
    const dy = (e.clientY - d.py) / fit.s
    if (Math.abs(dx) * fit.s > 3 || Math.abs(dy) * fit.s > 3) d.moved = true
    const cv = canvasRef.current
    const cw = cv?.clientWidth ?? 9999
    const ch = cv?.clientHeight ?? 9999
    const minLX = (0 - fit.ox) / fit.s
    const minLY = (0 - fit.oy) / fit.s
    const maxLX = (cw - fit.ox) / fit.s
    const maxLY = (ch - fit.oy) / fit.s
    setMesas((ms) => ms.map((m) => (m.id === d.id ? { ...m, x: clamp(d.ox + dx, minLX, maxLX - m.w), y: clamp(d.oy + dy, minLY, maxLY - m.h) } : m)))
  }
  function onUp(e: RPE<HTMLDivElement>) {
    if (drag.current) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
      drag.current = null
    }
  }

  function resize(dir: 1 | -1) {
    if (!selMesa) return
    const step = 16
    patch(selMesa.id, {
      w: clamp(selMesa.w + dir * step, 70, 320),
      h: clamp(selMesa.h + dir * step, 70, 320),
    })
  }

  return (
    <div className="section salon-sec">
      <SectionHeader
        title="Salón"
        subtitle="Diseña tu sala · arrastra las mesas, ajústalas y guarda"
        right={
          <div className="salon-tools">
            <Badge tone="muted">
              {mesas.length} mesas · {totalPlazas(mesas)} plazas
            </Badge>
            <button className="salon-btn" onClick={addMesa}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Añadir mesa
            </button>
            <button className={'salon-btn primary' + (saved ? ' ok' : '')} onClick={guardar}>
              {saved ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  Guardado
                </>
              ) : (
                'Guardar sala'
              )}
            </button>
          </div>
        }
      />

      <div className="salon-canvas" ref={canvasRef} onPointerDown={() => setSel(null)}>
        <div className="salon-stage" style={{ transform: `translate(${fit.ox}px, ${fit.oy}px) scale(${fit.s})` }}>
        <AnimatePresence>
          {mesas.map((m) => {
            const round = m.forma === 'redonda'
            const on = sel === m.id
            return (
              <motion.div
                key={m.id}
                className={'salon-mesa' + (on ? ' on' : '')}
                style={{ left: m.x, top: m.y, width: m.w, height: m.h }}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onDown(e, m)
                }}
                onPointerMove={onMove}
                onPointerUp={onUp}
              >
                {seatPositions(m).map((s, i) => (
                  <i key={i} className="sm-chair" style={{ left: s.x, top: s.y }} />
                ))}
                <div className="sm-surface" style={{ borderRadius: round ? '50%' : 16 }}>
                  <span className="sm-num">{m.nombre}</span>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        </div>

        {!mesas.length && <div className="salon-empty">Sala vacía · pulsa “Añadir mesa” para empezar</div>}
      </div>

      <AnimatePresence>
        {selMesa && (
          <motion.div
            className="salon-inspector"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ type: 'spring', stiffness: 460, damping: 30 }}
          >
            <div className="si-row">
              <label className="si-k">Nombre</label>
              <input className="si-name" value={selMesa.nombre} onChange={(e) => patch(selMesa.id, { nombre: e.target.value.slice(0, 12) })} />
            </div>

            <div className="si-row">
              <label className="si-k">Forma</label>
              <div className="si-seg">
                {FORMAS.map((f) => (
                  <button key={f.k} className={'si-opt' + (selMesa.forma === f.k ? ' on' : '')} onClick={() => patch(selMesa.id, { forma: f.k })}>
                    {f.t}
                  </button>
                ))}
              </div>
            </div>

            <div className="si-row">
              <label className="si-k">Plazas</label>
              <div className="si-step">
                <button onClick={() => patch(selMesa.id, { sillas: clamp(selMesa.sillas - 1, 0, 14) })}>−</button>
                <b>{selMesa.sillas}</b>
                <button onClick={() => patch(selMesa.id, { sillas: clamp(selMesa.sillas + 1, 0, 14) })}>+</button>
              </div>
            </div>

            <div className="si-row">
              <label className="si-k">Tamaño</label>
              <div className="si-step">
                <button onClick={() => resize(-1)}>−</button>
                <b className="si-dim">{Math.round(selMesa.w)}px</b>
                <button onClick={() => resize(1)}>+</button>
              </div>
            </div>

            <div className="si-foot">
              <button className="si-del" onClick={() => removeMesa(selMesa.id)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                </svg>
                Eliminar
              </button>
              <button className="si-done" onClick={() => setSel(null)}>
                Listo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
