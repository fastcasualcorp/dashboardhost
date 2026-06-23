import type { CSSProperties } from 'react'
import { Card, SectionHeader, KpiTile, BarRow, Badge, Grid } from '../components/ui'

const gastoRows = [
  { label: 'Alquiler', value: 1200, max: 1200, color: 'gold', amount: '1.200 €' },
  { label: 'Suministros', value: 620, max: 1200, color: 'amber', amount: '620 €' },
  { label: 'Otros', value: 930, max: 1200, color: 'violeta', amount: '930 €' },
  { label: 'Seguros', value: 280, max: 1200, color: 'blue', amount: '280 €' },
  { label: 'Software', value: 210, max: 1200, color: 'green', amount: '210 €' },
]

// Categorías para la tarta (suman el total mensual).
const CATS = [
  { name: 'Alquiler', value: 1200, color: '#ffbf10' },
  { name: 'Suministros', value: 620, color: '#f5b341' },
  { name: 'Otros', value: 930, color: '#b58bf0' },
  { name: 'Seguros', value: 280, color: '#4aa3ff' },
  { name: 'Software', value: 210, color: '#34d399' },
]
const TOTAL = CATS.reduce((s, c) => s + c.value, 0)

const conceptos = [
  { concepto: 'Alquiler local', cat: 'Alquiler', tone: 'gold', importe: '1.200,00 €', iva: '0 %', pro: '40,00 €' },
  { concepto: 'Luz (Endesa)', cat: 'Suministros', tone: 'amber', importe: '320,00 €', iva: '10 %', pro: '10,67 €' },
  { concepto: 'Agua', cat: 'Suministros', tone: 'amber', importe: '90,00 €', iva: '10 %', pro: '3,00 €' },
  { concepto: 'Gas natural', cat: 'Suministros', tone: 'amber', importe: '210,00 €', iva: '21 %', pro: '7,00 €' },
  { concepto: 'Seguro RC / incendios', cat: 'Seguros', tone: 'blue', importe: '280,00 €', iva: '0 %', pro: '9,33 €' },
  { concepto: 'Gestoría laboral', cat: 'Otros', tone: 'muted', importe: '180,00 €', iva: '21 %', pro: '6,00 €' },
  { concepto: 'Software TPV (REBELL)', cat: 'Software', tone: 'green', importe: '129,00 €', iva: '21 %', pro: '4,30 €' },
  { concepto: 'Internet + teléfono', cat: 'Software', tone: 'green', importe: '81,00 €', iva: '21 %', pro: '2,70 €' },
  { concepto: 'Contenedor basura', cat: 'Otros', tone: 'muted', importe: '750,00 €', iva: '0 %', pro: '25,00 €' },
] as const

/* Tarta (donut) de categorías con conic-gradient + leyenda. Una sola fuente de color
   por categoría; el agujero muestra el total. Entra con un pop animado (one-shot). */
function PieGastos() {
  let acc = 0
  const stops = CATS.map((c) => {
    const a = acc
    acc += (c.value / TOTAL) * 100
    return `${c.color} ${a.toFixed(2)}% ${acc.toFixed(2)}%`
  }).join(', ')
  return (
    <div className="gp-pie-wrap">
      <div className="gp-pie" style={{ ['--pie' as string]: `conic-gradient(${stops})` } as CSSProperties}>
        <div className="gp-pie-hole">
          <b>{TOTAL.toLocaleString('es-ES')} €</b>
          <span>al mes</span>
        </div>
      </div>
      <div className="gp-legend">
        {CATS.map((c) => (
          <div className="gp-leg" key={c.name}>
            <i style={{ background: c.color }} />
            <span className="gp-leg-n">{c.name}</span>
            <span className="gp-leg-v">{c.value.toLocaleString('es-ES')} €</span>
            <span className="gp-leg-p">{Math.round((c.value / TOTAL) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Gastos() {
  return (
    <div className="section">
      <SectionHeader title="Gastos fijos" subtitle="Costes recurrentes" right={<Badge tone="muted">Junio 2026</Badge>} />

      <Grid cols={3} className="kpi-grid">
        <KpiTile label="Total mensual" value="3.240,00" unit="€" delta="+2,1%" foot="vs mes anterior" trend="down" />
        <KpiTile label="Prorrateo diario" value="108,00" unit="€" foot="30 días naturales" trend="flat" />
        <KpiTile label="Nº de gastos" value="9" foot="activos este mes" trend="flat" />
      </Grid>

      <Card>
        <div className="card-head">
          <h3>Reparto de gastos</h3>
          <Badge tone="muted">por categoría · mensual</Badge>
        </div>
        <div className="bar-rows">
          {gastoRows.map((r) => (
            <BarRow key={r.label} label={r.label} value={r.value} max={r.max} color={r.color} amount={r.amount} />
          ))}
        </div>
      </Card>

      <Card>
        <div className="card-head">
          <h3>Estructura de gastos</h3>
          <Badge tone="muted">9 conceptos · 3.240,00 €/mes</Badge>
        </div>
        <div className="gp-grid">
          <PieGastos />
          <div className="gp-concepts">
            {conceptos.map((c, i) => (
              <div className="gp-con" key={i}>
                <div className="gp-con-l">
                  <b>{c.concepto}</b>
                  <div className="gp-con-badges">
                    <Badge tone={c.tone}>{c.cat}</Badge>
                    <span className="gp-con-iva">IVA {c.iva}</span>
                  </div>
                </div>
                <div className="gp-con-r">
                  <b className="gp-con-imp">{c.importe}</b>
                  <span className="gp-con-pro">{c.pro}/día</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
