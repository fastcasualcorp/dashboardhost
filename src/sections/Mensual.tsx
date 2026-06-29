import { useEffect, useState } from 'react'
import { SectionHeader, Badge, Stat, StatRow, DataTable, Money, type Column } from '../components/ui'
import { VENTAS_MES, FOOD_COST_PCT, useRealAgg, salesForMonth, HOY } from '../lib/data'
import { useEquipo, costeMes } from '../lib/equipo'
import { useGastos, gastosMes } from '../lib/gastos'
import { isDemoMode } from '../lib/demo'
import { useRevealOnce } from '../lib/reveal'
import { play } from '../lib/sound'

/* ════════════════════════════════════════════════════════════════════
   RESUMEN MENSUAL — cockpit de UNA SOLA VISTA (cabe sin scroll). Histórico DERIVADO de las mismas
   fuentes únicas que el resto del panel: ventas (rampa→VENTAS_MES en demo / reales), compras = ventas×food
   cost (ESTIMACIÓN s/food cost; el cuadre real por mes llega con histórico real), gastos (lib/gastos),
   personal (Σ lib/equipo), neto = ventas−compras−gastos−personal.
   Lectura para el dueño: cada coste con su % SOBRE VENTAS y SEMÁFORO (verde/ámbar/rojo, umbrales de
   hostelería), margen vs OBJETIVO, PROYECCIÓN de cierre, DRILL-DOWN (clic→pestaña) y EXPORTAR CSV.
   Color semántico: suma/beneficio verde (pos), gasto/negativo rojo (neg). Animación 1ª vez por sesión.
   ════════════════════════════════════════════════════════════════════ */

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio']
const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun']
const PROY_MESES = ['Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const PROY_CORTO = ['Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const FACTOR = [0.8, 0.84, 0.88, 0.92, 0.96, 1.0]
const OBJ_MARGEN = 20 // objetivo de margen neto (% s/ventas) — referencia, editable a futuro

// € con miles SIEMPRE (es-ES no agrupa 4 cifras: "9306"→forzamos "9.306,14"). Con decimales para el P&L.
const e2 = (n: number) => {
  const neg = n < 0
  const [int, dec] = Math.abs(n).toFixed(2).split('.')
  return (neg ? '-' : '') + int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec
}
// entero redondeado con miles forzados ("2.843", "34.697"). mil() ya trae el '-' en negativos.
const mil = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
// signo explícito (+/−) para etiquetas y deltas (sin doble signo en negativos).
const signed = (n: number) => (n >= 0 ? '+' : '') + mil(n)
const pct = (n: number) => String(n).replace('.', ',')
const pctOf = (part: number, base: number) => (base > 0 ? Math.round((part / base) * 1000) / 10 : 0)
// etiqueta del eje € ("10k", "50k")
const kfmt = (v: number) => (v >= 1000 ? String(Math.round(v / 100) / 10).replace('.', ',') + 'k' : String(Math.round(v)))
// semáforo de hostelería: cada coste tiene su umbral sano/aviso/peligro (% s/ventas)
type Sem = 'pos' | 'warn' | 'neg'
const semCompras = (p: number): Sem => (p <= 30 ? 'pos' : p <= 35 ? 'warn' : 'neg')
const semGastos = (p: number): Sem => (p <= 15 ? 'pos' : p <= 20 ? 'warn' : 'neg')
const semPersonal = (p: number): Sem => (p <= 30 ? 'pos' : p <= 33 ? 'warn' : 'neg')
const semMargen = (p: number): Sem => (p >= OBJ_MARGEN ? 'pos' : p >= 10 ? 'warn' : 'neg')

const goto = (id: string) => { window.dispatchEvent(new CustomEvent('rebell:goto', { detail: id })); play('tap', 0.4) }

export default function Mensual() {
  useRealAgg() // facturación mensual REAL en modo real
  const roster = useEquipo() // editar un sueldo recalcula el histórico
  useGastos() // editar un gasto recalcula el histórico
  const demo = isDemoMode()
  const reveal = useRevealOnce('mensual') // anima la 1ª vez por sesión; estático al volver
  const [expand, setExpand] = useState(false)
  const [proj, setProj] = useState(true) // proyección de cierre (barras fantasma Jul–Dic) — visible por defecto
  // El gesto de entrada vive SOLO durante la animación (1,2s); luego se quita la clase → alternar el
  // desplegable u otros re-renders ya no re-animan (estático, no satura).
  const [anim, setAnim] = useState(reveal)
  useEffect(() => {
    if (!reveal) return
    const t = setTimeout(() => setAnim(false), 1200)
    return () => clearTimeout(t)
  }, [reveal])

  const personal = roster.reduce((s, e) => s + costeMes(e), 0)
  const gastos = gastosMes()
  const year = HOY.getFullYear()

  const filas = MESES.map((mes, i) => {
    const ventas = demo ? Math.round(VENTAS_MES * FACTOR[i]) : Math.round(salesForMonth(year, i).total)
    const compras = Math.round(ventas * FOOD_COST_PCT)
    const neto = ventas - compras - gastos - personal
    return { mes, corto: MES_CORTO[i], ventas, compras, gastos, personal, neto, margenPct: pctOf(neto, ventas) }
  })

  const ytd = filas.reduce((s, f) => s + f.ventas, 0)
  const netoYTD = filas.reduce((s, f) => s + f.neto, 0)
  const totCompras = filas.reduce((s, f) => s + f.compras, 0)
  const totGastos = filas.reduce((s, f) => s + f.gastos, 0)
  const totPersonal = filas.reduce((s, f) => s + f.personal, 0)
  const mejor = filas.slice().sort((a, b) => b.ventas - a.ventas)[0]
  const margenAgg = pctOf(netoYTD, ytd) // margen real del año (acumulado)
  const jun = filas[filas.length - 1]
  const may = filas[filas.length - 2]
  const crecimiento = may.ventas > 0 ? Math.round(((jun.ventas - may.ventas) / may.ventas) * 1000) / 10 : 0
  const up = crecimiento >= 0
  const enBeneficio = netoYTD >= 0
  // % sobre ventas (el idioma de la hostelería) + proyección de cierre (run-rate del año a 12 meses)
  const foodPct = pctOf(totCompras, ytd)
  const gastosPct = pctOf(totGastos, ytd)
  const personalPct = pctOf(totPersonal, ytd)

  // PROYECCIÓN "a este ritmo" (Jul–Dic): se continúa la tendencia de ventas observada (pendiente media de
  // los meses reales) y se aplica el MISMO modelo de coste que los meses reales (food cost + gastos + personal)
  // → beneficio proyectado coherente, claramente etiquetado como proyección (no se hace pasar por real).
  const realN = filas.length
  const slope = realN > 1 ? (filas[realN - 1].ventas - filas[0].ventas) / (realN - 1) : 0
  const proyFilas = PROY_MESES.map((mes, k) => {
    const ventas = Math.max(0, Math.round(filas[realN - 1].ventas + slope * (k + 1)))
    const neto = Math.round(ventas - ventas * FOOD_COST_PCT - gastos - personal)
    return { mes, corto: PROY_CORTO[k], ventas, neto, proy: true as const }
  })
  const proyAnual = netoYTD + proyFilas.reduce((s, f) => s + f.neto, 0) // cierre proyectado del año completo
  const chartData = proj ? [...filas.map((f) => ({ ...f, proy: false })), ...proyFilas] : filas.map((f) => ({ ...f, proy: false }))

  // Eje € del gráfico: paso "bonito" y un poco de aire por encima de la barra más alta (para la etiqueta).
  const maxVentas = Math.max(...chartData.map((f) => f.ventas), 0)
  const rough = (maxVentas * 1.08) / 5 || 2000
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const STEP = Math.ceil(rough / mag) * mag
  const axisMax = Math.max(STEP, Math.ceil((maxVentas * 1.08) / STEP) * STEP)
  const gridVals: number[] = []
  for (let v = axisMax; v >= 0; v -= STEP) gridVals.push(v)

  const cols: Column[] = [
    { key: 'mes', label: 'Mes' },
    { key: 'ventas', label: 'Ventas', align: 'right' },
    { key: 'compras', label: 'Compras', align: 'right' },
    { key: 'gastos', label: 'Gastos fijos', align: 'right' },
    { key: 'personal', label: 'Personal', align: 'right' },
    { key: 'neto', label: 'Resultado', align: 'right' },
    { key: 'margen', label: 'Margen', align: 'right' },
  ]
  // verde = suma (ventas, beneficio) · rojo = resta (compras, gastos, personal) → lectura de un vistazo
  const rows = [
    ...filas.map((f) => ({
      mes: f.mes,
      ventas: <Money value={e2(f.ventas)} unit="€" />,
      compras: <Money value={e2(f.compras)} unit="€" tone="neg" />,
      gastos: <Money value={e2(f.gastos)} unit="€" tone="neg" />,
      personal: <Money value={e2(f.personal)} unit="€" tone="neg" />,
      neto: <Money value={e2(f.neto)} unit="€" tone={f.neto >= 0 ? 'pos' : 'neg'} />,
      margen: <span className={'men-pctt men-pctt--' + semMargen(f.margenPct)}>{pct(f.margenPct)}%</span>,
    })),
    {
      mes: <b>Total año</b>,
      ventas: <Money value={e2(ytd)} unit="€" />,
      compras: <Money value={e2(totCompras)} unit="€" tone="neg" />,
      gastos: <Money value={e2(totGastos)} unit="€" tone="neg" />,
      personal: <Money value={e2(totPersonal)} unit="€" tone="neg" />,
      neto: <Money value={e2(netoYTD)} unit="€" tone={netoYTD >= 0 ? 'pos' : 'neg'} />,
      margen: <span className={'men-pctt men-pctt--' + semMargen(margenAgg)}>{pct(margenAgg)}%</span>,
    },
  ]

  // P&L resumido: cada celda con su % s/ventas + semáforo, y clic → su pestaña (drill-down).
  const csum: { k: string; v: string; tone?: 'pos' | 'neg'; sub: string; semColor: Sem | 'muted'; go: string | null }[] = [
    { k: 'Ventas', v: mil(ytd), sub: 'facturación', semColor: 'muted', go: 'ventas' },
    { k: 'Compras', v: mil(totCompras), tone: 'neg', sub: `${pct(foodPct)}% s/ventas`, semColor: semCompras(foodPct), go: 'compras' },
    { k: 'Gastos fijos', v: mil(totGastos), tone: 'neg', sub: `${pct(gastosPct)}% s/ventas`, semColor: semGastos(gastosPct), go: 'gastos' },
    { k: 'Coste personal', v: mil(totPersonal), tone: 'neg', sub: `${pct(personalPct)}% s/ventas`, semColor: semPersonal(personalPct), go: 'coste' },
    { k: 'Beneficio neto', v: mil(netoYTD), tone: netoYTD >= 0 ? 'pos' : 'neg', sub: `${pct(margenAgg)}% margen`, semColor: semMargen(margenAgg), go: null },
  ]

  function exportCSV() {
    const head = ['Mes', 'Ventas', 'Compras', 'Gastos fijos', 'Coste personal', 'Resultado neto', 'Margen %']
    const body = filas.map((f) => [f.mes, f.ventas, f.compras, f.gastos, f.personal, f.neto, pct(f.margenPct)])
    body.push(['Total año', ytd, totCompras, totGastos, totPersonal, netoYTD, pct(margenAgg)])
    const csv = [head, ...body].map((r) => r.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rebell-pyl-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
    play('success', 0.5, 1.1)
  }

  return (
    <div className={'mensual-full' + (anim ? ' anim' : '')}>
      <div className="m-rise" style={{ ['--i' as string]: 0 }}>
        <SectionHeader
          title="Resumen mensual"
          subtitle="Histórico por meses · derivado de tus ventas, plantilla y gastos"
          right={
            <div className="men-head-tools">
              <button className="men-export" onClick={exportCSV} title="Descargar el P&L en CSV (para tu gestor)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg>
                Exportar
              </button>
              <Badge tone="gold">Ene – Jun {year}</Badge>
            </div>
          }
        />
      </div>

      {/* HERO — 4 cifras únicas (Stat): beneficio del año (lima, con proyección de cierre), ventas, margen vs
          objetivo (color), mejor mes */}
      <div className="m-rise" style={{ ['--i' as string]: 1 }}>
        <StatRow className="ped-statrow men-statrow">
          <Stat className={'lead' + (enBeneficio ? '' : ' neg')} value={mil(netoYTD)} unit="€" label={enBeneficio ? 'Beneficio del año' : 'Pérdida del año'} count={reveal} foot={`proyección cierre ~${mil(proyAnual)} €`} />
          <Stat value={mil(ytd)} unit="€" label="Ventas YTD" count={reveal} delta={`${up ? '+' : ''}${pct(crecimiento)}%`} foot="vs mes anterior" trend={up ? 'up' : 'down'} />
          <Stat value={pct(margenAgg)} unit="%" label="Margen neto" count={reveal} delta={`${margenAgg >= OBJ_MARGEN ? '+' : ''}${pct(Math.round((margenAgg - OBJ_MARGEN) * 10) / 10)} pts`} foot={`objetivo ${OBJ_MARGEN}%`} trend={margenAgg >= OBJ_MARGEN ? 'up' : 'down'} />
          <Stat value={mejor.mes} count={false} label="Mejor mes" foot={`${mil(mejor.ventas)} € · récord`} />
        </StatRow>
      </div>

      {/* GRÁFICA — "de cada mes, cuánto se queda": barra = facturación (eje €), punta lima = beneficio.
          Clic en un mes → la pestaña Ventas. Al desplegar la tabla se oculta (la tabla ya cuenta los meses). */}
      {!expand && (
      <div className="panel-card pad men-year m-rise" style={{ ['--i' as string]: 2 }}>
        <div className="card-head">
          <h3>De cada mes, cuánto se queda</h3>
          <div className="men-chart-tools">
            <button className={'men-toggle' + (proj ? ' on' : '')} onClick={() => { setProj((p) => !p); play('tap', 0.4) }} aria-pressed={proj} title="Mostrar la proyección de cierre (Jul–Dic, a este ritmo)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 7-7M14 7h7v7" /></svg>
              Proyección
            </button>
            <Badge tone={up ? 'green' : 'amber'}>{up ? 'tendencia al alza' : 'a la baja'}</Badge>
          </div>
        </div>
        <div className="men-chart">
          <div className="men-grid" aria-hidden="true">
            {gridVals.map((v) => (
              <div className="men-gl" key={v} style={{ top: ((1 - v / axisMax) * 100).toFixed(1) + '%' }}>
                <span className="men-gly">{kfmt(v)}{v > 0 && <i>€</i>}</span>
              </div>
            ))}
          </div>
          <div className="men-bars">
            {proj && <div className="men-proj-divider" aria-hidden="true" style={{ left: `calc(${(realN / chartData.length) * 100}% )` }} />}
            {chartData.map((f, i) => {
              const barH = (f.ventas / axisMax) * 100
              const profFrac = f.ventas > 0 ? Math.max(0, (f.neto / f.ventas) * 100) : 0
              const hot = i === realN - 1
              const ghost = f.proy
              return (
                <button className={'men-col' + (hot ? ' hot' : '') + (ghost ? ' proy' : '')} key={f.corto} onClick={() => goto('ventas')} title={ghost ? `${f.mes} · proyección a este ritmo` : `Ver ventas de ${f.mes}`}>
                  <span className="men-plabel m-fade" style={{ ['--i' as string]: i }}>{signed(f.neto)} €</span>
                  <div className="men-bar m-bar" style={{ height: barH.toFixed(1) + '%', ['--i' as string]: i }}>
                    <div className="men-prof" style={{ height: profFrac.toFixed(1) + '%' }} />
                    <div className="men-cost" style={{ height: (100 - profFrac).toFixed(1) + '%' }} />
                  </div>
                </button>
              )
            })}
          </div>
          <div className="men-xlabels">
            {chartData.map((f) => (<span key={f.corto} className={f.proy ? 'proy' : ''}>{chartData.length > 6 ? f.corto : f.mes}</span>))}
          </div>
        </div>
        <div className="men-legend">
          <span><i className="lp" />Beneficio (lo que se queda)</span>
          <span><i className="lc" />Costes · compras + gastos + personal</span>
          {proj && <span><i className="lpr" />Proyección · a este ritmo cierras en ~{mil(proyAnual)} €</span>}
          <span className="men-legend-note">Compras estimadas s/food cost {Math.round(FOOD_COST_PCT * 100)}%</span>
        </div>
      </div>
      )}

      {/* P&L — resumen del año (cada línea con % s/ventas + semáforo, clic→pestaña) + desplegar los 6 meses. */}
      <div className={'panel-card pad men-pl m-rise' + (expand ? ' expanded' : '')} style={{ ['--i' as string]: 3 }}>
        <div className="card-head">
          <h3>Cuentas del año · P&amp;L</h3>
          <button className={'men-expand' + (expand ? ' on' : '')} onClick={() => setExpand((e) => !e)} aria-expanded={expand}>
            {expand ? 'Ocultar meses' : 'Ver los 6 meses'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>
        {expand ? (
          <div className="men-pl-table">
            <DataTable columns={cols} rows={rows} />
          </div>
        ) : (
          <div className="men-csum">
            {csum.map((c) => {
              const inner = (
                <>
                  <span className="k">{c.k}</span>
                  <span className="v"><Money value={c.v} unit="€" tone={c.tone} /></span>
                  <span className={'men-pct men-pct--' + c.semColor}>{c.sub}</span>
                </>
              )
              return c.go ? (
                <button key={c.k} className="men-csum-cell clickable" onClick={() => goto(c.go as string)} title={`Ver ${c.k}`}>{inner}</button>
              ) : (
                <div key={c.k} className="men-csum-cell">{inner}</div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
