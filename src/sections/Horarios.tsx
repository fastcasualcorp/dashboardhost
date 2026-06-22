import { useMemo, useState } from 'react'
import { Card, SectionHeader, KpiTile, DataTable, Badge, Donut, Grid } from '../components/ui'
import { play } from '../lib/sound'

/* Una sola fuente de verdad: cada empleado tiene 7 días, y cada día
   dos turnos conmutables {m: mañana, t: tarde}. Todo lo demás (horas,
   coste, donuts, KPIs) se deriva de aquí y reacciona al instante. */
type Dia = { m: boolean; t: boolean }
type Emp = { nombre: string; dias: Dia[] }

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DIAS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const SEED: Record<string, string[]> = {
  'Carlos M.': ['M', 'M', 'M', 'T', 'T', 'M', 'L'],
  'Lucía R.': ['T', 'T', 'L', 'M', 'M', 'T', 'T'],
  'Pablo S.': ['M', 'L', 'M', 'M', 'T', 'T', 'M'],
  'Marta G.': ['L', 'M', 'T', 'T', 'M', 'M', 'T'],
  'David F.': ['T', 'M', 'M', 'L', 'M', 'T', 'M'],
  'Ana P.': ['M', 'T', 'T', 'M', 'L', 'M', 'T'],
}
const INIT: Emp[] = Object.entries(SEED).map(([nombre, ts]) => ({
  nombre,
  dias: ts.map((t) => ({ m: t === 'M', t: t === 'T' })),
}))

const Sun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
  </svg>
)
const Moon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
)
const eur0 = (n: number) => n.toLocaleString('es-ES')

export default function Horarios() {
  const [grid, setGrid] = useState<Emp[]>(INIT)

  function toggle(ei: number, di: number, slot: 'm' | 't') {
    play('tap', 0.4)
    setGrid((g) => g.map((e, i) => (i !== ei ? e : { ...e, dias: e.dias.map((d, j) => (j !== di ? d : { ...d, [slot]: !d[slot] })) })))
  }

  const der = useMemo(() => {
    const perEmp = grid.map((e) => {
      const m = e.dias.filter((d) => d.m).length
      const t = e.dias.filter((d) => d.t).length
      const libres = e.dias.filter((d) => !d.m && !d.t).length
      const horas = (m + t) * 8
      return { nombre: e.nombre, m, t, libres, horas, coste: horas * 10 }
    })
    const totalHoras = perEmp.reduce((s, e) => s + e.horas, 0)
    const totalM = perEmp.reduce((s, e) => s + e.m, 0)
    const totalT = perEmp.reduce((s, e) => s + e.t, 0)
    const totalLibres = perEmp.reduce((s, e) => s + e.libres, 0)
    const activos = perEmp.filter((e) => e.horas > 0).length
    const shifts = totalM + totalT || 1
    return { perEmp, totalHoras, totalM, totalT, totalLibres, activos, coste: totalHoras * 10, shifts }
  }, [grid])

  return (
    <div className="section">
      <SectionHeader title="Horarios" subtitle="Turnos semanales" right={<Badge tone="amber">Semana 25 · Jun 2026</Badge>} />

      <Grid cols={3} className="kpi-grid">
        <KpiTile label="Horas semana" value={eur0(der.totalHoras)} unit="h" delta="+4 h" foot="vs semana anterior" trend="up" />
        <KpiTile label="Empleados activos" value={String(der.activos)} delta="0" foot="plantilla completa" trend="flat" />
        <KpiTile label="Coste semana" value={eur0(der.coste)} unit="€" delta="+3,2%" foot="vs media mensual" trend="down" />
      </Grid>

      <Card>
        <div className="card-head">
          <h3>Rejilla semanal de turnos</h3>
          <Badge tone="muted">toca para activar mañana ☀ o tarde ☾</Badge>
        </div>

        <div className="sched">
          <div className="sched-grid">
            <span className="sg-h l">Empleado</span>
            {DIAS.map((d, i) => (
              <span key={d} className="sg-h" title={DIAS_FULL[i]}>
                {d}
              </span>
            ))}
            <span className="sg-h r">Horas</span>

            {grid.map((emp, ei) => (
              <div className="sg-rowcontents" key={emp.nombre} style={{ display: 'contents' }}>
                <span className="sg-emp">{emp.nombre}</span>
                {emp.dias.map((d, di) => (
                  <span className="sg-cell" key={di}>
                    <button
                      className={'sg-slot m' + (d.m ? ' on' : '')}
                      onClick={() => toggle(ei, di, 'm')}
                      aria-pressed={d.m}
                      aria-label={`${emp.nombre} · ${DIAS_FULL[di]} · mañana`}
                      title="Mañana · 08:00–16:00"
                    >
                      <Sun />
                    </button>
                    <button
                      className={'sg-slot t' + (d.t ? ' on' : '')}
                      onClick={() => toggle(ei, di, 't')}
                      aria-pressed={d.t}
                      aria-label={`${emp.nombre} · ${DIAS_FULL[di]} · tarde`}
                      title="Tarde · 14:00–22:00"
                    >
                      <Moon />
                    </button>
                  </span>
                ))}
                <span className="sg-hours tnum">{der.perEmp[ei].horas} h</span>
              </div>
            ))}
          </div>
        </div>

        <div className="sched-legend">
          <span className="sl-it">
            <span className="sl-ic m">
              <Sun />
            </span>
            Mañana · 08:00–16:00
          </span>
          <span className="sl-it">
            <span className="sl-ic t">
              <Moon />
            </span>
            Tarde · 14:00–22:00
          </span>
          <span className="sl-it muted">Casilla vacía = libre</span>
        </div>
      </Card>

      <Grid cols={2}>
        <Card>
          <div className="card-head">
            <h3>Resumen por empleado</h3>
            <Badge tone="muted">semana actual</Badge>
          </div>
          <DataTable
            columns={[
              { key: 'nombre', label: 'Empleado' },
              { key: 'm', label: '☀', align: 'right' },
              { key: 't', label: '☾', align: 'right' },
              { key: 'libres', label: 'Libre', align: 'right' },
              { key: 'horas', label: 'Horas', align: 'right' },
              { key: 'coste', label: 'Coste', align: 'right' },
            ]}
            rows={der.perEmp.map((e) => ({
              nombre: e.nombre,
              m: <Badge tone="gold">{e.m}</Badge>,
              t: <Badge tone="blue">{e.t}</Badge>,
              libres: <Badge tone="muted">{e.libres}</Badge>,
              horas: e.horas + ' h',
              coste: eur0(e.coste) + ' €',
            }))}
          />
        </Card>

        <Card>
          <div className="card-head">
            <h3>Carga por turno</h3>
            <Badge tone="muted">distribución semanal</Badge>
          </div>
          <div className="sched-donuts">
            <Donut value={Math.round((der.totalM / der.shifts) * 100)} label="mañanas" sub={der.totalM + ' turnos'} tone="gold" />
            <Donut value={Math.round((der.totalT / der.shifts) * 100)} label="tardes" sub={der.totalT + ' turnos'} tone="blue" />
            <Donut value={Math.round((der.totalLibres / (grid.length * 7)) * 100)} label="libres" sub={der.totalLibres + ' días'} tone="amber" />
          </div>
        </Card>
      </Grid>
    </div>
  )
}
