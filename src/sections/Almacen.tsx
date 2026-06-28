import { useState, useEffect, type CSSProperties } from 'react'
import { Card, SectionHeader, KpiTile, DataTable, Badge, Grid } from '../components/ui'
import { play } from '../lib/sound'
import { reduceMotion } from '../lib/data'
import { useAlmacen, updateAlmacenes, setItemStock, removeItem, FOTO, type Tipo, type Almacen } from '../lib/almacen'

/* Almacén (antes "Stock"). Varios almacenes como FICHAS (foto Nano Banana). Al pulsar uno, su stock se ve como
   un GRID DE PRODUCTOS estilo videojuego: foto de estudio sobre negro + % gigante (verde/ámbar/rojo) + nombre +
   barra HUD que SANGRA EN VIVO. El stock es FUENTE ÚNICA (`lib/almacen`): cuando el TPV COBRA, baja AL VENDER.
   Añadir productos = CATÁLOGO de cards con foto. Pedido de Juan (24-jun): preview "97% High Potato". */

const TIPO_META: Record<Tipo, { label: string; color: string; emoji: string; tone: 'gold' | 'blue' | 'green' }> = {
  obrador: { label: 'Obrador', color: '#ffbf10', emoji: '🍳', tone: 'gold' },
  refrigerado: { label: 'Refrigerado', color: '#3a86ff', emoji: '❄️', tone: 'blue' },
  congelado: { label: 'Congelado', color: '#22d3ee', emoji: '🧊', tone: 'blue' },
  seco: { label: 'Seco / Bebidas', color: '#34d399', emoji: '📦', tone: 'green' },
}
const TIPO_KEYS = Object.keys(TIPO_META) as Tipo[]

// ── Catálogo de PRODUCTOS (ingredientes de la Carta) con su foto de estudio Nano Banana Pro ──
type Prod = { id: string; name: string; unit: string; foto: string; cad: number }
const PROD: Prod[] = [
  { id: 'pan', name: 'Pan brioche', unit: 'uds', foto: '/img/prod/pan-brioche.jpg', cad: 2 },
  { id: 'carne', name: 'Carne picada', unit: 'kg', foto: '/img/prod/carne.jpg', cad: 2 },
  { id: 'bacon', name: 'Bacon', unit: 'kg', foto: '/img/prod/bacon.jpg', cad: 4 },
  { id: 'cheddar', name: 'Queso cheddar', unit: 'kg', foto: '/img/prod/cheddar.jpg', cad: 12 },
  { id: 'pollo', name: 'Pollo crispy', unit: 'kg', foto: '/img/prod/pollo.jpg', cad: 3 },
  { id: 'lechuga', name: 'Lechuga', unit: 'kg', foto: '/img/prod/lechuga.jpg', cad: 2 },
  { id: 'tomate', name: 'Tomate', unit: 'kg', foto: '/img/prod/tomate.jpg', cad: 4 },
  { id: 'cebolla', name: 'Cebolla', unit: 'kg', foto: '/img/prod/cebolla.jpg', cad: 18 },
  { id: 'pepinillos', name: 'Pepinillos', unit: 'kg', foto: '/img/prod/pepinillos.jpg', cad: 60 },
  { id: 'salsa', name: 'Salsa Rebell', unit: 'L', foto: '/img/prod/salsa.jpg', cad: 30 },
  { id: 'patata', name: 'Patata congelada', unit: 'kg', foto: '/img/prod/patata.jpg', cad: 180 },
  { id: 'aros', name: 'Aros de cebolla', unit: 'kg', foto: '/img/prod/aros.jpg', cad: 180 },
  { id: 'cola', name: 'Coca-Cola', unit: 'uds', foto: '/img/prod/cola.jpg', cad: 220 },
  { id: 'cola-zero', name: 'Coca-Cola Zero', unit: 'uds', foto: '/img/prod/cola-zero.jpg', cad: 220 },
  { id: 'cerveza', name: 'Cerveza', unit: 'uds', foto: '/img/prod/cerveza.jpg', cad: 200 },
  { id: 'agua', name: 'Agua', unit: 'uds', foto: '/img/prod/agua.jpg', cad: 300 },
]
const PROD_BY: Record<string, Prod> = Object.fromEntries(PROD.map((p) => [p.id, p]))

type Item = Almacen['items'][number]

const e0 = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 })
// Parseo número desde "5,6 kg" → 5.6 · y formato es-ES con coma decimal.
const numOf = (s: string | number) => { const n = parseFloat(String(s).replace(',', '.').replace(/[^\d.]/g, '')); return isFinite(n) ? n : 0 }
const fmtNum = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es-ES', { maximumFractionDigits: 1 })
const cadOf = (it: Item) => it.cad ?? PROD_BY[it.pid]?.cad ?? 30
const cadInfo = (d: number): { t: string; tone: 'red' | 'amber' | 'green'; lbl: string } =>
  d <= 2 ? { t: `${d}d`, tone: 'red', lbl: 'Caduca ya' }
    : d <= 5 ? { t: `${d}d`, tone: 'amber', lbl: 'Pronto' }
      : d < 60 ? { t: `${d}d`, tone: 'green', lbl: 'OK' }
        : { t: d > 360 ? '1a+' : `${Math.round(d / 30)}m`, tone: 'green', lbl: 'Larga' }
const estadoDe = (nivel: number): { t: string; tone: 'red' | 'amber' | 'green' } =>
  nivel < 30 ? { t: 'Crítico', tone: 'red' } : nivel < 55 ? { t: 'Bajo', tone: 'amber' } : { t: 'OK', tone: 'green' }
const toneColor = (tone: 'red' | 'amber' | 'green') => (tone === 'red' ? '#ff5c5c' : tone === 'amber' ? '#f5b341' : '#34d399')
const alertasDe = (a: Almacen) => a.items.filter((i) => i.nivel < 55).length
const porCaducarDe = (a: Almacen) => a.items.filter((i) => cadOf(i) <= 5).length

const Pencil = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)
const Xmark = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

type Draft = { nombre: string; tipo: Tipo }

export default function Almacen() {
  const alms = useAlmacen() // FUENTE ÚNICA: el TPV baja el stock al cobrar (consumirVenta)
  const [selId, setSelId] = useState<string>(alms[0]?.id ?? 'a1')
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({ nombre: '', tipo: 'seco' })
  const [picker, setPicker] = useState(false) // catálogo de productos para cargar
  const [editPid, setEditPid] = useState<string | null>(null) // producto cuyo stock se está ajustando
  const [idraft, setIdraft] = useState<{ actual: number; max: number; umbral: number }>({ actual: 0, max: 100, umbral: 0 })

  const sel = alms.find((a) => a.id === selId) ?? alms[0]

  // Totales del negocio.
  const totRefs = alms.reduce((n, a) => n + a.items.length, 0)
  const totAlertas = alms.reduce((n, a) => n + alertasDe(a), 0)
  const totCaducar = alms.reduce((n, a) => n + porCaducarDe(a), 0)
  const totValor = alms.reduce((n, a) => n + a.valor, 0)

  // ── BARRAS QUE SANGRAN EN VIVO: además del consumo REAL al vender (TPV → consumirVenta), un drenaje
  //    ambiente lento (~0,18-0,38%/tick) en el almacén abierto da sensación de cocina en marcha. (escribe en el store)
  useEffect(() => {
    if (reduceMotion()) return
    const iv = window.setInterval(() => {
      updateAlmacenes((list) => list.map((a) => (a.id !== selId ? a : {
        ...a,
        items: a.items.map((it, i) => ({ ...it, nivel: Math.max(6, +(it.nivel - (0.18 + ((i * 7) % 9) / 40)).toFixed(2)) })),
      })))
    }, 2200)
    return () => window.clearInterval(iv)
  }, [selId])

  function pick(id: string) {
    if (id === selId) return
    setSelId(id)
    setPicker(false)
    play('tap', 0.4)
  }
  function openEdit(a: Almacen) { setDraft({ nombre: a.nombre, tipo: a.tipo }); setEditId(a.id); play('tap', 0.45) }
  function cancelEdit() { setEditId(null); play('tap', 0.4) }
  function saveEdit(id: string) {
    updateAlmacenes((list) => list.map((a) => (a.id === id ? { ...a, nombre: draft.nombre.trim() || a.nombre, tipo: draft.tipo, foto: a.foto.startsWith('/img/almacen-') ? FOTO[draft.tipo] : a.foto } : a)))
    setEditId(null); play('toggle', 0.5)
  }
  function borrar(id: string) {
    updateAlmacenes((list) => list.filter((a) => a.id !== id))
    if (id === selId) { const next = alms.find((a) => a.id !== id); if (next) setSelId(next.id) }
    setEditId(null); play('toggle', 0.45)
  }
  function nuevo() {
    const id = 'a' + Date.now().toString(36)
    updateAlmacenes((list) => [...list, { id, nombre: 'Nuevo almacén', tipo: 'seco', foto: FOTO.seco, valor: 0, ocupacion: 0, items: [] }])
    setSelId(id); setDraft({ nombre: 'Nuevo almacén', tipo: 'seco' }); setEditId(id); play('pop', 0.5, 1.2)
  }
  // Cargar un producto del catálogo en el almacén seleccionado (entra al 92%).
  function cargarProd(pid: string) {
    const p = PROD_BY[pid]
    updateAlmacenes((list) => list.map((a) => (a.id === sel.id ? { ...a, items: [...a.items, { pid, nivel: 92, actual: `0 ${p.unit}`, umbral: `0 ${p.unit}` }] } : a)))
    play('success', 0.5)
  }
  // Ajustar el stock a mano (recepción / inventario). El % SALE de actual ÷ capacidad (con referencia,
  // ya no un slider suelto). Si el producto no tenía capacidad, se deriva de su nivel actual. (Juan 28-jun)
  function openItem(it: Item) {
    setEditPid(it.pid)
    const a = numOf(it.actual)
    const u = numOf(it.umbral)
    const m = it.max && it.max > 0 ? it.max : (it.nivel > 0 ? Math.round((a / (it.nivel / 100)) * 10) / 10 : Math.max(a, u, 1) * 2)
    setIdraft({ actual: a, max: m > 0 ? m : 1, umbral: u })
    play('tap', 0.5, 1.1)
  }
  function saveItem() {
    if (!editPid) return
    const unit = PROD_BY[editPid]?.unit ?? ''
    const max = Math.max(0.1, idraft.max)
    const nivel = Math.max(0, Math.min(100, Math.round((idraft.actual / max) * 100)))
    setItemStock(sel.id, editPid, { nivel, actual: `${fmtNum(idraft.actual)} ${unit}`.trim(), umbral: `${fmtNum(idraft.umbral)} ${unit}`.trim(), max })
    setEditPid(null); play('success', 0.5, 1.1)
  }
  function quitarItem() {
    if (!editPid) return
    removeItem(sel.id, editPid)
    setEditPid(null); play('toggle', 0.5)
  }
  const editProd = editPid ? PROD_BY[editPid] : null
  const editMax = Math.max(0.1, idraft.max) // capacidad (referencia del %)
  const editPct = Math.max(0, Math.min(100, Math.round((idraft.actual / editMax) * 100))) // % = actual ÷ capacidad

  const selAlert = alertasDe(sel)
  const selCaducar = porCaducarDe(sel)
  const yaTengo = new Set(sel.items.map((i) => i.pid))
  const disponibles = PROD.filter((p) => !yaTengo.has(p.id))

  return (
    <div className="section">
      <SectionHeader
        title="Almacén"
        subtitle="Materias primas por almacén"
        right={totAlertas > 0 ? <Badge tone="red">⚠ {totAlertas} alertas activas</Badge> : <Badge tone="green">Todo en orden</Badge>}
      />

      <Grid cols={4} className="kpi-grid">
        <KpiTile label="Almacenes" value={String(alms.length)} unit="espacios" delta={`${totRefs} refs`} foot="referencias totales" trend="flat" />
        <KpiTile label="Alertas activas" value={String(totAlertas)} unit="prods" delta={totAlertas ? '+' + totAlertas : '0'} foot="bajo umbral" trend={totAlertas ? 'down' : 'flat'} />
        <KpiTile label="Por caducar" value={String(totCaducar)} unit="prods" delta={totCaducar ? '≤5 días' : 'ninguno'} foot="caducidad próxima" trend={totCaducar ? 'down' : 'flat'} />
        <KpiTile label="Valor total" value={e0(totValor) + ',00'} unit="€" delta="-2,1%" foot="vs semana pasada" trend="down" />
      </Grid>

      {/* ── FICHAS de almacén (foto Nano Banana + tipo + valor + alertas + ocupación) ── */}
      <div className="alm-grid">
        {alms.map((a, i) => {
          const tm = TIPO_META[a.tipo]
          const al = alertasDe(a)
          const editing = editId === a.id
          return (
            <article className={'alm-card' + (a.id === selId ? ' sel' : '')} key={a.id} style={{ ['--accent' as string]: tm.color, ['--i' as string]: i } as CSSProperties} onClick={() => pick(a.id)}>
              <div className="alm-photo-wrap">
                <img className="alm-photo" src={a.foto} alt="" loading="lazy" draggable={false} />
                <span className="alm-tipo">{tm.emoji} {tm.label}</span>
                {al > 0 && <span className="alm-alert">⚠ {al}</span>}
                <button className="alm-edit" onClick={(e) => { e.stopPropagation(); openEdit(a) }} aria-label={`Editar ${a.nombre}`}><Pencil /></button>
                <span className="alm-valor"><b>{e0(a.valor)} €</b><small>valor stock</small></span>
              </div>
              <div className="alm-body">
                <b className="alm-name">{a.nombre}</b>
                <div className="alm-foot">
                  <span className="alm-f"><b>{a.items.length}</b><i>referencias</i></span>
                  <span className="alm-f"><b className={al ? 'r' : 'g'}>{al}</b><i>alertas</i></span>
                  <span className="alm-occ"><span className="alm-occ-bar"><span style={{ width: a.ocupacion + '%' }} /></span><i>{a.ocupacion}% lleno</i></span>
                </div>
              </div>
              {editing && (
                <div className="alm-edit-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="eb-head"><b>Editar almacén</b><button className="eb-close" onClick={cancelEdit} aria-label="Cerrar"><Xmark /></button></div>
                  <div className="eb-body">
                    <label className="eb-field"><span>Nombre</span><input autoFocus value={draft.nombre} onChange={(ev) => setDraft({ ...draft, nombre: ev.target.value })} /></label>
                    <label className="eb-field"><span>Tipo</span>
                      <select value={draft.tipo} onChange={(ev) => setDraft({ ...draft, tipo: ev.target.value as Tipo })}>
                        {TIPO_KEYS.map((k) => <option key={k} value={k}>{TIPO_META[k].label}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="eb-actions"><button className="eb-btn danger" onClick={() => borrar(a.id)}>Eliminar</button><button className="eb-btn primary" onClick={() => saveEdit(a.id)}>Guardar</button></div>
                </div>
              )}
            </article>
          )
        })}
        <button className="alm-card alm-add" onClick={nuevo}>
          <span className="alm-add-plus">+</span><b>Nuevo almacén</b><span>Crea otro espacio de stock</span>
        </button>
      </div>

      {/* ── DETALLE del almacén seleccionado ── */}
      <div className="alm-detail-head">
        <h2 className="rs-h2">{TIPO_META[sel.tipo].emoji} {sel.nombre}</h2>
        {selCaducar > 0 && <Badge tone="amber">⏳ {selCaducar} por caducar</Badge>}
        <Badge tone={selAlert ? 'red' : 'green'}>{selAlert ? `${selAlert} alertas` : 'Sin alertas'}</Badge>
        <button className="alm-load-btn" onClick={() => { setPicker((v) => !v); play('tap', 0.5, 1.15) }}>{picker ? '✕ Cerrar' : '＋ Cargar producto'}</button>
      </div>

      {/* CATÁLOGO de productos para cargar (cards con foto, estilo videojuego) */}
      {picker && (
        <div className="alm-picker">
          <div className="alm-picker-kick">◢ CATÁLOGO · pulsa para cargar en {sel.nombre}</div>
          {disponibles.length === 0 ? (
            <p className="muted-s" style={{ padding: '8px 2px', margin: 0 }}>Este almacén ya tiene todos los productos del catálogo.</p>
          ) : (
            <div className="alm-pick-grid">
              {disponibles.map((p) => (
                <button className="alm-pick" key={p.id} onClick={() => cargarProd(p.id)}>
                  <span className="alm-pick-ph"><img src={p.foto} alt="" loading="lazy" draggable={false} /></span>
                  <b>{p.name}</b>
                  <span className="alm-pick-add">＋ Cargar</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {sel.items.length === 0 ? (
        <Card>
          <p className="muted-s" style={{ textAlign: 'center', padding: '1.5rem 0', margin: 0 }}>
            Este almacén está vacío. Pulsa <strong style={{ color: 'var(--brand)' }}>＋ Cargar producto</strong> y elige del catálogo.
          </p>
        </Card>
      ) : (
        <>
          {/* GRID de productos = foto sobre negro + % gigante + nombre + barra que sangra (preview de Juan) */}
          <div className="alm-pgrid">
            {sel.items.map((it) => {
              const p = PROD_BY[it.pid]
              const es = estadoDe(it.nivel)
              const cd = cadInfo(cadOf(it))
              const col = toneColor(es.tone)
              return (
                <button className={'alm-pcard' + (it.nivel < 30 ? ' crit' : '')} key={it.pid} style={{ ['--tone' as string]: col } as CSSProperties} onClick={() => openItem(it)} title={`Ajustar stock de ${p?.name ?? it.pid}`}>
                  <span className="alm-pcard-edit" aria-hidden="true"><Pencil /></span>
                  <div className="alm-pcard-top">
                    <span className="alm-pcard-ph"><img src={p?.foto} alt="" loading="lazy" draggable={false} /></span>
                    <div className="alm-pcard-stat">
                      <b className="alm-pcard-pct">{Math.round(it.nivel)}<i>%</i></b>
                      <span className="alm-pcard-name">{p?.name ?? it.pid}</span>
                      <span className="alm-pcard-meta">{it.actual} · <em className={'apc-cad ' + cd.tone}>⏳ {cd.t}</em></span>
                    </div>
                  </div>
                  <div className="alm-pcard-track"><span className="alm-pcard-fill" style={{ width: it.nivel + '%' }} /></div>
                </button>
              )
            })}
          </div>

          <Card>
            <div className="card-head"><h3>Detalle de materias primas</h3><Badge tone="muted">{sel.items.length} referencias</Badge></div>
            <DataTable
              columns={[
                { key: 'producto', label: 'Producto' },
                { key: 'actual', label: 'Stock actual', align: 'right' },
                { key: 'nivel', label: 'Nivel', align: 'right' },
                { key: 'umbral', label: 'Umbral mínimo', align: 'right' },
                { key: 'caducidad', label: 'Caducidad', align: 'right' },
                { key: 'estado', label: 'Estado', align: 'right' },
              ]}
              rows={sel.items.map((it) => {
                const es = estadoDe(it.nivel)
                const cd = cadInfo(cadOf(it))
                return {
                  producto: <span className="cell-plato"><span className="cp-th"><img src={PROD_BY[it.pid]?.foto} alt="" loading="lazy" /></span>{PROD_BY[it.pid]?.name ?? it.pid}</span>,
                  actual: it.actual,
                  nivel: Math.round(it.nivel) + '%',
                  umbral: it.umbral,
                  caducidad: <Badge tone={cd.tone === 'green' ? 'muted' : cd.tone}>⏳ {cd.t}</Badge>,
                  estado: <Badge tone={es.tone}>{es.t}</Badge>,
                }
              })}
            />
          </Card>
        </>
      )}

      {/* ── EDITOR de stock de un producto (recepción de mercancía / ajuste de inventario) ── */}
      {editPid && editProd && (
        <>
          <div className="vtpv-scrim" onClick={() => setEditPid(null)} />
          <div className="vtpv-center">
            <div className="vtpv-z alm-iedit" onClick={(e) => e.stopPropagation()}>
              <div className="vtpv-z-head">
                <div className="alm-ie-id">
                  <span className="alm-ie-ph"><img src={editProd.foto} alt="" draggable={false} /></span>
                  <div className="vtpv-z-id">
                    <span className="vtpv-z-kick">Ajustar stock · {sel.nombre}</span>
                    <b>{editProd.name}</b>
                  </div>
                </div>
                <button className="vtpv-dr-close" onClick={() => setEditPid(null)} aria-label="Cerrar"><Xmark /></button>
              </div>

              <div className="alm-ie-pct" style={{ ['--tone' as string]: toneColor(estadoDe(editPct).tone) } as CSSProperties}>
                <b>{editPct}<i>%</i></b>
                <span className="alm-ie-track"><span className="alm-ie-fill" style={{ width: editPct + '%' }} /></span>
              </div>
              {/* el slider mueve la CANTIDAD real (0 → capacidad); el % sale solo. Debajo: cuánto hay de cuánto. */}
              <input className="alm-ie-range" type="range" min={0} max={editMax} step={editMax / 100} value={idraft.actual}
                onChange={(e) => setIdraft({ ...idraft, actual: Math.round(parseFloat(e.target.value) * 10) / 10 })} aria-label="Stock actual" />
              <div className="alm-ie-readout"><b>{fmtNum(idraft.actual)}</b> de <b>{fmtNum(editMax)}</b> {editProd.unit}</div>
              <div className="alm-ie-quick">
                <button onClick={() => setIdraft({ ...idraft, actual: editMax })}>📦 Lleno · recepción</button>
                <button onClick={() => setIdraft({ ...idraft, actual: Math.min(editMax, idraft.actual + editMax * 0.25) })}>＋25%</button>
                <button onClick={() => setIdraft({ ...idraft, actual: Math.max(0, idraft.actual - editMax * 0.25) })}>−25%</button>
              </div>

              <div className="alm-ie-fields">
                <label className="eb-field"><span>Stock actual <i className="alm-ie-unit">({editProd.unit})</i></span>
                  <input type="number" inputMode="decimal" min={0} value={idraft.actual} onChange={(e) => setIdraft({ ...idraft, actual: numOf(e.target.value) })} />
                </label>
                <label className="eb-field"><span>Capacidad máx. <i className="alm-ie-unit">({editProd.unit})</i></span>
                  <input type="number" inputMode="decimal" min={0} value={idraft.max} onChange={(e) => setIdraft({ ...idraft, max: numOf(e.target.value) })} />
                </label>
                <label className="eb-field"><span>Umbral mínimo <i className="alm-ie-unit">({editProd.unit})</i></span>
                  <input type="number" inputMode="decimal" min={0} value={idraft.umbral} onChange={(e) => setIdraft({ ...idraft, umbral: numOf(e.target.value) })} />
                </label>
              </div>

              <div className="alm-ie-actions">
                <button className="eb-btn danger" onClick={quitarItem}>Quitar producto</button>
                <button className="eb-btn primary" onClick={saveItem}>Guardar stock</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
