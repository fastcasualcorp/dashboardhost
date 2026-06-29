import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SectionHeader, Money } from '../components/ui'
import { eur0, eur, salesForDay, HOY, useRealAgg } from '../lib/data'
import { useVentas, ventasPorDia, dayKey } from '../lib/ventas'
import { useEquipo } from '../lib/equipo'
import { play } from '../lib/sound'
import { isDemoMode } from '../lib/demo'

/* Ventas — "tu año en claro" + el mes en detalle (rediseño nuevospaneles, Juan 29-jun).
   ARRIBA: total del año + crecimiento vs año pasado + lecturas en lenguaje llano (mejor día,
   mejor mes, finde vs semana). El usuario ELIGE vista: "Mes" (el mes grande con el importe de
   cada día) o "Año" (los 12 calendarios). Cada día lleva un puntito vs-media (verde si superó tu
   media, rojo si quedó por debajo). El clic en un día abre el detalle por turnos (cerrar/ajustar).
   Fuente única: sobre la base se SUMAN las ventas REALES (TPV + online); el ajuste manual MANDA. */

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const WD3 = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DOW = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] // getDay()
const goto = (id: string) => window.dispatchEvent(new CustomEvent('rebell:goto', { detail: id }))

type Dia = { e: number; t: number; d: number; total: number }
type Real = Map<string, { e: number; t: number; total: number }>
type Turn = { e: number; t: number; d: number }
type DayOvr = { man: Turn; tar: Turn }
type Ovr = Record<string, DayOvr>

const OVR_KEY = 'rebell-ventas-ovr-v1'
const loadOvr = (): Ovr => { try { return JSON.parse(localStorage.getItem(OVR_KEY) || '{}') } catch { return {} } }
const saveOvr = (v: Ovr) => { try { localStorage.setItem(OVR_KEY, JSON.stringify(v)) } catch { /* sin localStorage */ } }
const turnTotal = (x: Turn) => x.e + x.t + x.d
const kEur = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(Math.round(n)))

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
  return { e: (base?.e || 0) + (r?.e || 0), t: (base?.t || 0) + (r?.t || 0), d: base?.d || 0, total: (base?.total || 0) + (r?.total || 0) }
}
function combinedMonth(y: number, m: number, real: Real, ovr?: Ovr): Dia & { dias: number; maxDay: number } {
  const days = new Date(y, m + 1, 0).getDate()
  let e = 0, t = 0, d = 0, total = 0, dias = 0, maxDay = 0
  for (let day = 1; day <= days; day++) {
    const s = combinedDay(y, m, day, real, ovr)
    if (s) { e += s.e; t += s.t; d += s.d; total += s.total; dias++; if (s.total > maxDay) maxDay = s.total }
  }
  return { e, t, d, total, dias, maxDay }
}

// Lecturas del año en una sola pasada: total, media diaria, mejor mes, mejor/peor día de la semana, finde vs semana.
function yearStats(y: number, real: Real, ovr: Ovr) {
  let total = 0, cash = 0, card = 0, days = 0, maxDay = 0
  const wdSum = [0, 0, 0, 0, 0, 0, 0], wdCnt = [0, 0, 0, 0, 0, 0, 0]
  const monthTot = new Array(12).fill(0)
  for (let m = 0; m < 12; m++) {
    const dim = new Date(y, m + 1, 0).getDate()
    for (let d = 1; d <= dim; d++) {
      const s = combinedDay(y, m, d, real, ovr)
      if (!s) continue
      total += s.total; cash += s.e; card += s.t; days++
      if (s.total > maxDay) maxDay = s.total
      const wd = new Date(y, m, d).getDay()
      wdSum[wd] += s.total; wdCnt[wd]++
      monthTot[m] += s.total
    }
  }
  const avgDay = days ? total / days : 0
  let bestM = 0; for (let m = 1; m < 12; m++) if (monthTot[m] > monthTot[bestM]) bestM = m
  const avgWd = (i: number) => (wdCnt[i] ? wdSum[i] / wdCnt[i] : 0)
  let bestWd = -1, worstWd = -1
  for (let i = 0; i < 7; i++) {
    if (!wdCnt[i]) continue
    if (bestWd < 0 || avgWd(i) > avgWd(bestWd)) bestWd = i
    if (worstWd < 0 || avgWd(i) < avgWd(worstWd)) worstWd = i
  }
  const wkndCnt = wdCnt[0] + wdCnt[6], wkndSum = wdSum[0] + wdSum[6]
  let wkSum = 0, wkCnt = 0; for (let i = 1; i <= 5; i++) { wkSum += wdSum[i]; wkCnt += wdCnt[i] }
  const avgWknd = wkndCnt ? wkndSum / wkndCnt : 0, avgWk = wkCnt ? wkSum / wkCnt : 0
  const wkndRatio = avgWk ? avgWknd / avgWk : 0
  return { total, cash, card, days, avgDay, maxDay, monthTot, bestM, bestWd, worstWd, bestWdAvg: avgWd(bestWd), wkndRatio }
}

// Nivel de calor (0-4) de un día según el máximo del periodo.
const heatLv = (v: number, max: number) => { const r = max ? v / max : 0; return r > 0.8 ? 'l4' : r > 0.6 ? 'l3' : r > 0.35 ? 'l2' : r > 0 ? 'l1' : '' }
// Puntito vs-media: verde si supera tu media diaria, rojo si queda por debajo (idea de Juan, 29-jun).
const vsMedia = (v: number, avg: number) => (avg ? (v >= avg ? 'over' : 'under') : '')

/* ── Vista MES: el mes grande, con el importe de cada día ── */
function MonthDetail({ y, m, real, ovr, avg, onDay, onPrev, onNext }: { y: number; m: number; real: Real; ovr: Ovr; avg: number; onDay: (day: number) => void; onPrev: () => void; onNext: () => void }) {
  const offset = (new Date(y, m, 1).getDay() + 6) % 7
  const dim = new Date(y, m + 1, 0).getDate()
  const agg = combinedMonth(y, m, real, ovr)
  let bestD = 0, bestT = 0
  for (let d = 1; d <= dim; d++) { const s = combinedDay(y, m, d, real, ovr); if (s && s.total > bestT) { bestT = s.total; bestD = d } }
  const cells: (number | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= dim; d++) cells.push(d)
  return (
    <div className="vt2-month panel-card">
      <div className="vt2-mhead">
        <div className="vt2-nav">
          <button onClick={onPrev} aria-label="Mes anterior" disabled={m === 0}>‹</button>
          <b>{MESES[m]} {y}</b>
          <button onClick={onNext} aria-label="Mes siguiente" disabled={m === 11}>›</button>
        </div>
        <div className="vt2-kpis">
          <div className="vt2-kpi"><Money value={eur0(agg.total)} tone="pos" /><span>Total del mes</span></div>
          <div className="vt2-kpi"><Money value={eur0(agg.e)} /><span>Efectivo</span></div>
          <div className="vt2-kpi"><Money value={eur0(agg.t)} /><span>Tarjeta</span></div>
          <div className="vt2-kpi"><b className="vt2-kv">{bestT ? 'día ' + bestD : '—'}</b><span>Mejor día{bestT ? ' · ' + eur0(bestT) + ' €' : ''}</span></div>
        </div>
      </div>
      <div className="vt2-wd">{WD3.map((w) => <i key={w}>{w}</i>)}</div>
      <div className="vt2-grid">
        {cells.map((d, i) => {
          if (d === null) return <span key={i} className="vt2-cell empty" />
          const s = combinedDay(y, m, d, real, ovr)
          const today = y === HOY.getFullYear() && m === HOY.getMonth() && d === HOY.getDate()
          if (!s) return <span key={i} className={'vt2-cell none' + (today ? ' today' : '')}><span className="dn">{d}</span></span>
          return (
            <button key={i} className={'vt2-cell ' + heatLv(s.total, agg.maxDay) + (today ? ' today' : '')} onClick={() => onDay(d)} title={`${d} ${MESES[m]} · ${eur0(s.total)} € · pulsa para el detalle`}>
              <span className="dn">{d}<em className={'vt2-dot ' + vsMedia(s.total, avg)} /></span>
              <Money value={kEur(s.total)} className="vt2-am" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Vista AÑO: los 12 calendarios (mantenidos), ahora con calor + puntito vs-media ── */
function YearCard({ y, m, real, ovr, onDay }: { y: number; m: number; real: Real; ovr: Ovr; onDay: (m: number, day: number) => void }) {
  const offset = (new Date(y, m, 1).getDay() + 6) % 7
  const dim = new Date(y, m + 1, 0).getDate()
  const agg = combinedMonth(y, m, real, ovr)
  const hasData = agg.dias > 0
  const cells: (number | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= dim; d++) cells.push(d)
  return (
    <div className={'vmonth' + (hasData ? '' : ' off')}>
      <div className="vm-head">
        <span className="vm-name">{MESES[m]}</span>
        <b className="vm-mtot">{hasData ? eur0(agg.total) + ' €' : '—'}</b>
      </div>
      <div className="vm-wd">{WD.map((w, i) => <span key={i}>{w}</span>)}</div>
      <div className="vm-grid">
        {cells.map((d, i) => {
          if (d === null) return <span key={i} className="vm-cell empty" />
          const s = combinedDay(y, m, d, real, ovr)
          const today = y === HOY.getFullYear() && m === HOY.getMonth() && d === HOY.getDate()
          return (
            <span
              key={i}
              className={'vm-cell ' + (s ? heatLv(s.total, agg.maxDay) : 'none') + (today ? ' today' : '')}
              title={s ? `${d} · ${eur0(s.total)} € · pulsa para ver el detalle` : ''}
              role={s ? 'button' : undefined}
              tabIndex={s ? 0 : undefined}
              onClick={s ? () => onDay(m, d) : undefined}
            >
              <i>{d}</i>
            </span>
          )
        })}
      </div>
      <div className="vm-foot">
        <span>💵 <b className="tnum">{hasData ? eur0(agg.e) + ' €' : '—'}</b></span>
        <span>💳 <b className="tnum">{hasData ? eur0(agg.t) + ' €' : '—'}</b></span>
      </div>
    </div>
  )
}

function dayTurns(y: number, m: number, day: number, real: Real, ovr: Ovr): DayOvr {
  const o = ovr[dayKey(y, m, day)]
  if (o) return o
  if (!isDemoMode()) { const z: Turn = { e: 0, t: 0, d: 0 }; return { man: { ...z }, tar: { ...z } } }
  const dd = combinedDay(y, m, day, real, ovr)
  const split = (f: number): Turn => ({ e: Math.round((dd?.e || 0) * f), t: Math.round((dd?.t || 0) * f), d: Math.round((dd?.d || 0) * f) })
  return { man: split(0.36), tar: split(0.64) }
}

export default function Ventas() {
  useRealAgg()
  const [year, setYear] = useState(HOY.getFullYear())
  const [view, setView] = useState<'mes' | 'anio'>('anio')
  const [curM, setCurM] = useState(HOY.getMonth())
  const ventas = useVentas()
  const real = ventasPorDia(ventas)
  const roster = useEquipo()
  const [sel, setSel] = useState<{ m: number; day: number } | null>(null)
  const [ovr, setOvr] = useState<Ovr>(() => loadOvr())
  const [edit, setEdit] = useState(false)
  const [draft, setDraft] = useState<DayOvr | null>(null)

  function openDay(m: number, day: number) { setSel({ m, day }); setEdit(false); setDraft(null); play('tap') }
  function startEdit() { if (!sel) return; setDraft(dayTurns(year, sel.m, sel.day, real, ovr)); setEdit(true); play('tap', 0.5, 1.1) }
  function setField(turno: 'man' | 'tar', campo: keyof Turn, v: number) { setDraft((d) => (d ? { ...d, [turno]: { ...d[turno], [campo]: Math.max(0, Math.round(v || 0)) } } : d)) }
  function guardar() { if (!sel || !draft) return; const next = { ...ovr, [dayKey(year, sel.m, sel.day)]: draft }; setOvr(next); saveOvr(next); setEdit(false); setDraft(null); play('success', 0.5, 1.1) }

  const st = yearStats(year, real, ovr)
  const empty = !isDemoMode() && st.total === 0
  // Crecimiento vs año pasado: en DEMO escaparate; en REAL requiere histórico del RPC (pendiente) → se oculta.
  const prevYTD = isDemoMode() ? Math.round(st.total / 1.12) : 0
  const growth = prevYTD > 0 ? Math.round((st.total / prevYTD - 1) * 100) : null

  function exportarExcel() {
    const head = ['Fecha', 'Efectivo', 'Tarjeta', 'Domicilio', 'Total']
    const rows: string[][] = []
    for (let m = 0; m < 12; m++) {
      const dim = new Date(year, m + 1, 0).getDate()
      for (let d = 1; d <= dim; d++) { const s = combinedDay(year, m, d, real, ovr); if (s) rows.push([`${d}/${m + 1}/${year}`, String(s.e), String(s.t), String(s.d), String(s.total)]) }
    }
    const csv = [head, ...rows].map((r) => r.map((c) => `"${c}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `ventas-${year}.csv`; a.click(); URL.revokeObjectURL(url)
    play('success', 0.4, 1.1)
  }

  return (
    <div className="section">
      <SectionHeader
        title="Ventas"
        subtitle="Lo importante de tu año en claro · y cada mes al detalle"
        right={
          <div className="ventas-year">
            <button onClick={() => { setYear((y) => y - 1); play('tap', 0.4, 0.9) }} aria-label="Año anterior">‹</button>
            <b>{year}</b>
            <button onClick={() => { setYear((y) => y + 1); play('tap', 0.4, 1.1) }} aria-label="Año siguiente">›</button>
            <button className="salon-btn primary ventas-xls" onClick={exportarExcel}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
              Excel
            </button>
          </div>
        }
      />

      {empty ? (
        <div className="vt2-empty">
          <div className="vt2-empty-ic">📅</div>
          <h2>Aún no tienes ventas registradas</h2>
          <p>Aquí verás tu año en claro: cuánto vendes, tu mejor día y cada mes al detalle. Empezará a llenarse en cuanto cobres en el TPV o por el canal online.</p>
          <button className="vt-btn primary" onClick={() => goto('tpv')}>Ir al TPV</button>
        </div>
      ) : (
        <>
          {/* HERO — tu año en claro */}
          <div className="vt2-hero panel-card">
            <div className="vt2-hero-l">
              <div className="vt2-kick">Has vendido este año (hasta hoy)</div>
              <Money value={eur0(st.total)} className="vt2-big" />
              <div className="vt2-say">{growth != null ? <>Vas <b>+{growth}%</b> por delante del año pasado. Buen ritmo.</> : <>Tu media es de <b>{eur0(Math.round(st.avgDay))} €</b> al día.</>}</div>
            </div>
            {growth != null && (
              <div className="vt2-grow"><b className="gn">+{growth}<i>%</i></b><span className="gl">más que<br />el año pasado</span></div>
            )}
          </div>

          {/* LECTURAS en lenguaje llano */}
          <div className="vt2-lect">
            <div className="vt2-lc"><span className="emo">🔥</span><div><div className="lt">Tu mejor día</div><div className="lv">El {DOW[st.bestWd]?.toLowerCase() || '—'}<u>{eur0(Math.round(st.bestWdAvg))} €/día</u></div></div></div>
            <div className="vt2-lc"><span className="emo">🏆</span><div><div className="lt">Tu mejor mes</div><div className="lv">{MESES[st.bestM]}<u>{eur0(st.monthTot[st.bestM])} €</u></div></div></div>
            <div className="vt2-lc"><span className="emo">📅</span><div><div className="lt">Finde vs semana</div><div className="lv">{st.wkndRatio ? st.wkndRatio.toFixed(1) + '× más' : '—'}<u>en fin de semana</u></div></div></div>
            <div className="vt2-lc"><span className="emo">🐌</span><div><div className="lt">A reforzar</div><div className="lv">Los {DOW[st.worstWd]?.toLowerCase() || '—'}<u>los más flojos</u></div></div></div>
          </div>

          {/* SELECTOR de vista + leyenda vs-media */}
          <div className="vt2-bar">
            <div className="vt2-seg" role="tablist">
              <button className={view === 'mes' ? 'on' : ''} onClick={() => { setView('mes'); play('tap', 0.4, 1.05) }}>Mes</button>
              <button className={view === 'anio' ? 'on' : ''} onClick={() => { setView('anio'); play('tap', 0.4, 0.95) }}>Año</button>
            </div>
            <div className="vt2-leg"><em className="vt2-dot over" /> sobre tu media <em className="vt2-dot under" /> por debajo</div>
          </div>

          {view === 'mes' ? (
            <MonthDetail y={year} m={curM} real={real} ovr={ovr} avg={st.avgDay} onDay={(d) => openDay(curM, d)} onPrev={() => setCurM((m) => Math.max(0, m - 1))} onNext={() => setCurM((m) => Math.min(11, m + 1))} />
          ) : (
            <div className="ventas-grid">
              {Array.from({ length: 12 }, (_, m) => (
                <YearCard key={m} y={year} m={m} real={real} ovr={ovr} onDay={openDay} />
              ))}
            </div>
          )}
        </>
      )}

      {/* DETALLE DEL DÍA: turnos mañana/tarde, editable (cerrar/ajustar). Reusa el modal premium de Ventas TPV. */}
      <AnimatePresence>
        {sel && (() => {
          const shown = edit && draft ? draft : dayTurns(year, sel.m, sel.day, real, ovr)
          const dayTot = turnTotal(shown.man) + turnTotal(shown.tar)
          const ajustado = !!ovr[dayKey(year, sel.m, sel.day)]
          const resp = isDemoMode() && roster.length ? roster[(sel.day + sel.m) % roster.length].nombre : '—'
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
                      <>
                        <button className="vt-btn ghost" onClick={() => goto('ventastpv')}>Ver tickets</button>
                        <button className="vt-btn primary" onClick={startEdit}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                          Editar / cerrar día
                        </button>
                      </>
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
