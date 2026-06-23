import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SectionHeader, Badge } from '../components/ui'
import { play } from '../lib/sound'
import { type Mesa, type MesaForma, loadSalon, saveSalon, seatPositions, totalPlazas } from '../lib/salon'

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

export default function Salon() {
  const [mesas, setMesas] = useState<Mesa[]>(() => loadSalon())
  const [sel, setSel] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null)

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
    const cv = canvasRef.current
    const cw = cv?.clientWidth ?? 800
    const id = 'm' + Date.now().toString(36)
    const nueva: Mesa = { id, nombre: String(next), x: clamp(cw / 2 - 55, 8, cw - 120), y: 150, w: 110, h: 110, sillas: 4, forma: 'cuadrada' }
    setMesas((ms) => [...ms, nueva])
    setSel(id)
    play('pop', 0.5, 1.3)
  }

  function removeMesa(id: string) {
    setMesas((ms) => ms.filter((m) => m.id !== id))
    setSel(null)
    play('toggle', 0.4, 0.8)
  }

  function guardar() {
    saveSalon(mesas)
    play('success', 0.45, 1.1)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
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
    const dx = e.clientX - d.px
    const dy = e.clientY - d.py
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true
    const cv = canvasRef.current
    const cw = cv?.clientWidth ?? 9999
    const ch = cv?.clientHeight ?? 9999
    setMesas((ms) => ms.map((m) => (m.id === d.id ? { ...m, x: clamp(d.ox + dx, 4, cw - m.w - 4), y: clamp(d.oy + dy, 4, ch - m.h - 4) } : m)))
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
