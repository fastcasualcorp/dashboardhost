import { useMemo } from 'react'
import { Card, SectionHeader, KpiTile, BarChart, DataTable, Badge, Donut, Grid } from '../components/ui'
import { useEquipo, horasSemana, costeHora, costeSemana, costeMes, costeDia, DIAS_CORTO } from '../lib/equipo'
import { VENTAS_MES, salesForDay, HOY } from '../lib/data'
import FuelGauge from '../components/FuelGauge'

/* Coste personal — TODO derivado de la FUENTE ÚNICA `lib/equipo`: coste REAL = horas trabajadas (turnos
   de Horarios) × coste/hora de cada empleado. Edita un sueldo en Empleados o un turno en Horarios y aquí
   cambia al instante. Antes era una tabla 100% estática con personas distintas. (cimiento 0.1, ask de Juan)
   HERO = medidor de combustible: el % sobre ventas como aguja de coche, verde/ámbar/rojo.
   El % usa VENTAS_MES (fuente única, misma que el Resumen → no se contradicen). */

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

    // ── COSTE vs VENTAS día a día (este mes): el cruce que avisa cuándo el equipo se come la venta ──
    const DOW_L = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    const y = HOY.getFullYear(), m = HOY.getMonth()
    const nDays = new Date(y, m + 1, 0).getDate()
    type EstadoDia = 'sin' | 'optimo' | 'limite' | 'reducir' | 'perdida'
    const porDia = Array.from({ length: nDays }, (_, i) => {
      const day = i + 1
      const dow = (new Date(y, m, day).getDay() + 6) % 7 // Lun=0
      const coste = costePorDia[dow]
      const sv = salesForDay(y, m, day)
      const ventas = sv ? sv.total : 0
      const pct = ventas > 0 ? Math.round((coste / ventas) * 100) : null
      const staff = roster.filter((e) => costeDia(e, dow) > 0).map((e) => e.nombre)
      const estado: EstadoDia =
        ventas === 0 ? 'sin' : pct! >= 100 ? 'perdida' : pct! > 32 ? 'reducir' : pct! > 30 ? 'limite' : 'optimo'
      return { day, dowL: DOW_L[dow], coste, ventas, pct, staff, estado }
    })
    const conV = porDia.filter((p) => p.estado !== 'sin')
    const ventasPer = conV.reduce((s, p) => s + p.ventas, 0)
    const costePer = conV.reduce((s, p) => s + p.coste, 0)
    const resumen = {
      optimo: conV.filter((p) => p.estado === 'optimo').length,
      limite: conV.filter((p) => p.estado === 'limite').length,
      reducir: conV.filter((p) => p.estado === 'reducir' || p.estado === 'perdida').length,
      perdida: conV.filter((p) => p.estado === 'perdida').length,
      ventasPer,
      costePer,
      pctPer: ventasPer > 0 ? Math.round((costePer / ventasPer) * 100) : 0,
    }
    return { perEmp, costePorDia, semana, mes, hoy, media, pctVentas, pctCompletas, pctFinde, porDia, resumen }
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

      {/* ── COSTE vs VENTAS, DÍA A DÍA · el cruce que avisa cuándo el equipo se come la venta (Juan 27-jun) ── */}
      <Card>
        <div className="card-head">
          <h3>Coste vs ventas · día a día</h3>
          <Badge tone={d.resumen.pctPer > 32 ? 'red' : d.resumen.pctPer > 30 ? 'amber' : 'green'}>{d.resumen.pctPer}% del período</Badge>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 16px' }}>
          <Badge tone="green">✓ {d.resumen.optimo} días óptimos</Badge>
          {d.resumen.limite > 0 && <Badge tone="amber">⚠ {d.resumen.limite} al límite (30–32%)</Badge>}
          {d.resumen.reducir > 0 && <Badge tone="red">▼ {d.resumen.reducir} días · sobra personal</Badge>}
          {d.resumen.perdida > 0 && <Badge tone="red">🚨 {d.resumen.perdida} días · el coste SUPERÓ las ventas</Badge>}
        </div>
        <DataTable
          columns={[
            { key: 'dia', label: 'Día' },
            { key: 'staff', label: 'Personal en turno' },
            { key: 'coste', label: 'Coste', align: 'right' as const },
            { key: 'ventas', label: 'Ventas', align: 'right' as const },
            { key: 'pct', label: '% Personal', align: 'right' as const },
            { key: 'estado', label: 'Estado', align: 'right' as const },
          ]}
          rows={d.porDia.map((p) => ({
            dia: <b>{p.dowL} {p.day}</b>,
            staff: <span className="coste-staff" title={p.staff.join(', ')}>{p.staff.length ? p.staff.map((n) => n.split(' ')[0]).join(', ') : '—'}</span>,
            coste: fmt0(p.coste) + ' €',
            ventas: p.ventas ? fmt0(p.ventas) + ' €' : '—',
            pct: p.pct != null ? <b style={{ color: p.estado === 'perdida' || p.estado === 'reducir' ? G_ROJO : p.estado === 'limite' ? G_AMBAR : G_VERDE }}>{p.pct}%</b> : '—',
            estado:
              p.estado === 'sin' ? <Badge tone="muted">Sin ventas</Badge>
              : p.estado === 'perdida' ? <Badge tone="red">Coste &gt; ventas</Badge>
              : p.estado === 'reducir' ? <Badge tone="red">Reducir personal</Badge>
              : p.estado === 'limite' ? <Badge tone="amber">Revisa turnos</Badge>
              : <Badge tone="green">Óptimo</Badge>,
          }))}
        />
      </Card>

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
