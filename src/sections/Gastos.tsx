import { useMemo, useState } from 'react'
import { SectionHeader, Badge, Stat, StatRow } from '../components/ui'
import { play } from '../lib/sound'
import { VENTAS_MES, FOOD_COST_PCT, useRealAgg, salesForMonth, HOY } from '../lib/data'
import { isDemoMode } from '../lib/demo'
import {
  useGastos, addGasto, removeGasto, setGastoBase, setGastoIva, setGastoCat, setGastoConcepto, setGastoDiaPago,
  totalGasto, gastosIvaMes, gastosMes, gastosOrdenados, proximoPago,
  CAT_META, CAT_ORDER, IVA_TIPOS,
} from '../lib/gastos'

/* ════════════════════════════════════════════════════════════════════
   GASTOS FIJOS — combo A+B (Juan, 29-jun, vía skill nuevospaneles). Una sola vista:
   · hero cockpit (Total/mes · próximo pago · % s/ventas con SEMÁFORO · break-even diario)
   · IZQ: calendario de pagos (cuándo) + UNA barra "¿a dónde va?" (dónde)
   · DCHA: lista EDITABLE por vencimiento (qué) — CRUD real (añadir/editar/borrar + IVA + día de pago)
   Barra clicable → MODO FOCO: filtra la lista y atenúa el calendario a esa categoría.
   Paneles a su tamaño (no estiran); la lista scrollea dentro de su tarjeta. ════════════════════════════ */

const e2 = (n: number) => { const neg = n < 0; const [i, d] = Math.abs(n).toFixed(2).split('.'); return (neg ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d }
const mil = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const pct = (n: number) => String(n).replace('.', ',')
const pctOf = (part: number, base: number) => (base > 0 ? Math.round((part / base) * 1000) / 10 : 0)
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
// semáforo de gastos fijos sobre ventas (hostelería): sano ≤18 · aviso ≤25 · alto >25
type Sem = 'pos' | 'warn' | 'neg'
const semGastos = (p: number): Sem => (p <= 18 ? 'pos' : p <= 25 ? 'warn' : 'neg')

export default function Gastos() {
  useRealAgg()
  const gastos = useGastos()
  const demo = isDemoMode()
  const [filtro, setFiltro] = useState<string | null>(null)
  const [draft, setDraft] = useState<null | { id?: string; concepto: string; cat: string; base: string; iva: number; diaPago: string }>(null)

  const year = HOY.getFullYear()
  const month = HOY.getMonth()
  const today = HOY.getDate()
  const diasMes = new Date(year, month + 1, 0).getDate()

  const total = gastosMes()
  const totalIva = gastosIvaMes()
  const ventasMes = demo ? VENTAS_MES : Math.round(salesForMonth(year, month).total)
  const gastosPct = pctOf(total, ventasMes)
  const beDia = Math.round(total / diasMes)
  const ventaCubrir = Math.round(beDia / (1 - FOOD_COST_PCT)) // lo que hay que VENDER/día para cubrir los fijos
  const prox = useMemo(() => proximoPago(today, diasMes), [gastos, today, diasMes])

  // reparto por categoría (una sola barra)
  const cats = useMemo(() => {
    const sums: Record<string, number> = {}
    for (const g of gastos) sums[g.cat] = (sums[g.cat] || 0) + totalGasto(g)
    return CAT_ORDER.map((name) => ({ name, value: sums[name] || 0, color: CAT_META[name].color })).filter((c) => c.value > 0).sort((a, b) => b.value - a.value)
  }, [gastos])

  const orden = useMemo(() => gastosOrdenados(), [gastos])

  // resumen de la categoría enfocada (HUD flotante en modo foco)
  const focoData = useMemo(() => {
    if (!filtro) return null
    const items = gastos.filter((g) => g.cat === filtro)
    if (!items.length) return null
    const tot = items.reduce((s, g) => s + totalGasto(g), 0)
    const sorted = [...items].sort((a, b) => a.diaPago - b.diaPago)
    const prox = sorted.find((g) => g.diaPago >= today) || sorted[0]
    return { tot, share: pctOf(tot, total), n: items.length, prox }
  }, [filtro, gastos, total, today])

  // calendario: por día → total + colores de categoría
  const byDay = useMemo(() => {
    const m: Record<number, { total: number; cats: Set<string> }> = {}
    for (const g of gastos) { const d = g.diaPago; (m[d] ||= { total: 0, cats: new Set() }); m[d].total += totalGasto(g); m[d].cats.add(g.cat) }
    return m
  }, [gastos])
  const lead = (new Date(year, month, 1).getDay() + 6) % 7 // huecos antes del día 1 (lunes primero)
  const celdas: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: diasMes }, (_, i) => i + 1)]
  while (celdas.length % 7 !== 0) celdas.push(null)

  const chipMes = (dia: number) => MES3[(dia >= today ? month : month + 1) % 12]

  function save() {
    if (!draft) return
    const base = Number(draft.base.replace(/[^\d.,]/g, '').replace(',', '.')) || 0
    if (base <= 0 && !draft.id) { play('error', 0.5); return }
    const dia = Number(draft.diaPago) || 1
    if (draft.id) {
      setGastoConcepto(draft.id, draft.concepto); setGastoCat(draft.id, draft.cat)
      setGastoBase(draft.id, base); setGastoIva(draft.id, draft.iva); setGastoDiaPago(draft.id, dia)
    } else {
      addGasto({ concepto: draft.concepto, cat: draft.cat, base, iva: draft.iva, diaPago: dia })
    }
    play('success', 0.5, 1.1); setDraft(null)
  }
  const del = () => { if (draft?.id) { removeGasto(draft.id); play('tap', 0.4); setDraft(null) } }
  const toggleFiltro = (c: string) => { setFiltro((f) => (f === c ? null : c)); play('tap', 0.4) }

  const baseNum = draft ? Number(draft.base.replace(/[^\d.,]/g, '').replace(',', '.')) || 0 : 0

  return (
    <div className={'gastos-full' + (filtro ? ' foco' : '')}>
      <div className="gx-head">
        <SectionHeader
          title="Gastos fijos"
          subtitle="Qué pagas, cuándo te toca y a dónde se va — todo en una vista"
          right={
            <div className="gx-tools">
              <button className="gx-pill" onClick={() => play('tap')} title="Descargar el P&L de gastos en CSV (para tu gestor)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg>Exportar
              </button>
              <button className="gx-pill primary" onClick={() => { setDraft({ concepto: '', cat: 'Otros', base: '', iva: 21, diaPago: '1' }); play('tap', 0.5, 1.15) }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>Añadir gasto
              </button>
              <Badge tone="gold">{MES3[month]} {year}</Badge>
            </div>
          }
        />
      </div>

      {gastos.length === 0 ? (
        <div className="gx-empty">
          <div className="gx-empty-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18v13H3zM3 7l2-3h14l2 3M9 12h6" /></svg></div>
          <b>Aún no tienes gastos fijos</b>
          <p>Añade el alquiler, la luz, los seguros… y verás al momento cuánto pagas al mes, cuándo te toca y a dónde se va.</p>
          <button className="gx-pill primary" onClick={() => setDraft({ concepto: '', cat: 'Otros', base: '', iva: 21, diaPago: '1' })}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>Añadir tu primer gasto
          </button>
        </div>
      ) : (
      <>
      <StatRow className="ped-statrow gx-statrow">
        <Stat className="lead" value={mil(total)} unit="€" label="Gastos fijos / mes" foot={`con IVA · ${mil(totalIva)} € deducible`} />
        <Stat value={prox ? mil(totalGasto(prox.gasto)) : '—'} unit={prox ? '€' : ''} count={!!prox} label="Próximo pago" foot={prox ? `${prox.gasto.concepto} · ${prox.enDias === 0 ? 'hoy' : prox.enDias === 1 ? 'mañana' : 'en ' + prox.enDias + ' días'}` : 'sin pagos'} />
        <Stat className={'gx-sem gx-sem--' + semGastos(gastosPct)} value={pct(gastosPct)} unit="%" label="Sobre tus ventas" foot={gastosPct <= 18 ? 'en zona sana' : gastosPct <= 25 ? 'algo alto · sano ≤18%' : 'alto · revisa'} />
        <Stat value={mil(beDia)} unit="€" label="Cada día que abres" foot={`vende ${mil(ventaCubrir)} € para cubrirlos`} />
      </StatRow>

      <div className="gx-main">
        {/* IZQUIERDA — cuándo (calendario) + dónde (barra única) */}
        <div className="gx-col">
          <div className="panel-card gx-card">
            <div className="gx-card-head"><h3>Calendario de pagos</h3><span className="gx-mut">{MES3[month]} {year}</span></div>
            <div className="gcal-dow">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
            <div className="gcal-grid">
              {celdas.map((d, i) => {
                if (d === null) return <div className="gcal-d empty" key={'e' + i} />
                const info = byDay[d]
                const isToday = d === today
                const dim = !!filtro && (!info || !info.cats.has(filtro))
                const next = prox && prox.gasto.diaPago === d && prox.enDias <= 2
                return (
                  <div className={'gcal-d' + (isToday ? ' today' : '') + (next ? ' next' : '') + (dim ? ' dim' : '')} key={d}>
                    <span className="gcal-dn">{d}{isToday ? ' · hoy' : ''}</span>
                    {info && (
                      <div className="gcal-pay">
                        <span className="gcal-amt" style={next ? { color: 'var(--brand)' } : undefined}>{mil(info.total)}€</span>
                        <span className="gcal-dots">{[...info.cats].slice(0, 3).map((c) => <i key={c} style={{ background: CAT_META[c]?.color }} />)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="panel-card gx-card">
            <div className="gx-card-head"><h3>¿A dónde va?</h3><span className="gx-mut">{mil(total)} €/mes</span></div>
            <div className="gx-bar">
              {cats.map((c) => (
                <button key={c.name} className={'gx-bar-seg' + (filtro && filtro !== c.name ? ' dim' : '') + (filtro === c.name ? ' on' : '')} style={{ flex: c.value, background: c.color, color: c.color }} onClick={() => toggleFiltro(c.name)} title={`${c.name} · ${mil(c.value)} €`} />
              ))}
            </div>
            <div className="gx-leg">
              {cats.map((c) => (
                <button key={c.name} className={'gx-leg-i' + (filtro && filtro !== c.name ? ' dim' : '') + (filtro === c.name ? ' on' : '')} onClick={() => toggleFiltro(c.name)}>
                  <i style={{ background: c.color }} />{c.name} {mil(c.value)}€ · {pctOf(c.value, total)}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* DERECHA — qué (lista editable por vencimiento) */}
        <div className="panel-card gx-card gx-listcard">
          <div className="gx-card-head">
            <h3>Tus gastos</h3>
            {filtro ? (
              <button className="gx-clear" onClick={() => setFiltro(null)}>Filtrando: {filtro} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
            ) : <span className="gx-mut">por vencimiento · toca para editar</span>}
          </div>
          <div className="gx-list">
            {orden.map((g) => {
              const dim = !!filtro && g.cat !== filtro
              const soon = prox && prox.gasto.id === g.id && prox.enDias <= 2
              return (
                <button className={'gx-g' + (dim ? ' dim' : '') + (soon ? ' soon' : '')} key={g.id} onClick={() => setDraft({ id: g.id, concepto: g.concepto, cat: g.cat, base: String(g.base), iva: g.iva, diaPago: String(g.diaPago) })} title="Editar">
                  <span className="gx-day"><b>{g.diaPago}</b><i>{chipMes(g.diaPago)}</i></span>
                  <span className="gx-g-main">
                    <span className="gx-g-name"><i className="gx-dot" style={{ background: CAT_META[g.cat]?.color }} />{g.concepto}</span>
                    <span className="gx-g-sub">{g.cat}</span>
                  </span>
                  <span className="gx-g-iva">{g.iva ? 'IVA ' + g.iva + '%' : 'sin IVA'}</span>
                  <span className="gx-g-amt tnum">{mil(totalGasto(g))}<i>€</i></span>
                </button>
              )
            })}
          </div>
          <div className="gx-list-foot">
            <button className="gx-add" onClick={() => setDraft({ concepto: '', cat: 'Otros', base: '', iva: 21, diaPago: '1' })}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>Añadir gasto
            </button>
            <span className="gx-tot">{gastos.length} conceptos · <b>{mil(total)} €/mes</b></span>
          </div>
        </div>

        {/* HUD flotante: resumen de la categoría enfocada (modo foco) */}
        {filtro && focoData && (
          <div className="gx-foco" style={{ ['--c' as string]: CAT_META[filtro]?.color }}>
            <span className="gx-foco-cat"><i style={{ background: CAT_META[filtro]?.color }} />{filtro}</span>
            <span className="gx-foco-sep" />
            <span className="gx-foco-stat"><b className="tnum">{mil(focoData.tot)}€</b><i>al mes</i></span>
            <span className="gx-foco-stat"><b className="tnum">{focoData.share}%</b><i>del total</i></span>
            <span className="gx-foco-stat"><b className="tnum">{focoData.n}</b><i>recibo{focoData.n !== 1 ? 's' : ''}</i></span>
            {focoData.prox && <span className="gx-foco-stat"><b className="tnum">día {focoData.prox.diaPago}</b><i>próximo</i></span>}
            <button className="gx-foco-x" onClick={() => setFiltro(null)} aria-label="Quitar foco"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          </div>
        )}
      </div>
      </>
      )}

      {/* ── MODAL alta/edición ── */}
      {draft && (
        <>
          <div className="gx-scrim" onClick={() => setDraft(null)} />
          <div className="gx-modal">
            <div className="gx-modal-head">
              <div><span className="gx-modal-kick">{draft.id ? 'Editar gasto' : 'Nuevo gasto fijo'}</span><b>{draft.concepto || 'Sin nombre'}</b></div>
              <button className="gx-x" onClick={() => setDraft(null)} aria-label="Cerrar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
            </div>
            <label className="gx-f"><span>Concepto</span><input value={draft.concepto} onChange={(e) => setDraft({ ...draft, concepto: e.target.value })} placeholder="Alquiler, Luz, Seguro…" autoFocus /></label>
            <label className="gx-f"><span>Categoría</span>
              <div className="gx-cats-pick">
                {CAT_ORDER.map((c) => (
                  <button key={c} type="button" className={'gx-cat-opt' + (draft.cat === c ? ' on' : '')} style={draft.cat === c ? { ['--c' as string]: CAT_META[c].color, borderColor: CAT_META[c].color, color: CAT_META[c].color } : undefined} onClick={() => setDraft({ ...draft, cat: c })}>
                    <i style={{ background: CAT_META[c].color }} />{c}
                  </button>
                ))}
              </div>
            </label>
            <div className="gx-f-row">
              <label className="gx-f"><span>Base imponible (€)</span><input className="tnum" inputMode="decimal" value={draft.base} onChange={(e) => setDraft({ ...draft, base: e.target.value })} placeholder="0" /></label>
              <label className="gx-f"><span>IVA</span><select value={draft.iva} onChange={(e) => setDraft({ ...draft, iva: Number(e.target.value) })}>{IVA_TIPOS.map((v) => <option key={v} value={v}>{v}%</option>)}</select></label>
              <label className="gx-f gx-f-dia"><span>Día de pago</span><input className="tnum" inputMode="numeric" value={draft.diaPago} onChange={(e) => setDraft({ ...draft, diaPago: e.target.value.replace(/\D/g, '').slice(0, 2) })} placeholder="1" /></label>
            </div>
            <div className="gx-prev"><span>Total con IVA</span><b className="tnum">{e2(baseNum + (baseNum * draft.iva) / 100)} €</b></div>
            <div className="gx-modal-actions">
              {draft.id && <button className="gx-del" onClick={del}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2m-9 0v14h10V6" /></svg>Borrar</button>}
              <button className="gx-save" onClick={save}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>{draft.id ? 'Guardar cambios' : 'Guardar gasto'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
