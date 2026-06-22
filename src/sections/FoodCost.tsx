import { Card, SectionHeader, KpiTile, BarRow, DataTable, Badge, Donut, Grid } from '../components/ui'

const ficha = [
  { plato: 'REBELL Classic',    pvp: '11,00 €', coste: '2,97 €', fc: 27,  fcBadge: <Badge tone="green">27%</Badge>,  margen: '8,03 €' },
  { plato: 'Doble Bacon',       pvp: '13,00 €', coste: '3,77 €', fc: 29,  fcBadge: <Badge tone="amber">29%</Badge>,  margen: '9,23 €' },
  { plato: 'Crispy Chicken',    pvp: '12,00 €', coste: '3,48 €', fc: 29,  fcBadge: <Badge tone="amber">29%</Badge>,  margen: '8,52 €' },
  { plato: 'BBQ Smash',         pvp: '12,50 €', coste: '3,75 €', fc: 30,  fcBadge: <Badge tone="amber">30%</Badge>,  margen: '8,75 €' },
  { plato: 'Truffle Mushroom',  pvp: '13,50 €', coste: '4,32 €', fc: 32,  fcBadge: <Badge tone="amber">32%</Badge>,  margen: '9,18 €' },
  { plato: 'Patatas Rebell',    pvp: '4,50 €',  coste: '1,44 €', fc: 32,  fcBadge: <Badge tone="amber">32%</Badge>,  margen: '3,06 €' },
  { plato: 'Veggie Deluxe',     pvp: '12,00 €', coste: '4,68 €', fc: 39,  fcBadge: <Badge tone="red">39%</Badge>,    margen: '7,32 €' },
  { plato: 'Onion Rings',       pvp: '3,50 €',  coste: '1,47 €', fc: 42,  fcBadge: <Badge tone="red">42%</Badge>,    margen: '2,03 €' },
]

const tableRows = ficha.map(r => ({
  plato:  r.plato,
  pvp:    r.pvp,
  coste:  r.coste,
  fc:     r.fcBadge,
  margen: r.margen,
}))

export default function FoodCost() {
  return (
    <div className="section">
      <SectionHeader
        title="Food cost"
        subtitle="Ficha técnica"
        right={<Badge tone="gold">carta activa</Badge>}
      />

      <Grid cols={3} className="kpi-grid">
        <KpiTile label="Food cost medio" value="31" unit="%" delta="+2 pts" foot="objetivo < 30%" trend="down" />
        <KpiTile label="Plato más rentable" value="REBELL Classic" delta="27% FC" foot="margen 8,03 €" trend="up" />
        <KpiTile label="Plato a revisar" value="Veggie Deluxe" delta="39% FC" foot="revisar receta o PVP" trend="down" />
      </Grid>

      <Grid cols={2}>
        <Card>
          <div className="card-head">
            <h3>Food cost global</h3>
            <Badge tone="amber">media de la carta</Badge>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem 0' }}>
            <Donut value={31} label="food cost" sub="media de la carta" tone="amber" />
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <h3>Distribución FC por plato</h3>
            <span className="muted-s">% sobre PVP</span>
          </div>
          <div className="bar-rows">
            <BarRow label="REBELL Classic"   value={27} max={42} color="green"  amount="27%" />
            <BarRow label="Doble Bacon"      value={29} max={42} color="gold"   amount="29%" />
            <BarRow label="Crispy Chicken"   value={29} max={42} color="gold"   amount="29%" />
            <BarRow label="BBQ Smash"        value={30} max={42} color="gold"   amount="30%" />
            <BarRow label="Truffle Mushroom" value={32} max={42} color="amber"  amount="32%" />
            <BarRow label="Patatas Rebell"   value={32} max={42} color="amber"  amount="32%" />
            <BarRow label="Veggie Deluxe"    value={39} max={42} color="amber"  amount="39%" />
            <BarRow label="Onion Rings"      value={42} max={42} color="amber"  amount="42%" />
          </div>
        </Card>
      </Grid>

      <Card>
        <div className="card-head">
          <h3>Ficha técnica — rentabilidad por plato</h3>
          <Badge tone="muted">8 referencias</Badge>
        </div>
        <DataTable
          columns={[
            { key: 'plato',  label: 'Plato' },
            { key: 'pvp',    label: 'PVP',       align: 'right' },
            { key: 'coste',  label: 'Coste mat.', align: 'right' },
            { key: 'fc',     label: 'Food cost',  align: 'right' },
            { key: 'margen', label: 'Margen',     align: 'right' },
          ]}
          rows={tableRows}
        />
      </Card>
    </div>
  )
}
