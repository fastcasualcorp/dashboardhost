import { Card, SectionHeader, KpiTile, BarRow, DataTable, Badge, Donut, Grid } from '../components/ui'

const stockRows = [
  { producto: 'Carne picada',   actual: '18,5 kg',  consumo: '6,2 kg', umbral: '10 kg',  estado: <Badge tone="amber">Bajo</Badge> },
  { producto: 'Pan brioche',    actual: '24 uds',   consumo: '48 uds', umbral: '30 uds', estado: <Badge tone="red">Crítico</Badge> },
  { producto: 'Queso cheddar',  actual: '4,2 kg',   consumo: '1,1 kg', umbral: '2 kg',   estado: <Badge tone="green">OK</Badge> },
  { producto: 'Bacon',          actual: '3,8 kg',   consumo: '1,4 kg', umbral: '3 kg',   estado: <Badge tone="amber">Bajo</Badge> },
  { producto: 'Lechuga',        actual: '2,1 kg',   consumo: '0,9 kg', umbral: '2 kg',   estado: <Badge tone="red">Crítico</Badge> },
  { producto: 'Tomate',         actual: '5,6 kg',   consumo: '1,3 kg', umbral: '3 kg',   estado: <Badge tone="green">OK</Badge> },
  { producto: 'Patata',         actual: '28 kg',    consumo: '9,5 kg', umbral: '15 kg',  estado: <Badge tone="green">OK</Badge> },
  { producto: 'Salsa Rebell',   actual: '1,9 L',    consumo: '0,8 L',  umbral: '2 L',    estado: <Badge tone="red">Crítico</Badge> },
  { producto: 'Refrescos',      actual: '96 uds',   consumo: '34 uds', umbral: '48 uds', estado: <Badge tone="green">OK</Badge> },
  { producto: 'Aceite',         actual: '8,4 L',    consumo: '2,1 L',  umbral: '5 L',    estado: <Badge tone="green">OK</Badge> },
]

const nivelRows = [
  { label: 'Carne picada',  value: 46,  max: 100, color: 'amber' as const, amount: '18,5 kg' },
  { label: 'Pan brioche',   value: 20,  max: 100, color: 'amber' as const, amount: '24 uds'  },
  { label: 'Bacon',         value: 38,  max: 100, color: 'amber' as const, amount: '3,8 kg'  },
  { label: 'Lechuga',       value: 22,  max: 100, color: 'amber' as const, amount: '2,1 kg'  },
  { label: 'Salsa Rebell',  value: 24,  max: 100, color: 'amber' as const, amount: '1,9 L'   },
  { label: 'Tomate',        value: 74,  max: 100, color: 'green' as const, amount: '5,6 kg'  },
  { label: 'Patata',        value: 80,  max: 100, color: 'green' as const, amount: '28 kg'   },
  { label: 'Queso cheddar', value: 84,  max: 100, color: 'green' as const, amount: '4,2 kg'  },
  { label: 'Refrescos',     value: 67,  max: 100, color: 'gold'  as const, amount: '96 uds'  },
  { label: 'Aceite',        value: 70,  max: 100, color: 'green' as const, amount: '8,4 L'   },
]

export default function Stock() {
  return (
    <div className="section">
      <SectionHeader
        title="Stock obrador"
        subtitle="Materias primas"
        right={<Badge tone="red">⚠ 5 alertas activas</Badge>}
      />

      <Grid cols={3} className="kpi-grid">
        <KpiTile label="Referencias" value="42" unit="prods" delta="0" foot="sin cambios" trend="flat" />
        <KpiTile label="Alertas activas" value="5" unit="prods" delta="+2" foot="vs ayer" trend="down" />
        <KpiTile label="Valor del stock" value="3.850,00" unit="€" delta="-4,2%" foot="vs semana pasada" trend="down" />
      </Grid>

      <Grid cols={2}>
        <Card>
          <div className="card-head">
            <h3>Niveles de stock</h3>
            <Badge tone="muted">% sobre capacidad</Badge>
          </div>
          <div className="bar-rows">
            {nivelRows.map((r) => (
              <BarRow key={r.label} label={r.label} value={r.value} max={r.max} color={r.color} amount={r.amount} />
            ))}
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <h3>Cobertura media</h3>
            <Badge tone="muted">días hasta rotura</Badge>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center', paddingTop: '1rem' }}>
            <Donut value={31} label="pan brioche" sub="~0,5 días" tone="red" />
            <Donut value={44} label="carne picada" sub="~3 días" tone="amber" />
            <Donut value={68} label="queso cheddar" sub="~4 días" tone="gold" />
            <Donut value={82} label="patata" sub="~3 días" tone="green" />
          </div>
        </Card>
      </Grid>

      <Card>
        <div className="card-head">
          <h3>Detalle de materias primas</h3>
          <Badge tone="muted">10 referencias clave</Badge>
        </div>
        <DataTable
          columns={[
            { key: 'producto', label: 'Producto' },
            { key: 'actual',   label: 'Stock actual',  align: 'right' },
            { key: 'consumo',  label: 'Consumo / día', align: 'right' },
            { key: 'umbral',   label: 'Umbral mínimo', align: 'right' },
            { key: 'estado',   label: 'Estado',        align: 'right' },
          ]}
          rows={stockRows}
        />
      </Card>
    </div>
  )
}
