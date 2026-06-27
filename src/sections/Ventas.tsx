import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SectionHeader, Badge, Card, Stat, StatRow } from '../components/ui'
import { eur0, eur, salesForDay, HOY } from '../lib/data'
import { useVentas, ventasPorDia, dayKey } from '../lib/ventas'
import { useEquipo } from '../lib/equipo'
import { play } from '../lib/sound'

/* Ventas — calendario de 12 meses (uno por tarjeta). Cada día con venta lleva un
   punto cuya intensidad sube con la facturación; pie con efectivo/tarjeta/total
   del mes. Reusa la matemática de rejilla de DatePicker (lunes primero). Diseño
   REBELL (dark premium), no el del panel del socio.
   UNIFICADO (27-jun): sobre la base determinista se SUMAN las ventas REALES del
   libro (lib/ventas: TPV + pedidos online), así un cobro aparece en su día — antes
   el calendario era un mock desconectado y las ventas de hoy ni salían. */

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

type Dia = { e: number; t: number; d: number; total: number }
type Real = Map<string, { e: number; t: number; total: number }>

// Base determinista (data.ts) + ventas reales del libro, fusionadas por día.
function combinedDay(y: number, m: number, day: number, real: Real): Dia | null {
  const base = salesForDay(y, m, day)
  const r = real.get(dayKey(y, m, day))
  if (!base && !r) return null
  return {
    e: (base?.e || 0) + (r?.e || 0),
    t: (base?.t || 0) + (r?.t || 0),
    d: base?.d || 0,
    total: (base?.total || 0) + (r?.total || 0),
  }
}
function combinedMonth(y: number, m: number, real: Real): Dia & { dias: number } {
  const days = new Date(y, m + 1, 0).getDate()
  let e = 0, t = 0, d = 0, total = 0, dias = 0
  for (let day = 1; day <= days; day++) {
    const s = combinedDay(y, m, day, real)
    if (s) { e += s.e; t += s.t; d += s.d; total += s.total; dias++ }
  }
  return { e, t, d, total, dias }
}

function MonthCard({ y, m, real, onDay }: { y: number; m: number; real: Real; onDay: (day: number) => void }) {
  const offset = (new Date(y, m, 1).getDay() + 6) % 7 // lunes = 0
  const dim = new Date(y, m + 1, 0).getDate()
  const agg = combinedMonth(y, m, real)
  const hasData = agg.dias > 0

  let maxDay = 1
  for (let d = 1; d <= dim; d++) {
    const s = combinedDay(y, m, d, real)
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
          const s = combinedDay(y, m, d, real)
          const real1 = real.has(dayKey(y, m, d)) // día con venta REAL (TPV/online) → marca viva
          const today = y === HOY.getFullYear() && m === HOY.getMonth() && d === HOY.getDate()
          const intensity = s ? 0.34 + 0.66 * (s.total / maxDay) : 0
          return (
            <span
              key={i}
              className={'vm-cell' + (s ? ' has' : ' none') + (today ? ' today' : '') + (real1 ? ' real' : '')}
              title={s ? `${d} · ${eur0(s.total)} € · pulsa para ver el detalle` : ''}
              role={s ? 'button' : undefined}
              tabIndex={s ? 0 : undefined}
              onClick={s ? () => onDay(d) : undefined}
              style={s ? { cursor: 'pointer' } : undefined}
            >
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
  const ventas = useVentas() // re-render al registrarse una venta (TPV/online)
  const real = ventasPorDia(ventas)
  const roster = useEquipo()
  const [sel, setSel] = useState<{ m: number; day: number } | null>(null) // día abierto en el detalle

  // Agregado del año (efectivo/tarjeta/domicilio + total) con base + ventas reales.
  let yCash = 0, yCard = 0, yHome = 0, yearTotal = 0
  for (let m = 0; m < 12; m++) { const a = combinedMonth(year, m, real); yCash += a.e; yCard += a.t; yHome += a.d; yearTotal += a.total }

  // Exportar el año a Excel (CSV): una fila por día con desglose y total.
  function exportarExcel() {
    const head = ['Fecha', 'Efectivo', 'Tarjeta', 'Domicilio', 'Total']
    const rows: string[][] = []
    for (let m = 0; m < 12; m++) {
      const dim = new Date(year, m + 1, 0).getDate()
      for (let d = 1; d <= dim; d++) {
        const s = combinedDay(year, m, d, real)
        if (s) rows.push([`${d}/${m + 1}/${year}`, String(s.e), String(s.t), String(s.d), String(s.total)])
      }
    }
    const csv = [head, ...rows].map((r) => r.map((c) => `"${c}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ventas-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
    play('success', 0.4, 1.1)
  }

  return (
    <div className="section">
      <SectionHeader
        title="Ventas"
        subtitle="Calendario de ventas por día · incluye tus cobros reales del TPV y online"
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
            <button className="salon-btn primary ventas-xls" onClick={exportarExcel}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
              </svg>
              Excel
            </button>
          </div>
        }
      />

      {/* Banda-resumen del año con el criterio de cifra canónico (<Stat>) */}
      <Card className="stat-band">
        <StatRow>
          <Stat value={eur0(yCash)} unit="€" label="Efectivo" count={false} />
          <Stat value={eur0(yCard)} unit="€" label="Tarjeta" count={false} />
          <Stat value={eur0(yHome)} unit="€" label="Domicilio" count={false} />
          <Stat value={eur0(yearTotal)} unit="€" label={`Total ${year}`} tone="green" count={false} />
        </StatRow>
      </Card>

      <div className="ventas-grid">
        {Array.from({ length: 12 }, (_, m) => (
          <MonthCard key={m} y={year} m={m} real={real} onDay={(day) => { setSel({ m, day }); play('tap') }} />
        ))}
      </div>

      {/* ── DETALLE DEL DÍA: turnos mañana/tarde + responsable (auto). Reusa el modal premium de Ventas TPV ── */}
      <AnimatePresence>
        {sel && (() => {
          const dd = combinedDay(year, sel.m, sel.day, real)
          if (!dd) return null
          const split = (f: number) => ({ e: Math.round(dd.e * f), t: Math.round(dd.t * f), d: Math.round(dd.d * f), sub: Math.round(dd.total * f) })
          const man = split(0.36), tar = split(0.64) // reparto mañana/tarde (mismo ritmo que la caja base)
          const resp = roster.length ? roster[(sel.day + sel.m) % roster.length].nombre : '—'
          const turno = (lbl: string, tone: string, x: { e: number; t: number; d: number; sub: number }) => (
            <div className="vt-turno">
              <div className={'vt-turno-h ' + tone}>{lbl}</div>
              <div className="vtpv-dr-row"><span>💵 Efectivo</span><b className="tnum">{eur(x.e)} €</b></div>
              <div className="vtpv-dr-row"><span>💳 Tarjeta</span><b className="tnum">{eur(x.t)} €</b></div>
              <div className="vtpv-dr-row"><span>🛵 Domicilio</span><b className="tnum">{eur(x.d)} €</b></div>
              <div className="vtpv-dr-row vt-sub"><span>Subtotal</span><b className="tnum">{eur(x.sub)} €</b></div>
            </div>
          )
          return (
            <>
              <motion.div className="vtpv-scrim" onClick={() => setSel(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
              <div className="vtpv-center">
              <motion.div className="vtpv-z vt-day" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
                <div className="vtpv-z-head">
                  <div className="vtpv-z-id">
                    <span className="vtpv-z-kick">Detalle del día</span>
                    <b>{sel.day} de {MESES[sel.m]} de {year}</b>
                  </div>
                  <button className="vtpv-dr-close" onClick={() => setSel(null)} aria-label="Cerrar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </div>
                <div className="vt-turnos">
                  {turno('☀ Turno mañana', 'man', man)}
                  {turno('☾ Turno tarde', 'tar', tar)}
                </div>
                <div className="vtpv-dr-row vt-resp"><span>Responsable</span><b>{resp}</b></div>
                <div className="vtpv-dr-tot"><span>Total del día</span><b className="tnum">{eur(dd.total)} €</b></div>
              </motion.div>
              </div>
            </>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
