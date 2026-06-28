import { useState } from 'react'
import { Card, SectionHeader, Donut, CountValue, BarChart, BarRow, DataTable, Badge, Grid, KpiTile } from '../components/ui'
import DatePicker, { rangeFor, type RangeSel } from '../components/DatePicker'
import { eur, eur0, VENTAS_MES, FOOD_COST_PCT, useRealAgg, salesForDay } from '../lib/data'
import { isDemoMode } from '../lib/demo'
import { useEquipo, costeMes } from '../lib/equipo'
import { useGastos, gastosMes } from '../lib/gastos'
import { useFoodcost, fcMedio } from '../lib/foodcost'
import { imgFor } from '../lib/products'
import WaterfallPL from '../components/WaterfallPL'

const RANGE_DAYS: Record<string, number> = { hoy: 1, ayer: 1, semana: 5, semanaant: 7, mes: 22, mesant: 30, trimestre: 91, anio: 173, historico: 540 }

// Título del gráfico por rango (común a demo y real).
function chartTitle(key: string): string {
  if (key === 'hoy' || key === 'ayer') return 'Ventas por franja'
  if (key === 'semana' || key === 'semanaant') return 'Ventas por día'
  if (key === 'mes' || key === 'mesant') return 'Ventas por semana'
  return 'Ventas por mes'
}

// DEMO: serie fabricada con pesos (escaparate). NO se usa en real.
function seriesForDemo(key: string, ventas: number) {
  const title = chartTitle(key)
  let labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun']
  let weights = [0.14, 0.15, 0.16, 0.17, 0.18, 0.2]
  if (key === 'hoy' || key === 'ayer') {
    labels = ['12h', '14h', '16h', '18h', '20h', '22h']
    weights = [0.12, 0.22, 0.1, 0.14, 0.28, 0.14]
  } else if (key === 'semana' || key === 'semanaant') {
    labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    weights = [0.11, 0.12, 0.13, 0.14, 0.18, 0.18, 0.14]
  } else if (key === 'mes' || key === 'mesant') {
    labels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5']
    weights = [0.2, 0.22, 0.21, 0.24, 0.13]
  } else if (key === 'trimestre') {
    labels = ['Abr', 'May', 'Jun']
    weights = [0.32, 0.33, 0.35]
  }
  return { title, data: labels.map((l, i) => ({ label: l, value: Math.round(ventas * weights[i]) })) }
}

// Suma las ventas REALES (salesForDay) entre dos fechas inclusive. Sin datos → 0 honesto (nunca NaN).
function realVentasRange(start: Date, end: Date): number {
  let total = 0
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  let guard = 0
  while (d <= last && guard < 800) {
    const s = salesForDay(d.getFullYear(), d.getMonth(), d.getDate())
    if (s) total += s.total
    d.setDate(d.getDate() + 1)
    guard++
  }
  return total
}

// REAL: serie por día con ventas reales del rango (un punto por día). Sin datos → barras a 0 honestas.
function seriesForReal(key: string, start: Date, end: Date) {
  const WD = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const data: { label: string; value: number }[] = []
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  let guard = 0
  while (d <= last && guard < 800) {
    const s = salesForDay(d.getFullYear(), d.getMonth(), d.getDate())
    data.push({ label: `${WD[d.getDay()]} ${d.getDate()}`, value: s ? s.total : 0 })
    d.setDate(d.getDate() + 1)
    guard++
  }
  return { title: chartTitle(key), data }
}

function dataFor(key: string, demo: boolean, range: RangeSel) {
  if (demo) {
    const days = RANGE_DAYS[key] ?? 22
    // 'mes' usa la facturación mensual ÚNICA (misma que el P&L y Coste → el héroe y el P&L ya NO se contradicen)
    const ventas = key === 'hoy' ? 1787 : key === 'mes' || key === 'mesant' ? VENTAS_MES : Math.round(1426 * days * (0.95 + (days % 4) * 0.012))
    const pedidos = Math.round(ventas / 21.28)
    const ticket = pedidos ? ventas / pedidos : 0 // sin pedidos → 0 (no NaN)
    const margen = ventas ? Math.min(72, 60 + Math.round(Math.log2(days + 1))) : 0
    return { ventas, pedidos, ticket, margen, chart: seriesForDemo(key, ventas) }
  }
  // REAL: ventas del store por rango. 'mes' = VENTAS_MES (suma real del RPC); resto = suma real de salesForDay.
  // pedidos/ticket/margen NO tienen fuente real por rango → 0 honesto (la UI muestra "—" donde toque).
  const ventas = key === 'mes' || key === 'mesant' ? VENTAS_MES : realVentasRange(range.start, range.end)
  return { ventas, pedidos: 0, ticket: 0, margen: 0, chart: seriesForReal(key, range.start, range.end) }
}

const CANALES = [
  { l: 'Local / TPV', v: 742, c: 'local', logo: '' },
  { l: 'Glovo', v: 486, c: 'glovo', logo: '/img/brands/glovo.svg' },
  { l: 'Uber Eats', v: 358, c: 'ubereats', logo: '/img/brands/ubereats.svg' },
  { l: 'Just Eat', v: 201, c: 'justeat', logo: '/img/brands/justeat.svg' },
]
const TOP = [
  { plato: 'REBELL Classic', uds: 38, ventas: 418 },
  { plato: 'Doble Bacon', uds: 27, ventas: 351 },
  { plato: 'Crispy Chicken', uds: 22, ventas: 264 },
  { plato: 'Patatas Rebell', uds: 41, ventas: 184.5 },
  { plato: 'Veggie Deluxe', uds: 14, ventas: 168 },
]

// ── Cuenta de resultados del mes (absorbida del antiguo "Cuadro de mando", ahora integrada aquí) ──
const columnasPL = [
  { key: 'concepto', label: 'Concepto' },
  { key: 'importe', label: 'Importe (€)', align: 'right' as const },
  { key: 'pct', label: '% s/ventas', align: 'right' as const },
]
export default function Resumen() {
  const demo = isDemoMode() // DEMO = escaparate (datos de ejemplo); REAL = solo datos del store
  useRealAgg() // P&L con facturación REAL en modo real (RPC); demo = escaparate
  const init = rangeFor('mes')
  const [range, setRange] = useState<RangeSel>({ key: 'mes', label: 'Este mes', start: init.start, end: init.end })
  const d = dataFor(range.key, demo, range)
  const f = demo ? d.ventas / 1787 : 0 // factor de escala SOLO para los canales/top demo (datos de ejemplo)

  // ── Cuenta de resultados del MES, DERIVADA y consistente (mismas cifras en héroe, KPIs, cascada y tabla) ──
  const roster = useEquipo()
  useGastos() // suscribe: editar un gasto recalcula el P&L
  useFoodcost() // suscribe: editar el escandallo (Food cost) recalcula el P&L
  // P&L con DATOS REALES de cada sección: personal (equipo), gastos (gastos fijos), food cost (escandallo).
  const fcPct = (fcMedio() || FOOD_COST_PCT * 100) / 100 // % real del escandallo; si aún no hay, el objetivo
  const plPersonal = roster.reduce((s, e) => s + costeMes(e), 0) // = Coste personal (fuente única equipo)
  const plFood = Math.round(VENTAS_MES * fcPct)
  const plGastos = gastosMes() // = Gastos fijos (fuente única gastos, total con IVA)
  const plNeto = VENTAS_MES - plPersonal - plFood - plGastos
  // % sobre facturación: indefinido si no hay ventas → 0 numérico / "—" en texto (nunca Infinity)
  const plPct = (n: number) => (VENTAS_MES ? Math.round((n / VENTAS_MES) * 1000) / 10 : 0)
  const plPctTxt = (n: number) => (VENTAS_MES ? plPct(n) + '%' : '—')
  const filasPL = [
    { concepto: 'Facturación', importe: `${eur0(VENTAS_MES)},00 €`, pct: <Badge tone="gold">{VENTAS_MES ? '100%' : '—'}</Badge> },
    { concepto: 'Coste de personal', importe: `${eur0(plPersonal)} €`, pct: <Badge tone="blue">{plPctTxt(plPersonal)}</Badge> },
    { concepto: 'Compras (food cost)', importe: `${eur0(plFood)} €`, pct: <Badge tone="amber">{plPctTxt(plFood)}</Badge> },
    { concepto: 'Gastos fijos', importe: `${eur0(plGastos)} €`, pct: <Badge tone="muted">{plPctTxt(plGastos)}</Badge> },
    { concepto: 'Resultado neto', importe: `${eur0(plNeto)} €`, pct: <Badge tone="green">{plPctTxt(plNeto)}</Badge> },
  ]
  const rangeLow = range.label.toLowerCase()
  const hasVentas = d.ventas > 0
  // "Salud del negocio" (0-100). DEMO: margen + ticket vs objetivo (escaparate). Sin ventas → 0 (no NaN).
  // REAL: no hay margen/ticket por rango → proxy honesto = margen neto REAL del mes (P&L) vs meta 20%.
  const score = !hasVentas
    ? 0
    : demo
      ? Math.max(20, Math.min(98, Math.round(d.margen * 0.9 + (d.ticket / 19.5) * 28)))
      : Math.max(5, Math.min(98, Math.round((plPct(plNeto) / 20) * 80)))
  const scoreLabel = !hasVentas ? 'Sin ventas' : score >= 85 ? 'Excelente' : score >= 70 ? 'Buena' : score >= 50 ? 'Estable' : 'Atención'
  const scoreTone: 'green' | 'amber' | 'red' = !hasVentas ? 'red' : score >= 70 ? 'green' : score >= 50 ? 'amber' : 'red'

  return (
    <div className="section">
      <SectionHeader title="Resumen" subtitle={`La salud del negocio · ${rangeLow}`} right={<DatePicker value={range} onApply={setRange} />} />

      {/* HÉROE: ventas gigantes (count-up) + gauge de salud + stats clave (menos recuadros) */}
      <div className="rs-hero">
        <div className="rs-hero-main">
          <span className="rs-kick">◢ Salud del negocio · {rangeLow}</span>
          <div className="rs-big">
            <b className="rs-amount tnum"><CountValue value={eur0(d.ventas)} /></b>
            <span className="rs-unit">€</span>
            {demo && hasVentas && <span className="rs-delta up">▲ +9,0%</span>}
          </div>
          <div className="rs-mini">
            <div className="rs-m"><span>Margen</span><b className="tnum">{demo ? <CountValue value={d.margen + '%'} /> : '—'}</b></div>
            <div className="rs-m"><span>Pedidos</span><b className="tnum">{demo ? <CountValue value={eur0(d.pedidos)} /> : '—'}</b></div>
            <div className="rs-m"><span>Ticket medio</span><b className="tnum">{demo ? <CountValue value={eur(d.ticket) + ' €'} /> : '—'}</b></div>
          </div>
        </div>
        <div className="rs-hero-gauge">
          <Donut value={score} label={scoreLabel} sub="índice de salud" tone={scoreTone} />
        </div>
      </div>

      {/* CUENTA DE RESULTADOS (antes "Cuadro de mando", ahora dentro del Resumen) */}
      <div className="rs-pl-head">
        <h2 className="rs-h2">Cuenta de resultados</h2>
        <Badge tone="gold">Junio 2026</Badge>
      </div>
      <Grid cols={4} className="kpi-grid">
        <KpiTile label="Facturación" value={eur0(VENTAS_MES)} unit="€" delta={demo && hasVentas ? '+6,3%' : undefined} foot="vs mes anterior" trend="up" />
        <KpiTile label="Coste de personal" value={eur0(plPersonal)} unit="€" delta={VENTAS_MES ? plPctTxt(plPersonal) : undefined} foot="s/ventas" trend="flat" />
        <KpiTile label="Food cost" value={String(Math.round(fcPct * 100))} unit="%" delta="escandallo" foot="real de la carta" trend="up" />
        <KpiTile label="Resultado neto" value={eur0(plNeto)} unit="€" delta={VENTAS_MES ? plPctTxt(plNeto) : undefined} foot="margen del mes" trend="up" />
      </Grid>

      {/* CASCADA: cómo la facturación se convierte en beneficio (la estrella del Resumen) */}
      <Card>
        <div className="card-head">
          <h3>De la facturación al beneficio</h3>
          <Badge tone="green">{plPctTxt(plNeto)} margen neto</Badge>
        </div>
        <WaterfallPL facturacion={VENTAS_MES} personal={plPersonal} foodCost={plFood} gastos={plGastos} />
      </Card>

      <Grid cols={2}>
        <Card>
          <div className="card-head">
            <h3>Margen neto</h3>
            <Badge tone="green">{plPctTxt(plNeto)} s/facturación</Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.4rem', padding: '0.5rem 0.25rem', flexWrap: 'wrap' }}>
            <Donut value={VENTAS_MES ? Math.round((plNeto / VENTAS_MES) * 100) : 0} label="margen neto" sub="sobre facturación" tone="green" />
            <p className="muted-s" style={{ flex: '1 1 160px', lineHeight: 1.5, margin: 0 }}>
              {VENTAS_MES ? (
                <>
                  Por cada 100 € facturados, <strong style={{ color: 'var(--brand)' }}>{plPct(plNeto)} € son beneficio real</strong> tras costes y gastos.
                  Meta mensual: 20%.
                </>
              ) : (
                <>Aún no hay ventas registradas este mes. Cuando entren, aquí verás cuánto de cada 100&nbsp;€ es beneficio real.</>
              )}
            </p>
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <h3>Cuenta de resultados — detalle</h3>
            <Badge tone="muted">Junio 2026</Badge>
          </div>
          <DataTable columns={columnasPL} rows={filasPL} />
        </Card>
      </Grid>

      {/* VENTAS por periodo + reparto por canal (dinámicos según el selector) */}
      <Grid cols={2}>
        <Card>
          <div className="card-head">
            <h3>{d.chart.title}</h3>
            <Badge tone="gold">{range.label}</Badge>
          </div>
          <BarChart data={d.chart.data} />
        </Card>

        <Card>
          <div className="card-head">
            <h3>Reparto por canal</h3>
            <span className="muted-s">{rangeLow}</span>
          </div>
          {demo ? (
            <div className="bar-rows">
              {CANALES.map((c) => (
                <BarRow key={c.l} value={c.v * f} max={742 * f || 1} color={c.c} amount={eur0(c.v * f) + ' €'}
                  label={<span className="rs-canal-lbl">{c.logo && <span className="rs-canal-logo"><img src={c.logo} alt="" /></span>}{c.l}</span>} />
              ))}
            </div>
          ) : (
            <div className="vtpv-empty">Sin reparto por canal. Conecta tus canales de venta (TPV, delivery) para ver el desglose real.</div>
          )}
        </Card>
      </Grid>

      <Card>
        <div className="card-head">
          <h3>Top platos</h3>
          {demo && <Badge tone="muted">{eur0(d.pedidos)} pedidos</Badge>}
        </div>
        {demo ? (
          <DataTable
            columns={[
              { key: 'plato', label: 'Plato' },
              { key: 'uds', label: 'Uds', align: 'right' },
              { key: 'ventas', label: 'Ventas', align: 'right' },
              { key: 'peso', label: '% del total', align: 'right' },
            ]}
            rows={TOP.map((t, i) => ({
              plato: (
                <span className="cell-plato">
                  <span className="cp-th">{imgFor(t.plato) ? <img src={imgFor(t.plato)} alt="" loading="lazy" /> : null}</span>
                  {t.plato}
                </span>
              ),
              uds: eur0(t.uds * f),
              ventas: eur0(t.ventas * f) + ' €',
              peso: <Badge tone={i < 2 ? 'gold' : 'muted'}>{hasVentas ? Math.round((t.ventas / 1787) * 100) + '%' : '—'}</Badge>,
            }))}
          />
        ) : (
          <div className="vtpv-empty">Aún no hay ventas por plato. El ranking aparecerá cuando se registren ventas con detalle de productos.</div>
        )}
      </Card>
    </div>
  )
}
