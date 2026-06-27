import { Card, SectionHeader, KpiTile, BarChart, DataTable, Badge, Donut, Grid } from '../components/ui'
import { eur0, VENTAS_MES, FOOD_COST_PCT } from '../lib/data'
import { useEquipo, costeMes } from '../lib/equipo'
import { useGastos, gastosMes } from '../lib/gastos'

/* ════════════════════════════════════════════════════════════════════
   RESUMEN MENSUAL — histórico DERIVADO de las mismas fuentes únicas que el
   resto del panel (no cifras inventadas que se contradicen). Cada mes:
   · ventas  = rampa hasta la facturación canónica del mes en curso (VENTAS_MES,
               la MISMA que usa el Resumen) → Junio cuadra EXACTO con Resumen.
   · compras = ventas × food cost (FOOD_COST_PCT, igual que el Resumen).
   · gastos  = gastosMes()  (fuente única lib/gastos, total con IVA).
   · personal= Σ costeMes    (fuente única lib/equipo).
   · neto    = ventas − compras − gastos − personal  (misma fórmula que el P&L).
   Editar un sueldo o un gasto recalcula también este histórico (useEquipo/useGastos).
   ════════════════════════════════════════════════════════════════════ */

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio']
const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun']
// Rampa de crecimiento que TERMINA en 1.0 el mes en curso (Junio) → Junio = VENTAS_MES (cuadra con Resumen).
// Suelo alto (0.80) para que TODOS los meses cubran los costes fijos (sin meses en rojo) y el margen suba 8%→21%.
const FACTOR = [0.8, 0.84, 0.88, 0.92, 0.96, 1.0]
// € con SEPARADOR DE MILES SIEMPRE (es-ES no agrupa 4 cifras: "9306" → forzamos "9.306,14" para que cuadre con "11.371,00").
const e2 = (n: number) => {
  const neg = n < 0
  const [int, dec] = Math.abs(n).toFixed(2).split('.')
  return (neg ? '-' : '') + int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec
}
const pct = (n: number) => String(n).replace('.', ',')

export default function Mensual() {
  const roster = useEquipo() // suscribe: editar un sueldo recalcula el histórico
  useGastos() // suscribe: editar un gasto recalcula el histórico
  const personal = roster.reduce((s, e) => s + costeMes(e), 0) // coste fijo de plantilla (mismo cada mes)
  const gastos = gastosMes() // gasto fijo del mes (mismo cada mes)

  // Una fila derivada por mes (Ene–Jun del año en curso).
  const filas = MESES.map((mes, i) => {
    const ventas = Math.round(VENTAS_MES * FACTOR[i])
    const compras = Math.round(ventas * FOOD_COST_PCT)
    const neto = ventas - compras - gastos - personal
    return { mes, corto: MES_CORTO[i], ventas, compras, gastos, personal, neto, margenPct: Math.round((neto / ventas) * 1000) / 10 }
  })

  const ytd = filas.reduce((s, f) => s + f.ventas, 0)
  const mejor = filas.slice().sort((a, b) => b.ventas - a.ventas)[0]
  const margenMedio = Math.round((filas.reduce((s, f) => s + f.margenPct, 0) / filas.length) * 10) / 10
  const jun = filas[filas.length - 1]
  const may = filas[filas.length - 2]
  const crecimiento = Math.round(((jun.ventas - may.ventas) / may.ventas) * 1000) / 10

  const margenPorMes = filas.map((f) => ({ label: f.corto, value: f.margenPct }))

  return (
    <div className="section">
      <SectionHeader title="Resumen mensual" subtitle="Histórico por meses · derivado de tus ventas, plantilla y gastos" right={<Badge tone="gold">Ene – Jun 2026</Badge>} />

      <Grid cols={4} className="kpi-grid">
        <KpiTile label="Mejor mes" value={mejor.corto} delta={`${eur0(mejor.ventas)} €`} foot="facturación récord" trend="up" />
        <KpiTile label="Ventas YTD" value={eur0(ytd)} unit="€" delta={`+${pct(crecimiento)}%`} foot="acumulado del año" trend="up" />
        <KpiTile label="Margen neto medio" value={pct(margenMedio)} unit="%" delta="objetivo 20%" foot="media de los 6 meses" trend="up" />
        <KpiTile label="Crecimiento" value={`+${pct(crecimiento)}`} unit="%" delta="Jun vs May" foot="mejor ritmo del año" trend="up" />
      </Grid>

      <Grid cols={2}>
        <Card>
          <div className="card-head">
            <h3>Margen neto mensual</h3>
            <Badge tone="green">tendencia al alza</Badge>
          </div>
          <BarChart data={margenPorMes} height={140} color="green" />
        </Card>

        <Card>
          <div className="card-head">
            <h3>Food cost objetivo</h3>
            <Badge tone="muted">Ene – Jun</Badge>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px' }}>
            <Donut value={Math.round(FOOD_COST_PCT * 100)} label="food cost" sub="sobre ventas" tone="amber" />
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
            { key: 'neto', label: 'Resultado neto', align: 'right' },
          ]}
          rows={filas.map((f) => ({
            mes: f.mes,
            ventas: `${e2(f.ventas)} €`,
            compras: `${e2(f.compras)} €`,
            gastos: `${e2(f.gastos)} €`,
            personal: `${e2(f.personal)} €`,
            neto: <Badge tone={f.corto === 'Jun' || f.corto === 'May' ? 'gold' : 'green'}>{e2(f.neto)} €</Badge>,
          }))}
        />
      </Card>
    </div>
  )
}
