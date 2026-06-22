import { Card, SectionHeader, KpiTile, BarChart, DataTable, Badge, Grid } from '../components/ui'

const ventasMes = [
  { label: 'Ene', value: 38200 },
  { label: 'Feb', value: 34750 },
  { label: 'Mar', value: 41600 },
  { label: 'Abr', value: 39400 },
  { label: 'May', value: 44800 },
  { label: 'Jun', value: 47320 },
]

const comprasMes = [
  { label: 'Ene', value: 14100 },
  { label: 'Feb', value: 12980 },
  { label: 'Mar', value: 15400 },
  { label: 'Abr', value: 14750 },
  { label: 'May', value: 16200 },
  { label: 'Jun', value: 17480 },
]

const comparativa = [
  { mes: 'Enero',    ventas: '38.200,00 €', compras: '14.100,00 €', margen: '24.100,00 €', pct: <Badge tone="green">36,9%</Badge> },
  { mes: 'Febrero',  ventas: '34.750,00 €', compras: '12.980,00 €', margen: '21.770,00 €', pct: <Badge tone="green">37,3%</Badge> },
  { mes: 'Marzo',    ventas: '41.600,00 €', compras: '15.400,00 €', margen: '26.200,00 €', pct: <Badge tone="green">37,0%</Badge> },
  { mes: 'Abril',    ventas: '39.400,00 €', compras: '14.750,00 €', margen: '24.650,00 €', pct: <Badge tone="amber">37,4%</Badge> },
  { mes: 'Mayo',     ventas: '44.800,00 €', compras: '16.200,00 €', margen: '28.600,00 €', pct: <Badge tone="green">36,2%</Badge> },
  { mes: 'Junio',    ventas: '47.320,00 €', compras: '17.480,00 €', margen: '29.840,00 €', pct: <Badge tone="gold">36,9%</Badge> },
]

export default function Estadisticas() {
  return (
    <div className="section">
      <SectionHeader
        title="Estadísticas"
        subtitle="Ventas vs compras"
        right={<Badge tone="blue">Ene – Jun 2025</Badge>}
      />

      <Grid cols={3} className="kpi-grid">
        <KpiTile
          label="Ventas mes actual"
          value="47.320,00"
          unit="€"
          delta="+5,6%"
          foot="vs mayo"
          trend="up"
        />
        <KpiTile
          label="Compras mes actual"
          value="17.480,00"
          unit="€"
          delta="+7,9%"
          foot="vs mayo"
          trend="down"
        />
        <KpiTile
          label="Ratio compra / venta"
          value="36,9"
          unit="%"
          delta="+0,7 pts"
          foot="meta < 38%"
          trend="flat"
        />
      </Grid>

      <Grid cols={2}>
        <Card>
          <div className="card-head">
            <h3>Ventas por mes</h3>
            <Badge tone="gold">media 41.012 €</Badge>
          </div>
          <BarChart data={ventasMes} height={140} color="gold" />
        </Card>
        <Card>
          <div className="card-head">
            <h3>Compras por mes</h3>
            <Badge tone="blue">media 15.152 €</Badge>
          </div>
          <BarChart data={comprasMes} height={140} color="blue" />
        </Card>
      </Grid>

      <Card>
        <div className="card-head">
          <h3>Comparativa mensual</h3>
          <Badge tone="muted">6 meses</Badge>
        </div>
        <DataTable
          columns={[
            { key: 'mes',     label: 'Mes' },
            { key: 'ventas',  label: 'Ventas',  align: 'right' },
            { key: 'compras', label: 'Compras', align: 'right' },
            { key: 'margen',  label: 'Margen',  align: 'right' },
            { key: 'pct',     label: '%',        align: 'right' },
          ]}
          rows={comparativa}
        />
      </Card>
    </div>
  )
}
