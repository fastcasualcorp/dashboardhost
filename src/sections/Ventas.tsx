import { useState } from 'react'
import { SectionHeader, Badge } from '../components/ui'
import { eur0, salesForDay, salesForMonth, salesForYear, HOY } from '../lib/data'
import { play } from '../lib/sound'

/* Ventas — calendario de 12 meses (uno por tarjeta). Cada día con venta lleva un
   punto cuya intensidad sube con la facturación; pie con efectivo/tarjeta/total
   del mes. Reusa la matemática de rejilla de DatePicker (lunes primero). Diseño
   REBELL (dark premium), no el del panel del socio. */

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function MonthCard({ y, m }: { y: number; m: number }) {
  const offset = (new Date(y, m, 1).getDay() + 6) % 7 // lunes = 0
  const dim = new Date(y, m + 1, 0).getDate()
  const agg = salesForMonth(y, m)
  const hasData = agg.dias > 0

  let maxDay = 1
  for (let d = 1; d <= dim; d++) {
    const s = salesForDay(y, m, d)
    if (s && s.total > maxDay) maxDay = s.total
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= dim; d++) cells.push(d)

  return (
    <div className={'vmonth' + (hasData ? '' : ' off')}>
      <div className="vm-head">
        <span className="vm-name">{MESES[m]}</span>
      </div>
      <div className="vm-wd">
        {WD.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="vm-grid">
        {cells.map((d, i) => {
          if (d === null) return <span key={i} className="vm-cell empty" />
          const s = salesForDay(y, m, d)
          const today = y === HOY.getFullYear() && m === HOY.getMonth() && d === HOY.getDate()
          const intensity = s ? 0.34 + 0.66 * (s.total / maxDay) : 0
          return (
            <span key={i} className={'vm-cell' + (s ? ' has' : ' none') + (today ? ' today' : '')} title={s ? `${d} · ${eur0(s.total)} €` : ''}>
              <i>{d}</i>
              {s && <em className="vm-dot" style={{ opacity: intensity }} />}
            </span>
          )
        })}
      </div>
      <div className="vm-foot">
        <div className="vm-row">
          <span>Efectivo</span>
          <b className="c-cash tnum">{hasData ? eur0(agg.e) + ' €' : '—'}</b>
        </div>
        <div className="vm-row">
          <span>Tarjeta</span>
          <b className="c-card tnum">{hasData ? eur0(agg.t) + ' €' : '—'}</b>
        </div>
        <div className="vm-row tot">
          <span>Total mes</span>
          <b className="tnum">{hasData ? eur0(agg.total) + ' €' : '—'}</b>
        </div>
      </div>
    </div>
  )
}

export default function Ventas() {
  const [year, setYear] = useState(2026)
  const yearTotal = salesForYear(year)

  return (
    <div className="section">
      <SectionHeader
        title="Ventas"
        subtitle="Calendario de ventas por día"
        right={
          <div className="ventas-year">
            <button onClick={() => { setYear((y) => y - 1); play('tap', 0.4, 0.9) }} aria-label="Año anterior">
              ‹
            </button>
            <b>{year}</b>
            <button onClick={() => { setYear((y) => y + 1); play('tap', 0.4, 1.1) }} aria-label="Año siguiente">
              ›
            </button>
            <Badge tone="gold">{eur0(yearTotal)} €</Badge>
          </div>
        }
      />
      <div className="ventas-grid">
        {Array.from({ length: 12 }, (_, m) => (
          <MonthCard key={m} y={year} m={m} />
        ))}
      </div>
    </div>
  )
}
