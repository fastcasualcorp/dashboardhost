import { Card, SectionHeader, KpiTile, BarRow, DataTable, Badge, Grid, Donut } from '../components/ui'

const gastoPorProveedor = [
  { label: 'Makro', value: 3800, max: 3800, color: 'gold' as const, amount: '3.800 €' },
  { label: 'Transgourmet', value: 3100, max: 3800, color: 'gold' as const, amount: '3.100 €' },
  { label: 'Campofrío / Frigoríficos', value: 2650, max: 3800, color: 'amber' as const, amount: '2.650 €' },
  { label: 'Cervecería Estrella Galicia', value: 1980, max: 3800, color: 'blue' as const, amount: '1.980 €' },
  { label: 'Unilever Food Sol.', value: 1870, max: 3800, color: 'green' as const, amount: '1.870 €' },
  { label: 'Panadería Galega', value: 1500, max: 3800, color: 'muted' as const, amount: '1.500 €' },
]

const albaranes = [
  { fecha: '18 jun', proveedor: 'Makro', concepto: 'Carne / frescos sem. 25', base: '1.234,50', iva: '148,14', total: '1.382,64', estado: <Badge tone="green">Pagado</Badge> },
  { fecha: '17 jun', proveedor: 'Transgourmet', concepto: 'Salsas, congelados', base: '876,00', iva: '105,12', total: '981,12', estado: <Badge tone="green">Pagado</Badge> },
  { fecha: '16 jun', proveedor: 'Campofrío / Frigoríficos', concepto: 'Bacon, queso lonchas', base: '1.020,00', iva: '122,40', total: '1.142,40', estado: <Badge tone="green">Pagado</Badge> },
  { fecha: '15 jun', proveedor: 'Cervecería Estrella Galicia', concepto: 'Barriles Estrella 30L ×6', base: '960,00', iva: '115,20', total: '1.075,20', estado: <Badge tone="amber">Pendiente</Badge> },
  { fecha: '14 jun', proveedor: 'Makro', concepto: 'Papas, aceites, misc.', base: '654,20', iva: '78,50', total: '732,70', estado: <Badge tone="green">Pagado</Badge> },
  { fecha: '12 jun', proveedor: 'Unilever Food Sol.', concepto: 'Ketchup, mostaza, mayonesa', base: '430,00', iva: '51,60', total: '481,60', estado: <Badge tone="green">Pagado</Badge> },
  { fecha: '11 jun', proveedor: 'Panadería Galega', concepto: 'Pan brioche artesano ×400', base: '540,00', iva: '27,00', total: '567,00', estado: <Badge tone="green">Pagado</Badge> },
  { fecha: '10 jun', proveedor: 'Transgourmet', concepto: 'Bebidas y refrescos', base: '380,00', iva: '45,60', total: '425,60', estado: <Badge tone="amber">Pendiente</Badge> },
  { fecha: '08 jun', proveedor: 'Unilever Food Sol.', concepto: 'Productos limpieza cocina', base: '210,00', iva: '44,10', total: '254,10', estado: <Badge tone="green">Pagado</Badge> },
]

export default function Compras() {
  return (
    <div className="section">
      <SectionHeader
        title="Compras"
        subtitle="Proveedores"
        right={<Badge tone="amber">2.300 € pendientes</Badge>}
      />

      <Grid cols={3} className="kpi-grid">
        <KpiTile label="Compras del mes" value="14.900,00" unit="€" delta="+5,2%" foot="vs mes anterior" trend="up" />
        <KpiTile label="Proveedores activos" value="6" unit="" delta="0" foot="este mes" trend="flat" />
        <KpiTile label="Pendiente de pago" value="2.300,00" unit="€" delta="2 facturas" foot="vencen esta semana" trend="down" />
      </Grid>

      <Grid cols={2}>
        <Card>
          <div className="card-head">
            <h3>Gasto por proveedor</h3>
            <Badge tone="muted">junio 2025</Badge>
          </div>
          <div className="bar-rows">
            {gastoPorProveedor.map((r) => (
              <BarRow key={r.label} label={r.label} value={r.value} max={r.max} color={r.color} amount={r.amount} />
            ))}
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <h3>Distribución del gasto</h3>
            <Badge tone="muted">6 proveedores</Badge>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', paddingTop: '0.5rem' }}>
            <Donut value={51} label="top 2 proveed." sub="Makro + Transgourmet" tone="gold" />
            <Donut value={18} label="pendiente" sub="del total del mes" tone="amber" />
            <Donut value={82} label="pagado" sub="del total del mes" tone="green" />
          </div>
        </Card>
      </Grid>

      <Card>
        <div className="card-head">
          <h3>Albaranes y facturas — junio 2025</h3>
          <Badge tone="muted">9 registros</Badge>
        </div>
        <DataTable
          columns={[
            { key: 'fecha', label: 'Fecha' },
            { key: 'proveedor', label: 'Proveedor' },
            { key: 'concepto', label: 'Concepto' },
            { key: 'base', label: 'Base (€)', align: 'right' },
            { key: 'iva', label: 'IVA (€)', align: 'right' },
            { key: 'total', label: 'Total (€)', align: 'right' },
            { key: 'estado', label: 'Estado', align: 'right' },
          ]}
          rows={albaranes}
        />
      </Card>
    </div>
  )
}
