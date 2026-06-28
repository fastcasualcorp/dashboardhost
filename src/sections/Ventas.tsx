import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SectionHeader, Badge, Card, Stat, StatRow } from '../components/ui'
import { eur0, eur, salesForDay, HOY, useRealAgg } from '../lib/data'
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
// AJUSTE MANUAL por día: el dueño corrige/cierra el día por turnos y se guarda. El override MANDA
// sobre lo derivado (base + ventas reales) → así "lleva un control" real (Juan, 28-jun).
type Turn = { e: number; t: number; d: number }
type DayOvr = { man: Turn; tar: Turn }
type Ovr = Record<string, DayOvr>

const OVR_KEY = 'rebell-ventas-ovr-v1'
const loadOvr = (): Ovr => { try { return JSON.parse(localStorage.getItem(OVR_KEY) || '{}') } catch { return {} } }
const saveOvr = (v: Ovr) => { try { localStorage.setItem(OVR_KEY, JSON.stringify(v)) } catch { /* sin localStorage */ } }
const turnTotal = (x: Turn) => x.e + x.t + x.d

// Base determinista (data.ts) + ventas reales del libro, fusionadas por día. Si hay AJUSTE manual, manda.
function combinedDay(y: number, m: number, day: number, real: Real, ovr?: Ovr): Dia | null {
  const k = dayKey(y, m, day)
  const o = ovr?.[k]
  if (o) {
    const e = o.man.e + o.tar.e, t = o.man.t + o.tar.t, d = o.man.d + o.tar.d
    return { e, t, d, total: e + t + d }
  }
  const base = salesForDay(y, m, day)
  const r = real.get(k)
  if (!base && !r) return null
  return {
    e: (base?.e || 0) + (r?.e || 0),
    t: (base?.t || 0) + (r?.t || 0),
    d: base?.d || 0,
    total: (base?.total || 0) + (r?.total || 0),
  }
}
function combinedMonth(y: number, m: number, real: Real, ovr?: Ovr): Dia & { dias: number } {
  const days = new Date(y, m + 1, 0).getDate()
  let e = 0, t = 0, d = 0, total = 0, dias = 0
  for (let day = 1; day <= days; day++) {
    const s = combinedDay(y, m, day, real, ovr)
    if (s) { e += s.e; t += s.t; d += s.d; total += s.total; dias++ }
  }
  return { e, t, d, total, dias }
}
// Turnos de un día: el ajuste manual si existe, si no el reparto derivado (mañana 36% / tarde 64%).
function dayTurns(y: number, m: number, day: number, real: Real, ovr: Ovr): DayOvr {
  const o = ovr[dayKey(y, m, day)]
  if (o) return o
  const dd = combinedDay(y, m, day, real, ovr)
  const split = (f: number): Turn => ({ e: Math.round((dd?.e || 0) * f), t: Math.round((dd?.t || 0) * f), d: Math.round((dd?.d || 0) * f) })
  return { man: split(0.36), tar: split(0.64) }
}

function MonthCard({ y, m, real, ovr, onDay }: { y: number; m: number; real: Real; ovr: Ovr; onDay: (day: number) => void }) {
  const offset = (new Date(y, m, 1).getDay() + 6) % 7 // lunes = 0
  const dim = new Date(y, m + 1, 0).getDate()
  const agg = combinedMonth(y, m, real, ovr)
  const hasData = agg.dias > 0

  let maxDay = 1
  for (let d = 1; d <= dim; d++) {
    const s = combinedDay(y, m, d, real, ovr)
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
          const s = combinedDay(y, m, d, real, ovr)
          const real1 = real.has(dayKey(y, m, d)) || !!ovr[dayKey(y, m, d)] // día con venta real o ajuste manual → marca viva
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
  useRealAgg() // calendario de ventas REAL en modo real (RPC)
  const [year, setYear] = useState(2026)
  const ventas = useVentas() // re-render al registrarse una venta (TPV/online)
  const real = ventasPorDia(ventas)
  const roster = useEquipo()
  const [sel, setSel] = useState<{ m: number; day: number } | null>(null) // día abierto en el detalle
  const [ovr, setOvr] = useState<Ovr>(() => loadOvr()) // ajustes manuales por día
  const [edit, setEdit] = useState(false) // ¿modo edición del día abierto?
  const [draft, setDraft] = useState<DayOvr | null>(null) // copia de trabajo mientras se edita

  // Abre el detalle de un día (lectura). El ajuste manual arranca al pulsar "Editar".
  function openDay(m: number, day: number) { setSel({ m, day }); setEdit(false); setDraft(null); play('tap') }
  function startEdit() {
    if (!sel) return
    setDraft(dayTurns(year, sel.m, sel.day, real, ovr))
    setEdit(true)
    play('tap', 0.5, 1.1)
  }
  function setField(turno: 'man' | 'tar', campo: keyof Turn, v: number) {
    setDraft((d) => (d ? { ...d, [turno]: { ...d[turno], [campo]: Math.max(0, Math.round(v || 0)) } } : d))
  }
  function guardar() {
    if (!sel || !draft) return
    const next = { ...ovr, [dayKey(year, sel.m, sel.day)]: draft }
    setOvr(next); saveOvr(next); setEdit(false); setDraft(null)
    play('success', 0.5, 1.1)
  }

  // Agregado del año (efectivo/tarjeta/domicilio + total) con base + ventas reales + ajustes.
  let yCash = 0, yCard = 0, yHome = 0, yearTotal = 0
  for (let m = 0; m < 12; m++) { const a = combinedMonth(year, m, real, ovr); yCash += a.e; yCard += a.t; yHome += a.d; yearTotal += a.total }

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
          <MonthCard key={m} y={year} m={m} real={real} ovr={ovr} onDay={(day) => openDay(m, day)} />
        ))}
      </div>

      {/* ── DETALLE DEL DÍA: turnos mañana/tarde + responsable (auto). EDITABLE: el dueño cierra/corrige
            el día por turnos y se guarda (manda sobre lo derivado). Reusa el modal premium de Ventas TPV ── */}
      <AnimatePresence>
        {sel && (() => {
          const shown = edit && draft ? draft : dayTurns(year, sel.m, sel.day, real, ovr)
          const dayTot = turnTotal(shown.man) + turnTotal(shown.tar)
          const ajustado = !!ovr[dayKey(year, sel.m, sel.day)]
          const resp = roster.length ? roster[(sel.day + sel.m) % roster.length].nombre : '—'
          const campo = (turno: 'man' | 'tar', emo: string, lbl: string, key: keyof Turn) => (
            <div className="vtpv-dr-row">
              <span>{emo} {lbl}</span>
              {edit ? (
                <span className="vt-inp"><input type="number" inputMode="numeric" min={0} value={shown[turno][key]} onChange={(e) => setField(turno, key, parseFloat(e.target.value))} /><i>€</i></span>
              ) : (
                <b className="tnum">{eur(shown[turno][key])} €</b>
              )}
            </div>
          )
          const turnoBox = (turno: 'man' | 'tar', tone: string, lbl: string) => (
            <div className="vt-turno">
              <div className={'vt-turno-h ' + tone}>{lbl}</div>
              {campo(turno, '💵', 'Efectivo', 'e')}
              {campo(turno, '💳', 'Tarjeta', 't')}
              {campo(turno, '🛵', 'Domicilio', 'd')}
              <div className="vtpv-dr-row vt-sub"><span>Subtotal</span><b className="tnum">{eur(turnTotal(shown[turno]))} €</b></div>
            </div>
          )
          return (
            <>
              <motion.div className="vtpv-scrim" onClick={() => setSel(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
              <div className="vtpv-center">
              <motion.div className="vtpv-z vt-day" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
                <div className="vtpv-z-head">
                  <div className="vtpv-z-id">
                    <span className="vtpv-z-kick">{edit ? 'Editar día' : 'Detalle del día'}{ajustado && !edit ? ' · ajustado ✎' : ''}</span>
                    <b>{sel.day} de {MESES[sel.m]} de {year}</b>
                  </div>
                  <button className="vtpv-dr-close" onClick={() => setSel(null)} aria-label="Cerrar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </div>
                <div className="vt-turnos">
                  {turnoBox('man', 'man', '☀ Turno mañana')}
                  {turnoBox('tar', 'tar', '☾ Turno tarde')}
                </div>
                <div className="vtpv-dr-row vt-resp"><span>Responsable</span><b>{resp}</b></div>
                <div className="vtpv-dr-tot"><span>Total del día</span><b className="tnum">{eur(dayTot)} €</b></div>
                <div className="vt-actions">
                  {edit ? (
                    <>
                      <button className="vt-btn ghost" onClick={() => { setEdit(false); setDraft(null) }}>Cancelar</button>
                      <button className="vt-btn primary" onClick={guardar}>Guardar día</button>
                    </>
                  ) : (
                    <button className="vt-btn primary" onClick={startEdit}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                      Editar / cerrar día
                    </button>
                  )}
                </div>
              </motion.div>
              </div>
            </>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
