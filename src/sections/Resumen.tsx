import { useState } from 'react'
import { Card, SectionHeader, KpiTile, BarChart, BarRow, DataTable, Badge, Grid } from '../components/ui'
import DatePicker, { rangeFor, type RangeSel } from '../components/DatePicker'
import { eur, eur0 } from '../lib/data'
import { imgFor } from '../lib/products'

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
  const ventas = key === 'hoy' ? 1787 : Math.round(1426 * days * (0.95 + (days % 4) * 0.012))
  const pedidos = Math.round(ventas / 21.28)
  const ticket = ventas / pedidos
  const margen = Math.min(72, 60 + Math.round(Math.log2(days + 1)))
  return { ventas, pedidos, ticket, margen, chart: seriesFor(key, ventas) }
}

const CANALES = [
  { l: 'Local / TPV', v: 742, c: 'gold' },
  { l: 'Glovo', v: 486, c: 'amber' },
  { l: 'Uber Eats', v: 358, c: 'blue' },
  { l: 'Just Eat', v: 201, c: 'green' },
]
const TOP = [
  { plato: 'REBELL Classic', uds: 38, ventas: 418 },
  { plato: 'Doble Bacon', uds: 27, ventas: 351 },
  { plato: 'Crispy Chicken', uds: 22, ventas: 264 },
  { plato: 'Patatas Rebell', uds: 41, ventas: 184.5 },
  { plato: 'Veggie Deluxe', uds: 14, ventas: 168 },
]

export default function Resumen() {
  const init = rangeFor('mes')
  const [range, setRange] = useState<RangeSel>({ key: 'mes', label: 'Este mes', start: init.start, end: init.end })
  const d = dataFor(range.key)
  const f = d.ventas / 1787
  const rangeLow = range.label.toLowerCase()

  return (
    <div className="section">
      <SectionHeader title="Resumen" subtitle={`La salud del negocio · ${rangeLow}`} right={<DatePicker value={range} onApply={setRange} />} />

      <Grid cols={4} className="kpi-grid">
        <KpiTile label="Ventas" value={eur0(d.ventas)} unit="€" delta="+9,0%" foot={rangeLow} trend="up" />
        <KpiTile label="Margen bruto" value={String(d.margen)} unit="%" delta="+2 pts" foot="vs media" trend="up" />
        <KpiTile label="Pedidos" value={eur0(d.pedidos)} delta="+12%" foot={'ticket ' + eur(d.ticket) + ' €'} trend="up" />
        <KpiTile label="Ticket medio" value={eur(d.ticket)} unit="€" delta="+9%" foot="objetivo 19,50 €" trend="up" />
      </Grid>

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
              <BarRow key={c.l} label={c.l} value={c.v} max={742} color={c.c} amount={eur0(c.v * f) + ' €'} />
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
