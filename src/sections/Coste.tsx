import { useMemo } from 'react'
import { Card, SectionHeader, KpiTile, BarChart, DataTable, Badge, Donut, Grid } from '../components/ui'
import { useEquipo, horasSemana, costeHora, costeSemana, costeMes, costeDia, DIAS_CORTO } from '../lib/equipo'
import FuelGauge from '../components/FuelGauge'

/* Coste personal — TODO derivado de la FUENTE ÚNICA `lib/equipo`: coste REAL = horas trabajadas (turnos
   de Horarios) × coste/hora de cada empleado. Edita un sueldo en Empleados o un turno en Horarios y aquí
   cambia al instante. Antes era una tabla 100% estática con personas distintas. (cimiento 0.1, ask de Juan)
   HERO = medidor de combustible: el % sobre ventas como aguja de coche, verde/ámbar/rojo. */

// Facturación del mes para el % sobre ventas. PENDIENTE (0.3): enchufar a la fuente única VENTAS real.
const VENTAS_MES = 48250
const G_VERDE = '#34d399'
const G_AMBAR = '#f5a524'
const G_ROJO = '#f8716a'
const GAUGE_ZONES = [{ to: 28, color: G_VERDE }, { to: 32, color: G_AMBAR }, { to: 45, color: G_ROJO }]

const fmt2 = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt0 = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 })
const todayIdx = (new Date().getDay() + 6) % 7 // Lun=0 … Dom=6

export default function Coste() {
  const roster = useEquipo()

  const d = useMemo(() => {
    const perEmp = roster.map((e) => ({ nombre: e.nombre, horas: horasSemana(e), costeHora: costeHora(e), costeSem: costeSemana(e) }))
    const costePorDia = DIAS_CORTO.map((_, di) => Math.round(roster.reduce((s, e) => s + costeDia(e, di), 0)))
    const semana = perEmp.reduce((s, e) => s + e.costeSem, 0)
    const mes = roster.reduce((s, e) => s + costeMes(e), 0)
    const hoy = costePorDia[todayIdx]
    const media = Math.round(costePorDia.reduce((s, v) => s + v, 0) / 7)
    const pctVentas = Math.round((mes / VENTAS_MES) * 100)
    const completas = roster.filter((e) => e.jornada === 'Completa').length
    const pctCompletas = roster.length ? Math.round((completas / roster.length) * 100) : 0
    const costeFinde = costePorDia[5] + costePorDia[6]
    const pctFinde = semana > 0 ? Math.round((costeFinde / semana) * 100) : 0
    return { perEmp, costePorDia, semana, mes, hoy, media, pctVentas, pctCompletas, pctFinde }
  }, [roster])

  const zona = d.pctVentas <= 28 ? { text: 'Coste sano', color: G_VERDE } : d.pctVentas <= 32 ? { text: 'Ajustado', color: G_AMBAR } : { text: 'Alto', color: G_ROJO }

  return (
    <div className="section">
      <SectionHeader
        title="Coste personal"
        subtitle="Análisis de coste"
        right={<Badge tone={d.pctVentas > 32 ? 'amber' : 'green'}>{d.pctVentas}% s/ventas</Badge>}
      />

      {/* HERO — medidor de combustible del coste sobre ventas */}
      <Card>
        <div className="card-head">
          <h3>Coste sobre ventas</h3>
          <Badge tone="muted">umbral sano ≤ 28%</Badge>
        </div>
        <div className="coste-hero">
          <FuelGauge value={d.pctVentas} max={45} zones={GAUGE_ZONES} label="del coste sobre ventas" status={zona} />
          <div className="coste-hero-side">
            <div className="che-stat"><b className="tnum">{fmt0(d.mes)} €</b><span>coste de personal / mes</span></div>
            <div className="che-stat"><b className="tnum">{fmt0(VENTAS_MES)} €</b><span>facturación del mes</span></div>
            <ul className="che-zones">
              <li><i style={{ background: G_VERDE }} />Sano · ≤ 28%</li>
              <li><i style={{ background: G_AMBAR }} />Ajustado · 28–32%</li>
              <li><i style={{ background: G_ROJO }} />Alto · + 32%</li>
            </ul>
          </div>
        </div>
      </Card>

      <Grid cols={3} className="kpi-grid">
        <KpiTile label="Coste hoy" value={fmt0(d.hoy)} unit="€" delta="real" foot="turnos de hoy" trend="flat" />
        <KpiTile label="Coste semana" value={fmt0(d.semana)} unit="€" delta="real" foot="horas × coste/hora" trend="flat" />
        <KpiTile label="Coste mes" value={fmt0(d.mes)} unit="€" delta="estimado" foot="semana × 4,33" trend="flat" />
      </Grid>

      <Grid cols={2}>
        <Card>
          <div className="card-head">
            <h3>Coste por día · esta semana</h3>
            <Badge tone="amber">media {fmt0(d.media)} €</Badge>
          </div>
          <BarChart data={DIAS_CORTO.map((l, i) => ({ label: l, value: d.costePorDia[i] }))} height={140} color="amber" />
        </Card>

        <Card>
          <div className="card-head">
            <h3>Distribución del coste</h3>
            <Badge tone="muted">{roster.length} empleados</Badge>
          </div>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', justifyContent: 'space-around', padding: '1rem 0' }}>
            <Donut value={d.pctCompletas} label="jornadas completas" sub="vs contratos parciales" tone="green" />
            <Donut value={d.pctFinde} label="peso del finde" sub="sáb+dom sobre semana" tone="amber" />
          </div>
        </Card>
      </Grid>

      <Card>
        <div className="card-head">
          <h3>Detalle por empleado</h3>
          <Badge tone="muted">semana actual</Badge>
        </div>
        <DataTable
          columns={[
            { key: 'empleado', label: 'Empleado' },
            { key: 'horas', label: 'Horas/sem', align: 'right' as const },
            { key: 'costeHora', label: 'Coste/hora', align: 'right' as const },
            { key: 'costeSem', label: 'Coste/sem', align: 'right' as const },
          ]}
          rows={d.perEmp.map((e) => ({
            empleado: e.nombre,
            horas: e.horas,
            costeHora: fmt2(e.costeHora) + ' €',
            costeSem: fmt2(e.costeSem) + ' €',
          }))}
        />
      </Card>
    </div>
  )
}
