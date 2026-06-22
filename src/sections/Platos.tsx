import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, animate, useMotionValue, useTransform } from 'motion/react'
import { SectionHeader, Badge } from '../components/ui'
import { eur } from '../lib/data'
import { PRODUCTOS, CAT_ORDER, type Producto } from '../lib/products'
import { play } from '../lib/sound'

/* Cada producto = una "carta" tipo Pokémon. Se navega como un selector de
   videojuego (coverflow 3D), con stats superpuestos y edición integrada. */
type TypeInfo = { label: string; color: string; emoji: string }
const TYPES: Record<string, TypeInfo> = {
  Burgers: { label: 'Burger', color: '#ff6b3d', emoji: '🔥' },
  Menús: { label: 'Menú', color: '#ffb300', emoji: '🍱' },
  Sides: { label: 'Side', color: '#f5a524', emoji: '🍟' },
  Bebidas: { label: 'Bebida', color: '#3a86ff', emoji: '💧' },
  Postres: { label: 'Dulce', color: '#c46bff', emoji: '🍫' },
}
const typeOf = (cat: string) => TYPES[cat] ?? { label: cat, color: '#ffbf10', emoji: '⭐' }

function statsOf(p: Producto) {
  const ventas = Math.round(38 + p.price * 6 + p.mods.length * 7)
  const margen = Math.min(74, 54 + Math.round(p.price))
  const rating = Math.min(5, 3.9 + p.mods.length * 0.25 + (p.cat === 'Burgers' ? 0.3 : 0))
  return { ventas, margen, rating: rating.toFixed(1) }
}

const FILTERS = ['Todos', ...CAT_ORDER]

const Pencil = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)

type Stats = { ventas: number; margen: number; rating: string }

/* Una carta del coverflow. El z-index se deriva de la posición REAL (motion value),
   no del índice — así nunca hay un salto de z a mitad de transición (era el solape feo). */
function CartaCard({ p, off, focus, spread, num, ti, st, onSelect, onEdit }: {
  p: Producto; off: number; focus: boolean; spread: number; num: string
  ti: TypeInfo; st: Stats; onSelect: () => void; onEdit: () => void
}) {
  const x = useMotionValue(off * spread)
  const zIndex = useTransform(x, (v) => 200 - Math.round(Math.abs(v) / 4))
  useEffect(() => {
    const c = animate(x, off * spread, { type: 'spring', stiffness: 300, damping: 34, mass: 0.7 })
    return () => c.stop()
  }, [off, spread, x])

  return (
    <motion.div
      className={'carta-card' + (focus ? ' focus' : '')}
      style={{ x, zIndex, ['--type' as string]: ti.color }}
      animate={{
        scale: focus ? 1 : 0.82,
        rotateY: Math.max(-2, Math.min(2, off)) * -14,
        opacity: focus ? 1 : 0.6,
        filter: focus ? 'brightness(1)' : 'brightness(0.6)',
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 34, mass: 0.7 }}
      onClick={onSelect}
      role="button"
      aria-label={p.name}
    >
      <img className="cc-photo" src={p.img} alt={p.name} loading="lazy" draggable={false} />

      {focus && (
        <button className="cc-edit" onClick={(e) => { e.stopPropagation(); onEdit() }} aria-label="Editar carta">
          <Pencil />
        </button>
      )}
      <span className="cc-id tnum">#{num}</span>

      {focus && (
        <span className="cc-balance">
          <b className="cc-bal-num tnum">{st.ventas}</b>
          <small className="cc-bal-lab">Ventas / mes</small>
        </span>
      )}

      <span className="cc-panel">
        <span className="cc-tab">
          <b className="cc-name">{p.name}</b>
          <span className="cc-sub">{ti.emoji} {ti.label}{p.mods[0] ? ' · ' + p.mods[0] : ''}</span>
          <span className="cc-notch" aria-hidden="true" />
        </span>
        <span className="cc-pfoot">
          <span className="cc-pf"><b className="cc-price tnum">{eur(p.price)} €</b><i>Precio</i></span>
          {focus && <span className="cc-pf right"><b className="tnum">{st.margen}% · {st.rating}★</b><i>Margen · Valoración</i></span>}
        </span>
      </span>
    </motion.div>
  )
}

export default function Platos() {
  const [prods, setProds] = useState<Producto[]>(PRODUCTOS)
  const [cat, setCat] = useState('Todos')
  const [sel, setSel] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<{ name: string; price: string; img: string }>({ name: '', price: '', img: '' })
  const stageRef = useRef<HTMLDivElement>(null)
  const [stageW, setStageW] = useState(960)

  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver((es) => {
      for (const e of es) setStageW(e.contentRect.width)
    })
    ro.observe(el)
    setStageW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const SPREAD = Math.min(400, Math.max(230, stageW * 0.3))

  const list = cat === 'Todos' ? prods : prods.filter((p) => p.cat === cat)
  const current = list[sel]

  function go(dir: number) {
    setSel((s) => {
      const n = Math.max(0, Math.min(list.length - 1, s + dir))
      if (n !== s) play('tap', 0.55, 1.12) // tick de selector
      return n
    })
  }
  function select(i: number) {
    if (i === sel) return
    play('tap', 0.55, 1.12) // tick de selector
    setSel(i)
  }
  function changeCat(c: string) {
    setCat(c)
    setSel(0)
    play('tap', 0.4)
  }
  function openEdit() {
    if (!current) return
    setDraft({ name: current.name, price: String(current.price), img: current.img })
    setEditing(true)
    play('tap', 0.45)
  }
  function saveEdit() {
    const price = parseFloat(draft.price.replace(',', '.'))
    setProds((ps) => ps.map((p) => (p.id === current.id ? { ...p, name: draft.name.trim() || p.name, price: isNaN(price) ? p.price : price, img: draft.img } : p)))
    setEditing(false)
    play('toggle', 0.5)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing || e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length, editing])

  return (
    <div className="section carta-section">
      <SectionHeader title="Carta" subtitle="Tu equipo de productos · navega y edita" right={<Badge tone="gold">{prods.length} cartas</Badge>} />

      <div className="carta-tabs">
        {FILTERS.map((f) => (
          <button key={f} className={'carta-tab' + (cat === f ? ' on' : '')} onClick={() => changeCat(f)}>
            {f}
          </button>
        ))}
      </div>

      <div className="carta-stage" ref={stageRef}>
        <button className="carta-nav prev" onClick={() => go(-1)} disabled={sel === 0} aria-label="Anterior">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>

        <div className="carta-track">
          {list.map((p, i) => {
            const off = i - sel
            if (Math.abs(off) > 2) return null
            return (
              <CartaCard
                key={p.id}
                p={p}
                off={off}
                focus={off === 0}
                spread={SPREAD}
                num={String(prods.findIndex((x) => x.id === p.id) + 1).padStart(3, '0')}
                ti={typeOf(p.cat)}
                st={statsOf(p)}
                onSelect={() => select(i)}
                onEdit={openEdit}
              />
            )
          })}
        </div>

        <button className="carta-nav next" onClick={() => go(1)} disabled={sel >= list.length - 1} aria-label="Siguiente">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>

      <div className="carta-dots">
        {list.map((p, i) => (
          <button key={p.id} className={'cdot' + (i === sel ? ' on' : '')} onClick={() => select(i)} aria-label={p.name} />
        ))}
      </div>

      {/* Modal de edición */}
      <AnimatePresence>
        {editing && current && (
          <motion.div className="carta-edit-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditing(false)}>
            <motion.div
              className="carta-edit"
              style={{ ['--type' as string]: typeOf(current.cat).color }}
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ce-head">
                <b>Editar carta</b>
                <button className="ce-close" onClick={() => setEditing(false)} aria-label="Cerrar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
              <div className="ce-row">
                <label className="cd-field">
                  <span>Nombre</span>
                  <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                </label>
                <label className="cd-field price">
                  <span>Precio €</span>
                  <input value={draft.price} inputMode="decimal" onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} />
                </label>
              </div>
              <div className="ce-lab">Foto</div>
              <div className="cd-photos">
                {PRODUCTOS.map((pp) => (
                  <button key={pp.id} className={'cd-ph' + (draft.img === pp.img ? ' on' : '')} onClick={() => setDraft((d) => ({ ...d, img: pp.img }))}>
                    <img src={pp.img} alt={pp.name} loading="lazy" />
                  </button>
                ))}
              </div>
              <div className="ce-actions">
                <button className="cd-btn ghost" onClick={() => setEditing(false)}>Cancelar</button>
                <button className="cd-btn primary" onClick={saveEdit}>Guardar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
