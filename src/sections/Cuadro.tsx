import { Card, SectionHeader, KpiTile, BarRow, DataTable, Badge, Donut, Grid } from '../components/ui'

const columnasPL = [
  { key: 'concepto', label: 'Concepto' },
  { key: 'importe', label: 'Importe (€)', align: 'right' as const },
  { key: 'pct', label: '% s/ventas', align: 'right' as const },
]

const filasPL = [
  {
    concepto: 'Facturación',
    importe: '48.250,00 €',
    pct: <Badge tone="gold">100%</Badge>,
  },
  {
    concepto: 'Compras (food cost)',
    importe: '14.957,50 €',
    pct: <Badge tone="amber">31%</Badge>,
  },
  {
    concepto: 'Coste de personal',
    importe: '12.400,00 €',
    pct: <Badge tone="blue">25,7%</Badge>,
  },
  {
    concepto: 'Gastos fijos',
    importe: '11.712,50 €',
    pct: <Badge tone="muted">24,3%</Badge>,
  },
  {
    concepto: 'Resultado neto',
    importe: '9.180,00 €',
    pct: <Badge tone="green">19%</Badge>,
  },
]

export default function Cuadro() {
  return (
    <div className="section">
      <SectionHeader
        title="Cuadro de mando"
        subtitle="Cuenta de resultados"
        right={<Badge tone="gold">Junio 2026</Badge>}
      />

      <Grid cols={4} className="kpi-grid">
        <KpiTile
          label="Facturación"
          value="48.250,00"
          unit="€"
          delta="+6,3%"
          foot="vs mes anterior"
          trend="up"
        />
        <KpiTile
          label="Coste de personal"
          value="12.400,00"
          unit="€"
          delta="-1,2%"
          foot="vs mes anterior"
          trend="down"
        />
        <KpiTile
          label="Food cost"
          value="31"
          unit="%"
          delta="-0,8 pts"
          foot="vs media"
          trend="up"
        />
        <KpiTile
          label="Resultado neto"
          value="9.180,00"
          unit="€"
          delta="+18,4%"
          foot="vs mes anterior"
          trend="up"
        />
      </Grid>

      <Grid cols={2}>
        <Card>
          <div className="card-head">
            <h3>Margen neto</h3>
            <Badge tone="green">19% s/facturación</Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.4rem', padding: '0.5rem 0.25rem', flexWrap: 'wrap' }}>
            <Donut value={19} label="margen neto" sub="sobre facturación" tone="green" />
            <p className="muted-s" style={{ flex: '1 1 160px', lineHeight: 1.5, margin: 0 }}>
              Por cada 100 € facturados, <strong style={{ color: 'var(--brand)' }}>19 € son beneficio real</strong> tras costes y gastos.
              Meta mensual: 20%.
            </p>
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <h3>Estructura del mes</h3>
            <span className="muted-s">sobre 48.250 €</span>
          </div>
          <div className="bar-rows">
            <BarRow
              label="Facturación"
              value={48250}
              max={48250}
              color="gold"
              amount="48.250,00 €"
            />
            <BarRow
              label="Compras / food cost"
              value={14957}
              max={48250}
              color="amber"
              amount="14.957,50 €"
            />
            <BarRow
              label="Coste de personal"
              value={12400}
              max={48250}
              color="blue"
              amount="12.400,00 €"
            />
            <BarRow
              label="Gastos fijos"
              value={11712}
              max={48250}
              color="green"
              amount="11.712,50 €"
            />
          </div>
        </Card>
      </Grid>

      <Card>
        <div className="card-head">
          <h3>Cuenta de resultados — detalle</h3>
          <Badge tone="muted">Junio 2026</Badge>
        </div>
        <DataTable columns={columnasPL} rows={filasPL} />
      </Card>
    </div>
  )
}
