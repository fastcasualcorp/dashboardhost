import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SectionHeader, Card, Badge, DataTable, Stat, StatRow, BarChart, CountValue, type Column } from '../components/ui'
import { eur, HOY } from '../lib/data'
import { play } from '../lib/sound'

/* Ventas TPV — el libro de cada venta del TPV (ticket o factura): base, IVA, total,
   ver/borrar y exportar a Excel (CSV). Lee de un mock; con Supabase leerá de la
   tabla `ventas` del local. Rediseño según el canon §6: cabecera-héroe (cifra +
   StatRow + mini-gráfica) + libro con badges + detalle en drawer glass. */

type TipoDoc = 'ticket' | 'factura'
type Venta = { id: string; tipo: TipoDoc; fecha: Date; arts: number; total: number }

// Mock de ventas recientes (id, tipo, fecha, nº artículos, total con IVA).
const VENTAS: Venta[] = [
  { id: 'F-0002', tipo: 'factura', fecha: new Date(2026, 5, 21, 13, 11), arts: 1, total: 10.85 },
  { id: 'TPV-0009', tipo: 'ticket', fecha: new Date(2026, 5, 21, 12, 4), arts: 3, total: 31.4 },
  { id: 'TPV-0008', tipo: 'ticket', fecha: new Date(2026, 5, 20, 22, 51), arts: 2, total: 24.2 },
  { id: 'TPV-0007', tipo: 'ticket', fecha: new Date(2026, 5, 20, 21, 18), arts: 4, total: 47.3 },
  { id: 'F-0001', tipo: 'factura', fecha: new Date(2026, 5, 20, 14, 2), arts: 1, total: 11.5 },
  { id: 'TPV-0006', tipo: 'ticket', fecha: new Date(2026, 5, 19, 23, 36), arts: 1, total: 12.2 },
  { id: 'TPV-0005', tipo: 'ticket', fecha: new Date(2026, 5, 19, 23, 6), arts: 2, total: 27.4 },
  { id: 'TPV-0004', tipo: 'ticket', fecha: new Date(2026, 5, 18, 22, 57), arts: 1, total: 13.0 },
  { id: 'TPV-0003', tipo: 'ticket', fecha: new Date(2026, 5, 18, 21, 40), arts: 3, total: 33.6 },
  { id: 'TPV-0002', tipo: 'ticket', fecha: new Date(2026, 5, 17, 22, 12), arts: 2, total: 22.8 },
  { id: 'TPV-0001', tipo: 'ticket', fecha: new Date(2026, 5, 17, 20, 5), arts: 1, total: 11.0 },
]

const PERIODOS = [
  { k: 'hoy', t: 'Hoy', dias: 1 },
  { k: 'semana', t: 'Semana', dias: 7 },
  { k: 'mes', t: 'Mes', dias: 31 },
  { k: 'todo', t: 'Todo', dias: 9999 },
]

const fmtFecha = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const fmtHora = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export default function VentasTpv() {
  const [periodo, setPeriodo] = useState('todo')
  const [borradas, setBorradas] = useState<Set<string>>(() => new Set())
  const [sel, setSel] = useState<Venta | null>(null)

  const filtradas = useMemo(() => {
    const dias = PERIODOS.find((p) => p.k === periodo)?.dias ?? 9999
    const limite = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() - dias + 1)
    return VENTAS.filter((v) => !borradas.has(v.id) && (dias >= 9999 || v.fecha >= limite))
  }, [periodo, borradas])

  const totBase = filtradas.reduce((s, v) => s + v.total / 1.1, 0)
  const totIva = filtradas.reduce((s, v) => s + (v.total - v.total / 1.1), 0)
  const totTotal = filtradas.reduce((s, v) => s + v.total, 0)
  const medio = filtradas.length ? totTotal / filtradas.length : 0
  const periodoLabel = PERIODOS.find((p) => p.k === periodo)?.t ?? 'Todo'

  // Ventas agregadas por día → mini-gráfica de barras de la cabecera-héroe.
  const porDia = useMemo(() => {
    const map = new Map<string, { label: string; value: number; ts: number }>()
    for (const v of filtradas) {
      const ts = new Date(v.fecha.getFullYear(), v.fecha.getMonth(), v.fecha.getDate()).getTime()
      const label = `${v.fecha.getDate()}/${v.fecha.getMonth() + 1}`
      const cur = map.get(label) || { label, value: 0, ts }
      cur.value += v.total
      map.set(label, cur)
    }
    return Array.from(map.values())
      .sort((a, b) => a.ts - b.ts)
      .slice(-8)
      .map(({ label, value }) => ({ label, value: Math.round(value) }))
  }, [filtradas])

  function borrar(id: string) {
    setBorradas((b) => new Set(b).add(id))
    if (sel?.id === id) setSel(null)
    play('toggle', 0.4, 0.8)
  }
  function ver(v: Venta) {
    setSel(v)
    play('tap')
  }

  function exportar() {
    const head = ['Nº', 'Tipo', 'Fecha', 'Artículos', 'Base', 'IVA', 'Total']
    const rows = filtradas.map((v) => {
      const base = v.total / 1.1
      return [v.id, v.tipo, fmtFecha(v.fecha), String(v.arts), base.toFixed(2), (v.total - base).toFixed(2), v.total.toFixed(2)]
    })
    const csv = [head, ...rows].map((r) => r.map((c) => `"${c}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ventas-tpv-${periodo}.csv`
    a.click()
    URL.revokeObjectURL(url)
    play('success', 0.4, 1.1)
  }

  const columns: Column[] = [
    { key: 'id', label: 'Nº' },
    { key: 'fecha', label: 'Fecha' },
    { key: 'arts', label: 'Artículos', align: 'center' },
    { key: 'base', label: 'Base', align: 'right' },
    { key: 'iva', label: 'IVA', align: 'right' },
    { key: 'total', label: 'Total', align: 'right' },
    { key: 'acc', label: '', align: 'right' },
  ]

  const rows = filtradas.map((v) => {
    const base = v.total / 1.1
    return {
      id: (
        <span className="vtpv-id">
          <b className="tnum">{v.id}</b>
          <Badge tone={v.tipo === 'factura' ? 'gold' : 'muted'}>{v.tipo === 'factura' ? 'Factura' : 'Ticket'}</Badge>
        </span>
      ),
      fecha: <span className="vtpv-date">{fmtFecha(v.fecha)}</span>,
      arts: `${v.arts} ud`,
      base: <span className="tnum">{eur(base)} €</span>,
      iva: <span className="tnum">{eur(v.total - base)} €</span>,
      total: <b className="tnum vtpv-rowtot">{eur(v.total)} €</b>,
      acc: (
        <span className="vtpv-acc">
          <button className="vtpv-ver" onClick={() => ver(v)} aria-label="Ver detalle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button className="vtpv-del" onClick={() => borrar(v.id)} aria-label="Eliminar venta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
            </svg>
          </button>
        </span>
      ),
    }
  })

  return (
    <div className="section">
      <SectionHeader
        title="Ventas TPV"
        subtitle="Libro de ventas · tickets y facturas"
        right={
          <div className="vtpv-tools">
            <div className="vtpv-period">
              {PERIODOS.map((p) => (
                <button key={p.k} className={'vtpv-pk' + (periodo === p.k ? ' on' : '')} onClick={() => { setPeriodo(p.k); play('tap') }}>
                  {p.t}
                </button>
              ))}
            </div>
            <button className="vtpv-export" onClick={exportar}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
              </svg>
              Excel
            </button>
          </div>
        }
      />

      {/* ── CABECERA-HÉROE: cifra grande + StatRow + mini-gráfica por día ── */}
      <Card className="vtpv-hero">
        <div className="vtpv-hero-main">
          <div className="vtpv-kick">Facturado · {periodoLabel.toLowerCase()}</div>
          <div className="vtpv-bignum tnum">
            <CountValue value={eur(totTotal)} />
            <i>€</i>
          </div>
          <StatRow className="vtpv-hero-stats">
            <Stat value={String(filtradas.length)} label="Ventas" />
            <Stat value={eur(medio)} unit="€" label="Ticket medio" />
            <Stat value={eur(totBase)} unit="€" label="Base" count={false} />
            <Stat value={eur(totIva)} unit="€" label="IVA" tone="green" count={false} />
          </StatRow>
        </div>
        {porDia.length > 1 && (
          <div className="vtpv-hero-chart">
            <div className="vtpv-chart-lab">Por día</div>
            <BarChart data={porDia} height={120} />
          </div>
        )}
      </Card>

      {/* ── LIBRO ── */}
      <Card>
        {rows.length ? (
          <DataTable columns={columns} rows={rows} />
        ) : (
          <div className="vtpv-empty">Sin ventas en este periodo</div>
        )}
      </Card>

      {/* ── DETALLE EN DRAWER (glass, reusa el lenguaje del inspector del Salón) ── */}
      <AnimatePresence>
        {sel && (
          <>
            <motion.div className="vtpv-scrim" onClick={() => setSel(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.aside
              className="vtpv-drawer"
              initial={{ opacity: 0, x: 34 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 34 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            >
              <div className="vtpv-dr-head">
                <div className="vtpv-dr-id">
                  <span className="vtpv-dr-kick">{sel.tipo === 'factura' ? 'Factura' : 'Ticket'}</span>
                  <b className="tnum">{sel.id}</b>
                </div>
                <button className="vtpv-dr-close" onClick={() => setSel(null)} aria-label="Cerrar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <div className="vtpv-dr-rows">
                <div className="vtpv-dr-row"><span>Fecha</span><b>{sel.fecha.getDate()}/{sel.fecha.getMonth() + 1}/{sel.fecha.getFullYear()}</b></div>
                <div className="vtpv-dr-row"><span>Hora</span><b className="tnum">{fmtHora(sel.fecha)}</b></div>
                <div className="vtpv-dr-row"><span>Artículos</span><b className="tnum">{sel.arts}</b></div>
                <div className="vtpv-dr-row"><span>Base imponible</span><b className="tnum">{eur(sel.total / 1.1)} €</b></div>
                <div className="vtpv-dr-row"><span>IVA (10%)</span><b className="tnum">{eur(sel.total - sel.total / 1.1)} €</b></div>
              </div>
              <div className="vtpv-dr-tot">
                <span>Total</span>
                <b className="tnum"><CountValue value={eur(sel.total)} /> €</b>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
