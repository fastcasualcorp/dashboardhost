import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, animate, useMotionValue, useTransform } from 'motion/react'
import { SectionHeader, Badge } from '../components/ui'
import { eur } from '../lib/data'
import { PRODUCTOS, CAT_ORDER, type Producto } from '../lib/products'
import { play } from '../lib/sound'
import { isDemoMode } from '../lib/demo'
import { fichaFoodCost } from '../lib/foodcost'

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

// DEMO: cifras de escaparate (fórmulas a partir del precio) — NO se tocan.
// REAL: el margen sale del escandallo real (foodcost.ts) cruzado por id; sin
// escandallo → margen "—". Ventas/mes y Valoración NO tienen fuente real → "—".
function statsOf(p: Producto, fcById: Record<string, { margen: number; fc: number }>): Stats {
  if (isDemoMode()) {
    const ventas = Math.round(38 + p.price * 6 + p.mods.length * 7)
    const margen = Math.min(74, 54 + Math.round(p.price))
    const rating = Math.min(5, 3.9 + p.mods.length * 0.25 + (p.cat === 'Burgers' ? 0.3 : 0))
    return { ventas: String(ventas), margen: String(margen) + '%', rating: rating.toFixed(1) + '★' }
  }
  // REAL — margen % = 100 − food cost % (divisor blindado dentro de fichaFoodCost).
  const fc = fcById[p.id]
  const margen = fc ? String(Math.round((100 - fc.fc) * 10) / 10) + '%' : '—'
  return { ventas: '—', margen, rating: '—' }
}

const FILTERS = ['Todos', ...CAT_ORDER]

const Pencil = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)

// Cada métrica ya viene formateada como texto ("38" / "62%" / "4.2★" o "—"),
// para poder mostrar un vacío honesto en REAL sin fuente real.
type Stats = { ventas: string; margen: string; rating: string }

type Draft = { name: string; price: string; img: string }

const Xmark = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

/* Una carta del coverflow. El z-index se deriva de la posición REAL (motion value),
   no del índice — así nunca hay un salto de z a mitad de transición (era el solape feo).
   Al editar, la card enfocada GIRA en 3D (rotateY 180) y muestra el formulario por detrás.
   Cada cara lleva su propio overflow:hidden — la card solo conserva preserve-3d (si el
   overflow vive en la card, el 3D se aplana y el flip se rompe). */
function CartaCard({ p, off, focus, spread, num, ti, st, onSelect, onEdit, editing, draft, onDraft, onSave, onCancel, photos }: {
  p: Producto; off: number; focus: boolean; spread: number; num: string
  ti: TypeInfo; st: Stats; onSelect: () => void; onEdit: () => void
  editing: boolean; draft: Draft; onDraft: (d: Draft) => void
  onSave: () => void; onCancel: () => void; photos: Producto[]
}) {
  const x = useMotionValue(off * spread)
  const zIndex = useTransform(x, (v) => 200 - Math.round(Math.abs(v) / 4))
  useEffect(() => {
    const c = animate(x, off * spread, { type: 'spring', stiffness: 300, damping: 34, mass: 0.7 })
    return () => c.stop()
  }, [off, spread, x])

  const flipped = editing && focus
  const tilt = Math.max(-2, Math.min(2, off)) * -14

  return (
    <motion.div
      data-ds="carta.card"
      className={'carta-card' + (focus ? ' focus' : '') + (flipped ? ' flipped' : '')}
      style={{ x, zIndex, ['--type' as string]: ti.color }}
      animate={{
        scale: focus ? 1 : 0.82,
        rotateY: flipped ? 180 : tilt,
        opacity: focus ? 1 : 0.6,
        // OJO: nada de `filter` aquí. Un filter (aunque sea brightness(1)) APLANA el
        // preserve-3d y rompe el backface-visibility → el flip mostraría el frente
        // espejado en vez del dorso. El oscurecido de las no-enfocadas va por CSS
        // (filter sobre .cc-front sólo cuando NO está enfocada; esa cara nunca gira).
      }}
      transition={{ type: 'spring', stiffness: flipped ? 240 : 300, damping: flipped ? 30 : 34, mass: 0.7 }}
      onClick={onSelect}
      role="button"
      aria-label={p.name}
    >
      {/* ── CARA FRONTAL ── */}
      <div className="cc-face cc-front">
        {p.img
          ? <img className="cc-photo" src={p.img} alt={p.name} loading="lazy" draggable={false} />
          : <div className="cc-photo cc-photo-empty" aria-hidden="true">{ti.emoji}</div>}

        {focus && (
          <button className="cc-edit" onClick={(e) => { e.stopPropagation(); onEdit() }} aria-label="Editar carta">
            <Pencil />
          </button>
        )}
        <span className="cc-id tnum">#{num}</span>

        {focus && (
          <span className="cc-balance">
            <b className="cc-bal-num tnum" data-ds="carta.balnum">{st.ventas}</b>
            <small className="cc-bal-lab">Ventas / mes</small>
          </span>
        )}

        <span className="cc-panel">
          <span className="cc-tab">
            <b className="cc-name" data-ds="carta.name">{p.name}</b>
            <span className="cc-sub">{ti.emoji} {ti.label}{p.mods[0] ? ' · ' + p.mods[0] : ''}</span>
            <span className="cc-notch" aria-hidden="true" />
          </span>
          <span className="cc-pfoot">
            <span className="cc-pf"><b className="cc-price tnum" data-ds="carta.price">{eur(p.price)} €</b><i>Precio</i></span>
            {focus && <span className="cc-pf right"><b className="tnum">{st.margen} · {st.rating}</b><i>Margen · Valoración</i></span>}
          </span>
        </span>
      </div>

      {/* ── CARA TRASERA — edición (solo la card enfocada) ── */}
      {focus && (
        <div className="cc-face cc-back" onClick={(e) => e.stopPropagation()}>
          <div className="ccb-head">
            <b>Editar carta</b>
            <button className="ccb-close" onClick={(e) => { e.stopPropagation(); onCancel() }} aria-label="Volver a la carta">
              <Xmark />
            </button>
          </div>
          <div className="ccb-body">
            <div className="ce-row">
              <label className="cd-field">
                <span>Nombre</span>
                <input value={draft.name} onChange={(e) => onDraft({ ...draft, name: e.target.value })} />
              </label>
              <label className="cd-field price">
                <span>Precio €</span>
                <input value={draft.price} inputMode="decimal" onChange={(e) => onDraft({ ...draft, price: e.target.value })} />
              </label>
            </div>
            <div className="ce-lab">Foto</div>
            <div className="cd-photos">
              {photos.map((pp) => (
                <button key={pp.id} className={'cd-ph' + (draft.img === pp.img ? ' on' : '')} onClick={() => onDraft({ ...draft, img: pp.img })}>
                  <img src={pp.img} alt={pp.name} loading="lazy" />
                </button>
              ))}
            </div>
          </div>
          <div className="ccb-actions">
            <button className="cd-btn ghost" onClick={onCancel}>Cancelar</button>
            <button className="cd-btn primary" onClick={onSave}>Guardar</button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default function Platos() {
  const [prods, setProds] = useState<Producto[]>(PRODUCTOS)
  const [cat, setCat] = useState('Todos')
  const [sel, setSel] = useState(0)
  const [editing, setEditing] = useState(false)
  const [newId, setNewId] = useState<string | null>(null) // id del producto recién creado y aún sin guardar (cancelar lo elimina)
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

  // REAL: margen real por id desde el escandallo (foodcost.ts). En DEMO no se usa
  // (statsOf usa sus fórmulas de escaparate), pero el mapa es barato de construir.
  const fcById: Record<string, { margen: number; fc: number }> = {}
  for (const f of fichaFoodCost()) fcById[f.id] = { margen: f.margen, fc: f.fc }

  function go(dir: number) {
    if (editing) return
    setSel((s) => {
      const n = Math.max(0, Math.min(list.length - 1, s + dir))
      if (n !== s) play('tap', 0.55, 1.12) // tick de selector
      return n
    })
  }
  function select(i: number) {
    if (editing || i === sel) return
    play('tap', 0.55, 1.12) // tick de selector
    setSel(i)
  }
  function cancelEdit() {
    // Si era un producto NUEVO sin guardar, lo quitamos (no dejamos cartas en blanco).
    if (newId) {
      setProds((ps) => ps.filter((p) => p.id !== newId))
      setNewId(null)
      setSel((s) => Math.max(0, s - 1))
    }
    setEditing(false)
    play('tap', 0.4)
  }
  // ── AÑADIR PRODUCTO: crea una carta en blanco en la categoría activa, la enfoca y abre su edición ──
  function addProduct() {
    if (editing) return
    const c = cat === 'Todos' ? CAT_ORDER[0] : cat
    const id = 'nuevo-' + Math.round(performance.now())
    const nuevo: Producto = { id, name: '', price: 0, cat: c, img: '', iva: 10, mods: [] }
    const idx = prods.filter((p) => p.cat === c).length // posición que ocupará en la lista filtrada (va al final)
    setProds((ps) => [...ps, nuevo])
    setCat(c)
    setSel(idx)
    setNewId(id)
    setDraft({ name: '', price: '', img: '' })
    setEditing(true)
    play('toggle', 0.5, 1.18)
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
    // Un producto NUEVO necesita al menos un nombre (no guardamos cartas fantasma).
    if (newId && !draft.name.trim()) { play('error', 0.4); return }
    setProds((ps) => ps.map((p) => (p.id === current.id ? { ...p, name: draft.name.trim() || p.name, price: isNaN(price) ? p.price : price, img: draft.img } : p)))
    setNewId(null)
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
        <button className="carta-add" onClick={addProduct} disabled={editing} aria-label="Añadir producto nuevo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Producto
        </button>
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
                st={statsOf(p, fcById)}
                onSelect={() => select(i)}
                onEdit={openEdit}
                editing={editing}
                draft={draft}
                onDraft={setDraft}
                onSave={saveEdit}
                onCancel={cancelEdit}
                photos={PRODUCTOS.filter((x) => x.cat === p.cat)}
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
    </div>
  )
}
