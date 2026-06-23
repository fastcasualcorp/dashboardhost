import { useMemo, useState } from 'react'
import { SectionHeader, Card, Badge, DataTable, type Column } from '../components/ui'
import { eur, HOY } from '../lib/data'
import { play } from '../lib/sound'

/* Ventas TPV — el libro de cada venta del TPV (ticket o factura): base, IVA, total,
   ver/borrar y exportar a Excel (CSV). Lee de un mock; con Supabase leerá de la
   tabla `ventas` del local. Diseño REBELL (no el del panel del socio). */

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

export default function VentasTpv() {
  const [periodo, setPeriodo] = useState('todo')
  const [borradas, setBorradas] = useState<Set<string>>(() => new Set())

  const filtradas = useMemo(() => {
    const dias = PERIODOS.find((p) => p.k === periodo)?.dias ?? 9999
    const limite = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() - dias + 1)
    return VENTAS.filter((v) => !borradas.has(v.id) && (dias >= 9999 || v.fecha >= limite))
  }, [periodo, borradas])

  const totBase = filtradas.reduce((s, v) => s + v.total / 1.1, 0)
  const totIva = filtradas.reduce((s, v) => s + (v.total - v.total / 1.1), 0)
  const totTotal = filtradas.reduce((s, v) => s + v.total, 0)

  function borrar(id: string) {
    setBorradas((b) => new Set(b).add(id))
    play('toggle', 0.4, 0.8)
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
          <b>{v.id}</b>
          <Badge tone={v.tipo === 'factura' ? 'gold' : 'muted'}>{v.tipo === 'factura' ? 'Factura' : 'Ticket'}</Badge>
        </span>
      ),
      fecha: <span className="vtpv-date">{fmtFecha(v.fecha)}</span>,
      arts: `${v.arts} ud`,
      base: <span className="tnum">{eur(base)} €</span>,
      iva: <span className="tnum">{eur(v.total - base)} €</span>,
      total: <b className="tnum">{eur(v.total)} €</b>,
      acc: (
        <button className="vtpv-del" onClick={() => borrar(v.id)} aria-label="Eliminar venta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
          </svg>
        </button>
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
            <button className="salon-btn primary" onClick={exportar}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
              </svg>
              Excel
            </button>
          </div>
        }
      />

      <Card>
        {rows.length ? (
          <DataTable columns={columns} rows={rows} />
        ) : (
          <div className="vtpv-empty">Sin ventas en este periodo</div>
        )}
        <div className="vtpv-total">
          <span>Total ventas · {filtradas.length} {filtradas.length === 1 ? 'venta' : 'ventas'}</span>
          <div className="vtpv-tot-nums">
            <b className="tnum">{eur(totBase)} €</b>
            <b className="tnum">{eur(totIva)} €</b>
            <b className="tnum gold">{eur(totTotal)} €</b>
          </div>
        </div>
      </Card>
    </div>
  )
}
