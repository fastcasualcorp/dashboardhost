import { Card, SectionHeader, KpiTile, BarChart, DataTable, Badge, Donut, Grid } from '../components/ui'

const margenPorMes = [
  { label: 'Ene', value: 58 },
  { label: 'Feb', value: 60 },
  { label: 'Mar', value: 62 },
  { label: 'Abr', value: 63 },
  { label: 'May', value: 65 },
  { label: 'Jun', value: 67 },
]

export default function Mensual() {
  return (
    <div className="section">
      <SectionHeader
        title="Resumen mensual"
        subtitle="Histórico por meses"
        right={<Badge tone="gold">Ene – Jun 2025</Badge>}
      />

      <Grid cols={4} className="kpi-grid">
        <KpiTile label="Mejor mes" value="Jun" delta="+11,4%" foot="vs mayo" trend="up" />
        <KpiTile label="Ventas YTD" value="97.340,80" unit="€" delta="+18,2%" foot="vs mismo período 2024" trend="up" />
        <KpiTile label="Margen medio" value="62,5" unit="%" delta="+4,1 pts" foot="objetivo 60 %" trend="up" />
        <KpiTile label="Crecimiento" value="+11,4" unit="%" delta="Jun vs May" foot="mejor ritmo del año" trend="up" />
      </Grid>

      <Grid cols={2}>
        <Card>
          <div className="card-head">
            <h3>Margen bruto mensual</h3>
            <Badge tone="green">tendencia al alza</Badge>
          </div>
          <BarChart data={margenPorMes} height={140} color="green" />
        </Card>

        <Card>
          <div className="card-head">
            <h3>Food cost medio · YTD</h3>
            <Badge tone="muted">Ene – Jun</Badge>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px' }}>
            <Donut value={31} label="food cost" sub="media mensual" tone="amber" />
          </div>
        </Card>
      </Grid>

      <Card>
        <div className="card-head">
          <h3>Desglose mensual · P&amp;L simplificado</h3>
          <Badge tone="muted">6 meses</Badge>
        </div>
        <DataTable
          columns={[
            { key: 'mes', label: 'Mes' },
            { key: 'ventas', label: 'Ventas', align: 'right' },
            { key: 'compras', label: 'Compras', align: 'right' },
            { key: 'gastos', label: 'Gastos fijos', align: 'right' },
            { key: 'personal', label: 'Coste personal', align: 'right' },
            { key: 'margen', label: 'Margen bruto', align: 'right' },
          ]}
          rows={[
            {
              mes: 'Enero',
              ventas: '13.240,00 €',
              compras: '4.105,40 €',
              gastos: '2.180,00 €',
              personal: '2.650,00 €',
              margen: <Badge tone="green">7.680,60 €</Badge>,
            },
            {
              mes: 'Febrero',
              ventas: '14.180,00 €',
              compras: '4.340,20 €',
              gastos: '2.180,00 €',
              personal: '2.650,00 €',
              margen: <Badge tone="green">8.504,80 €</Badge>,
            },
            {
              mes: 'Marzo',
              ventas: '15.460,50 €',
              compras: '4.712,80 €',
              gastos: '2.200,00 €',
              personal: '2.780,00 €',
              margen: <Badge tone="green">9.544,70 €</Badge>,
            },
            {
              mes: 'Abril',
              ventas: '16.320,80 €',
              compras: '4.895,00 €',
              gastos: '2.200,00 €',
              personal: '2.780,00 €',
              margen: <Badge tone="green">10.225,80 €</Badge>,
            },
            {
              mes: 'Mayo',
              ventas: '17.520,00 €',
              compras: '5.180,00 €',
              gastos: '2.240,00 €',
              personal: '2.900,00 €',
              margen: <Badge tone="gold">11.375,00 €</Badge>,
            },
            {
              mes: 'Junio',
              ventas: '19.519,50 €',
              compras: '5.720,80 €',
              gastos: '2.240,00 €',
              personal: '2.900,00 €',
              margen: <Badge tone="gold">12.692,70 €</Badge>,
            },
          ]}
        />
      </Card>
    </div>
  )
}
