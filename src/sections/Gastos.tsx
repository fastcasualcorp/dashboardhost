import { Card, SectionHeader, KpiTile, BarRow, DataTable, Badge, Donut, Grid } from '../components/ui'

const gastoRows = [
  { label: 'Alquiler', value: 1200, max: 1200, color: 'gold', amount: '1.200 €' },
  { label: 'Suministros (Luz+Agua+Gas)', value: 620, max: 1200, color: 'amber', amount: '620 €' },
  { label: 'Seguros', value: 280, max: 1200, color: 'blue', amount: '280 €' },
  { label: 'Software / TPV / Gestoría', value: 210, max: 1200, color: 'green', amount: '210 €' },
  { label: 'Otros', value: 930, max: 1200, color: 'amber', amount: '930 €' },
]

const conceptos = [
  { concepto: 'Alquiler local', categoria: <Badge tone="gold">Alquiler</Badge>, importe: '1.200,00 €', iva: '0 %', prorratio: '40,00 €' },
  { concepto: 'Luz (endesa)', categoria: <Badge tone="amber">Suministros</Badge>, importe: '320,00 €', iva: '10 %', prorratio: '10,67 €' },
  { concepto: 'Agua', categoria: <Badge tone="amber">Suministros</Badge>, importe: '90,00 €', iva: '10 %', prorratio: '3,00 €' },
  { concepto: 'Gas natural', categoria: <Badge tone="amber">Suministros</Badge>, importe: '210,00 €', iva: '21 %', prorratio: '7,00 €' },
  { concepto: 'Seguro RC / incendios', categoria: <Badge tone="blue">Seguros</Badge>, importe: '280,00 €', iva: '0 %', prorratio: '9,33 €' },
  { concepto: 'Gestoría laboral', categoria: <Badge tone="amber">Otros</Badge>, importe: '180,00 €', iva: '21 %', prorratio: '6,00 €' },
  { concepto: 'Software TPV (REBELL)', categoria: <Badge tone="green">Software</Badge>, importe: '129,00 €', iva: '21 %', prorratio: '4,30 €' },
  { concepto: 'Internet + teléfono', categoria: <Badge tone="green">Software</Badge>, importe: '81,00 €', iva: '21 %', prorratio: '2,70 €' },
  { concepto: 'Contenedor basura', categoria: <Badge tone="amber">Otros</Badge>, importe: '750,00 €', iva: '0 %', prorratio: '25,00 €' },
]

export default function Gastos() {
  return (
    <div className="section">
      <SectionHeader
        title="Gastos fijos"
        subtitle="Costes recurrentes"
        right={<Badge tone="muted">Junio 2026</Badge>}
      />

      <Grid cols={3} className="kpi-grid">
        <KpiTile label="Total mensual" value="3.240,00" unit="€" delta="+2,1%" foot="vs mes anterior" trend="down" />
        <KpiTile label="Prorrateo diario" value="108,00" unit="€" delta="" foot="30 días naturales" trend="flat" />
        <KpiTile label="Nº de gastos" value="9" unit="" delta="" foot="activos este mes" trend="flat" />
      </Grid>

      <Grid cols={2}>
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
            <h3>Estructura de costes</h3>
            <Badge tone="gold">Alquiler 37 %</Badge>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-around', paddingTop: '0.5rem' }}>
            <Donut value={37} label="Alquiler" sub="1.200 € / mes" tone="gold" />
            <Donut value={19} label="Suministros" sub="620 € / mes" tone="amber" />
            <Donut value={9} label="Seguros" sub="280 € / mes" tone="green" />
          </div>
        </Card>
      </Grid>

      <Card>
        <div className="card-head">
          <h3>Detalle de gastos fijos</h3>
          <Badge tone="muted">9 conceptos · 3.240,00 €/mes</Badge>
        </div>
        <DataTable
          columns={[
            { key: 'concepto', label: 'Concepto' },
            { key: 'categoria', label: 'Categoría' },
            { key: 'importe', label: 'Importe/mes', align: 'right' },
            { key: 'iva', label: 'IVA', align: 'right' },
            { key: 'prorratio', label: 'Prorrateo/día', align: 'right' },
          ]}
          rows={conceptos}
        />
      </Card>
    </div>
  )
}
