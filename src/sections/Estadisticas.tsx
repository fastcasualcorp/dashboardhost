import { Card, SectionHeader, KpiTile, BarChart, DataTable, Badge, Grid } from '../components/ui'
import { isDemoMode } from '../lib/demo'
import { HOY, salesForMonth, useRealAgg, eur } from '../lib/data'
import { useCompras, totalAlbaran, type Albaran } from '../lib/compras'

const ventasMesDemo = [
  { label: 'Ene', value: 38200 },
  { label: 'Feb', value: 34750 },
  { label: 'Mar', value: 41600 },
  { label: 'Abr', value: 39400 },
  { label: 'May', value: 44800 },
  { label: 'Jun', value: 47320 },
]

const comprasMesDemo = [
  { label: 'Ene', value: 14100 },
  { label: 'Feb', value: 12980 },
  { label: 'Mar', value: 15400 },
  { label: 'Abr', value: 14750 },
  { label: 'May', value: 16200 },
  { label: 'Jun', value: 17480 },
]

const comparativaDemo = [
  { mes: 'Enero',    ventas: '38.200,00 €', compras: '14.100,00 €', margen: '24.100,00 €', pct: <Badge tone="green">36,9%</Badge> },
  { mes: 'Febrero',  ventas: '34.750,00 €', compras: '12.980,00 €', margen: '21.770,00 €', pct: <Badge tone="green">37,3%</Badge> },
  { mes: 'Marzo',    ventas: '41.600,00 €', compras: '15.400,00 €', margen: '26.200,00 €', pct: <Badge tone="green">37,0%</Badge> },
  { mes: 'Abril',    ventas: '39.400,00 €', compras: '14.750,00 €', margen: '24.650,00 €', pct: <Badge tone="amber">37,4%</Badge> },
  { mes: 'Mayo',     ventas: '44.800,00 €', compras: '16.200,00 €', margen: '28.600,00 €', pct: <Badge tone="green">36,2%</Badge> },
  { mes: 'Junio',    ventas: '47.320,00 €', compras: '17.480,00 €', margen: '29.840,00 €', pct: <Badge tone="gold">36,9%</Badge> },
]

const MES_AB = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/* Compras reales por mes del año en curso, derivadas de los albaranes (una sola fuente). */
function comprasPorMesReal(albaranes: Albaran[], year: number, hastaMes: number): number[] {
  const out = Array.from({ length: hastaMes + 1 }, () => 0)
  for (const a of albaranes) {
    const d = new Date(a.ts)
    if (d.getFullYear() === year) {
      const m = d.getMonth()
      if (m <= hastaMes) out[m] += totalAlbaran(a)
    }
  }
  return out
}

export default function Estadisticas() {
  const demo = isDemoMode()
  useRealAgg()
  const albaranes = useCompras()

  if (!demo) return <EstadisticasReal albaranes={albaranes} />

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
          <BarChart data={ventasMesDemo} height={140} color="gold" />
        </Card>
        <Card>
          <div className="card-head">
            <h3>Compras por mes</h3>
            <Badge tone="blue">media 15.152 €</Badge>
          </div>
          <BarChart data={comprasMesDemo} height={140} color="blue" />
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
          rows={comparativaDemo}
        />
      </Card>
    </div>
  )
}

/* ── MODO REAL ──
   Todo deriva de stores reales: ventas vía salesForMonth() (real-aware, 0 sin datos) y compras vía los
   albaranes (useCompras). Solo hay histórico real del año en curso; sin datos = estado vacío honesto.
   Divisiones blindadas (ratio/delta nunca NaN/Infinity). */
function EstadisticasReal({ albaranes }: { albaranes: Albaran[] }) {
  const year = HOY.getFullYear()
  const curM = HOY.getMonth()

  const ventas: number[] = []
  for (let m = 0; m <= curM; m++) ventas.push(salesForMonth(year, m).total)
  const compras = comprasPorMesReal(albaranes, year, curM)

  const ventasBar = ventas.map((v, m) => ({ label: MES_AB[m], value: Math.round(v) }))
  const comprasBar = compras.map((v, m) => ({ label: MES_AB[m], value: Math.round(v) }))

  const ventasMesActual = ventas[curM] ?? 0
  const comprasMesActual = compras[curM] ?? 0
  const ventasMesPrev = curM > 0 ? (ventas[curM - 1] ?? 0) : 0
  const comprasMesPrev = curM > 0 ? (compras[curM - 1] ?? 0) : 0

  const pct = (now: number, prev: number) =>
    prev > 0 ? `${now >= prev ? '+' : ''}${(((now - prev) / prev) * 100).toFixed(1)}%` : undefined
  const ratio = ventasMesActual > 0 ? (comprasMesActual / ventasMesActual) * 100 : 0

  const hayDatos = ventas.some((v) => v > 0) || compras.some((c) => c > 0)

  if (!hayDatos) {
    return (
      <div className="section">
        <SectionHeader
          title="Estadísticas"
          subtitle="Ventas vs compras"
          right={<Badge tone="blue">{year}</Badge>}
        />
        <Card>
          <div className="vtpv-empty">Sin datos suficientes todavía. Cuando registres ventas y compras, aquí verás la comparativa mensual real.</div>
        </Card>
      </div>
    )
  }

  const comparativa = ventas.map((v, m) => {
    const c = compras[m] ?? 0
    const margen = v - c
    const mp = v > 0 ? (margen / v) * 100 : 0
    return {
      mes: MES_LARGO[m],
      ventas: `${eur(v)} €`,
      compras: `${eur(c)} €`,
      margen: `${eur(margen)} €`,
      pct: <Badge tone={v > 0 ? 'green' : 'muted'}>{v > 0 ? `${mp.toFixed(1)}%` : '—'}</Badge>,
    }
  })

  return (
    <div className="section">
      <SectionHeader
        title="Estadísticas"
        subtitle="Ventas vs compras"
        right={<Badge tone="blue">Ene – {MES_AB[curM]} {year}</Badge>}
      />

      <Grid cols={3} className="kpi-grid">
        <KpiTile
          label="Ventas mes actual"
          value={eur(ventasMesActual)}
          unit="€"
          delta={pct(ventasMesActual, ventasMesPrev)}
          foot="vs mes anterior"
          trend={ventasMesActual >= ventasMesPrev ? 'up' : 'down'}
        />
        <KpiTile
          label="Compras mes actual"
          value={eur(comprasMesActual)}
          unit="€"
          delta={pct(comprasMesActual, comprasMesPrev)}
          foot="vs mes anterior"
          trend={comprasMesActual > comprasMesPrev ? 'down' : 'up'}
        />
        <KpiTile
          label="Ratio compra / venta"
          value={ventasMesActual > 0 ? ratio.toFixed(1) : '—'}
          unit={ventasMesActual > 0 ? '%' : undefined}
          foot="meta < 38%"
          trend="flat"
        />
      </Grid>

      <Grid cols={2}>
        <Card>
          <div className="card-head">
            <h3>Ventas por mes</h3>
          </div>
          <BarChart data={ventasBar} height={140} color="gold" />
        </Card>
        <Card>
          <div className="card-head">
            <h3>Compras por mes</h3>
          </div>
          <BarChart data={comprasBar} height={140} color="blue" />
        </Card>
      </Grid>

      <Card>
        <div className="card-head">
          <h3>Comparativa mensual</h3>
          <Badge tone="muted">{comparativa.length} {comparativa.length === 1 ? 'mes' : 'meses'}</Badge>
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
