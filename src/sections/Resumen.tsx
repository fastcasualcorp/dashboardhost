import { useState } from 'react'
import { Card, SectionHeader, Donut, CountValue, BarChart, BarRow, DataTable, Badge, Grid, KpiTile } from '../components/ui'
import DatePicker, { rangeFor, type RangeSel } from '../components/DatePicker'
import { eur, eur0, VENTAS_MES, FOOD_COST_PCT } from '../lib/data'
import { useEquipo, costeMes } from '../lib/equipo'
import { useGastos, gastosMes } from '../lib/gastos'
import { imgFor } from '../lib/products'
import WaterfallPL from '../components/WaterfallPL'

const RANGE_DAYS: Record<string, number> = { hoy: 1, ayer: 1, semana: 5, semanaant: 7, mes: 22, mesant: 30, trimestre: 91, anio: 173, historico: 540 }

function seriesFor(key: string, ventas: number) {
  let title = 'Ventas por mes'
  let labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun']
  let weights = [0.14, 0.15, 0.16, 0.17, 0.18, 0.2]
  if (key === 'hoy' || key === 'ayer') {
    title = 'Ventas por franja'
    labels = ['12h', '14h', '16h', '18h', '20h', '22h']
    weights = [0.12, 0.22, 0.1, 0.14, 0.28, 0.14]
  } else if (key === 'semana' || key === 'semanaant') {
    title = 'Ventas por día'
    labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    weights = [0.11, 0.12, 0.13, 0.14, 0.18, 0.18, 0.14]
  } else if (key === 'mes' || key === 'mesant') {
    title = 'Ventas por semana'
    labels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5']
    weights = [0.2, 0.22, 0.21, 0.24, 0.13]
  } else if (key === 'trimestre') {
    title = 'Ventas por mes'
    labels = ['Abr', 'May', 'Jun']
    weights = [0.32, 0.33, 0.35]
  }
  return { title, data: labels.map((l, i) => ({ label: l, value: Math.round(ventas * weights[i]) })) }
}

function dataFor(key: string) {
  const days = RANGE_DAYS[key] ?? 22
  // 'mes' usa la facturación mensual ÚNICA (misma que el P&L y Coste → el héroe y el P&L ya NO se contradicen)
  const ventas = key === 'hoy' ? 1787 : key === 'mes' || key === 'mesant' ? VENTAS_MES : Math.round(1426 * days * (0.95 + (days % 4) * 0.012))
  const pedidos = Math.round(ventas / 21.28)
  const ticket = ventas / pedidos
  const margen = Math.min(72, 60 + Math.round(Math.log2(days + 1)))
  return { ventas, pedidos, ticket, margen, chart: seriesFor(key, ventas) }
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
  const init = rangeFor('mes')
  const [range, setRange] = useState<RangeSel>({ key: 'mes', label: 'Este mes', start: init.start, end: init.end })
  const d = dataFor(range.key)
  const f = d.ventas / 1787

  // ── Cuenta de resultados del MES, DERIVADA y consistente (mismas cifras en héroe, KPIs, cascada y tabla) ──
  const roster = useEquipo()
  useGastos() // suscribe: editar un gasto recalcula el P&L
  const plPersonal = roster.reduce((s, e) => s + costeMes(e), 0) // = Coste personal (fuente única equipo)
  const plFood = Math.round(VENTAS_MES * FOOD_COST_PCT)
  const plGastos = gastosMes() // = Gastos fijos (fuente única gastos, total con IVA)
  const plNeto = VENTAS_MES - plPersonal - plFood - plGastos
  const plPct = (n: number) => Math.round((n / VENTAS_MES) * 1000) / 10
  const filasPL = [
    { concepto: 'Facturación', importe: `${eur0(VENTAS_MES)},00 €`, pct: <Badge tone="gold">100%</Badge> },
    { concepto: 'Coste de personal', importe: `${eur0(plPersonal)} €`, pct: <Badge tone="blue">{plPct(plPersonal)}%</Badge> },
    { concepto: 'Compras (food cost)', importe: `${eur0(plFood)} €`, pct: <Badge tone="amber">{plPct(plFood)}%</Badge> },
    { concepto: 'Gastos fijos', importe: `${eur0(plGastos)} €`, pct: <Badge tone="muted">{plPct(plGastos)}%</Badge> },
    { concepto: 'Resultado neto', importe: `${eur0(plNeto)} €`, pct: <Badge tone="green">{plPct(plNeto)}%</Badge> },
  ]
  const rangeLow = range.label.toLowerCase()
  // "Salud del negocio" (0-100): margen + ticket vs objetivo. Etiqueta y tono por tramo.
  const score = Math.max(20, Math.min(98, Math.round(d.margen * 0.9 + (d.ticket / 19.5) * 28)))
  const scoreLabel = score >= 85 ? 'Excelente' : score >= 70 ? 'Buena' : score >= 50 ? 'Estable' : 'Atención'
  const scoreTone: 'green' | 'amber' | 'red' = score >= 70 ? 'green' : score >= 50 ? 'amber' : 'red'

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
            <span className="rs-delta up">▲ +9,0%</span>
          </div>
          <div className="rs-mini">
            <div className="rs-m"><span>Margen</span><b className="tnum"><CountValue value={d.margen + '%'} /></b></div>
            <div className="rs-m"><span>Pedidos</span><b className="tnum"><CountValue value={eur0(d.pedidos)} /></b></div>
            <div className="rs-m"><span>Ticket medio</span><b className="tnum"><CountValue value={eur(d.ticket) + ' €'} /></b></div>
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
        <KpiTile label="Facturación" value={eur0(VENTAS_MES)} unit="€" delta="+6,3%" foot="vs mes anterior" trend="up" />
        <KpiTile label="Coste de personal" value={eur0(plPersonal)} unit="€" delta={plPct(plPersonal) + '%'} foot="s/ventas" trend="flat" />
        <KpiTile label="Food cost" value={String(Math.round(FOOD_COST_PCT * 100))} unit="%" delta="-0,8 pts" foot="vs media" trend="up" />
        <KpiTile label="Resultado neto" value={eur0(plNeto)} unit="€" delta={plPct(plNeto) + '%'} foot="margen del mes" trend="up" />
      </Grid>

      {/* CASCADA: cómo la facturación se convierte en beneficio (la estrella del Resumen) */}
      <Card>
        <div className="card-head">
          <h3>De la facturación al beneficio</h3>
          <Badge tone="green">{plPct(plNeto)}% margen neto</Badge>
        </div>
        <WaterfallPL facturacion={VENTAS_MES} personal={plPersonal} foodCost={plFood} gastos={plGastos} />
      </Card>

      <Grid cols={2}>
        <Card>
          <div className="card-head">
            <h3>Margen neto</h3>
            <Badge tone="green">{plPct(plNeto)}% s/facturación</Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.4rem', padding: '0.5rem 0.25rem', flexWrap: 'wrap' }}>
            <Donut value={Math.round((plNeto / VENTAS_MES) * 100)} label="margen neto" sub="sobre facturación" tone="green" />
            <p className="muted-s" style={{ flex: '1 1 160px', lineHeight: 1.5, margin: 0 }}>
              Por cada 100 € facturados, <strong style={{ color: 'var(--brand)' }}>{plPct(plNeto)} € son beneficio real</strong> tras costes y gastos.
              Meta mensual: 20%.
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
          <div className="bar-rows">
            {CANALES.map((c) => (
              <BarRow key={c.l} value={c.v} max={742} color={c.c} amount={eur0(c.v * f) + ' €'}
                label={<span className="rs-canal-lbl">{c.logo && <span className="rs-canal-logo"><img src={c.logo} alt="" /></span>}{c.l}</span>} />
            ))}
          </div>
        </Card>
      </Grid>

      <Card>
        <div className="card-head">
          <h3>Top platos</h3>
          <Badge tone="muted">{eur0(d.pedidos)} pedidos</Badge>
        </div>
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
            peso: <Badge tone={i < 2 ? 'gold' : 'muted'}>{Math.round((t.ventas / 1787) * 100)}%</Badge>,
          }))}
        />
      </Card>
    </div>
  )
}
