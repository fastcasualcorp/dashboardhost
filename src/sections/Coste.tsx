import { Card, SectionHeader, KpiTile, BarChart, DataTable, Badge, Donut, Grid } from '../components/ui'

const costeSemana = [
  { label: 'Lun', value: 390 },
  { label: 'Mar', value: 410 },
  { label: 'Mié', value: 420 },
  { label: 'Jue', value: 445 },
  { label: 'Vie', value: 510 },
  { label: 'Sáb', value: 560 },
  { label: 'Dom', value: 365 },
]

const columnas = [
  { key: 'empleado', label: 'Empleado' },
  { key: 'horas', label: 'Horas/sem', align: 'right' as const },
  { key: 'costeHora', label: 'Coste/hora', align: 'right' as const },
  { key: 'costeSem', label: 'Coste/sem', align: 'right' as const },
]

const filas = [
  { empleado: 'Carlos Vázquez', horas: 40, costeHora: '9,50 €', costeSem: '380,00 €' },
  { empleado: 'Laura Díaz', horas: 35, costeHora: '9,50 €', costeSem: '332,50 €' },
  { empleado: 'Iván Fernández', horas: 38, costeHora: '10,20 €', costeSem: '387,60 €' },
  { empleado: 'Marta Soto', horas: 32, costeHora: '9,80 €', costeSem: '313,60 €' },
  { empleado: 'Pablo Romero', horas: 40, costeHora: '11,00 €', costeSem: '440,00 €' },
  { empleado: 'Ana López', horas: 28, costeHora: '9,50 €', costeSem: '266,00 €' },
]

export default function Coste() {
  return (
    <div className="section">
      <SectionHeader
        title="Coste personal"
        subtitle="Análisis de coste"
        right={<Badge tone="amber">⚠ 26% s/ventas</Badge>}
      />

      <Grid cols={4} className="kpi-grid">
        <KpiTile label="Coste hoy" value="430,00" unit="€" delta="+2,4%" foot="vs ayer" trend="down" />
        <KpiTile label="Coste semana" value="3.100,00" unit="€" delta="-1,1%" foot="vs sem. anterior" trend="up" />
        <KpiTile label="Coste mes" value="12.400,00" unit="€" delta="+3,2%" foot="vs mes anterior" trend="down" />
        <KpiTile label="% sobre ventas" value="26" unit="%" delta="-0,5 pts" foot="vs media sector 28%" trend="up" />
      </Grid>

      <Grid cols={2}>
        <Card>
          <div className="card-head">
            <h3>Coste por día · esta semana</h3>
            <Badge tone="amber">media 443 €</Badge>
          </div>
          <BarChart data={costeSemana} height={140} color="amber" />
        </Card>

        <Card>
          <div className="card-head">
            <h3>Distribución del coste</h3>
            <Badge tone="muted">6 empleados</Badge>
          </div>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', justifyContent: 'space-around', padding: '1rem 0' }}>
            <Donut value={26} label="% s/ventas" sub="umbral recomendado 28%" tone="gold" />
            <Donut value={68} label="jornadas completas" sub="vs contratos parciales" tone="green" />
            <Donut value={42} label="coste fijo" sub="sobre total nómina" tone="amber" />
          </div>
        </Card>
      </Grid>

      <Card>
        <div className="card-head">
          <h3>Detalle por empleado</h3>
          <Badge tone="muted">semana actual</Badge>
        </div>
        <DataTable columns={columnas} rows={filas} />
      </Card>
    </div>
  )
}
