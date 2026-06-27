import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SectionHeader, Card, Badge, DataTable, Stat, StatRow, BarChart, CountValue, type Column } from '../components/ui'
import { eur } from '../lib/data'
import { play } from '../lib/sound'
import { useCierres, type Cierre } from '../lib/cierres'

/* Arqueos — el LIBRO DE CIERRES de caja (auditable, A3/5.7). Cada vez que el TPV
   cierra caja, el arqueo cae aquí (fuente única `lib/cierres`): fecha, total y
   desglose efectivo/tarjeta + tickets del turno. Reusa el lenguaje del libro de
   Ventas TPV (cabecera-héroe + DataTable + drawer glass) → consistencia total. */

const fmtFecha = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
const fmtHora = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const e2 = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Arqueos() {
  const cierres = useCierres() // FUENTE ÚNICA: cada cierre de caja del TPV entra aquí en vivo
  const [sel, setSel] = useState<Cierre | null>(null)

  // Cifras agregadas del libro completo (cabecera-héroe).
  const totalAcum = cierres.reduce((s, c) => s + c.total, 0)
  const efeAcum = cierres.reduce((s, c) => s + c.efectivo, 0)
  const tarAcum = cierres.reduce((s, c) => s + c.tarjeta, 0)
  const ticketsAcum = cierres.reduce((s, c) => s + c.tickets, 0)
  const media = cierres.length ? totalAcum / cierres.length : 0

  // Últimos cierres por total → mini-gráfica de la cabecera (orden cronológico ascendente).
  const porCierre = useMemo(
    () =>
      [...cierres]
        .sort((a, b) => a.ts - b.ts)
        .slice(-8)
        .map((c) => ({ label: `${new Date(c.ts).getDate()}/${new Date(c.ts).getMonth() + 1}`, value: Math.round(c.total) })),
    [cierres],
  )

  function exportar() {
    const head = ['Cierre', 'Fecha', 'Hora', 'Efectivo', 'Tarjeta', 'Tickets', 'Total']
    const rows = cierres.map((c) => {
      const d = new Date(c.ts)
      return [c.id, fmtFecha(d), fmtHora(d), c.efectivo.toFixed(2), c.tarjeta.toFixed(2), String(c.tickets), c.total.toFixed(2)]
    })
    const csv = [head, ...rows].map((r) => r.map((x) => `"${x}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'arqueos.csv'
    a.click()
    URL.revokeObjectURL(url)
    play('success', 0.4, 1.1)
  }

  // Imprime el ARQUEO (ventana limpia estilo recibo) → el documento que se archiva del cierre.
  function printArqueo(c: Cierre) {
    const d = new Date(c.ts)
    const ln = (a: string, b: string) => `<div class="r"><span>${a}</span><b>${b}</b></div>`
    const html = `<!doctype html><meta charset="utf-8"><title>Arqueo ${c.id}</title>
      <style>
        *{box-sizing:border-box} body{margin:0;background:#0d0d0f;color:#f5f5f7;font:13px/1.5 ui-monospace,Menlo,monospace;padding:22px}
        .t{max-width:360px;margin:0 auto}
        h1{font:800 15px/1.2 system-ui;letter-spacing:.12em;text-align:center;margin:0 0 2px}
        .sub{text-align:center;color:#9a9aa2;font-size:11px;margin-bottom:14px}
        .sec{border-top:1px dashed #3a3a40;margin-top:12px;padding-top:10px}
        .sec h2{font:700 11px/1 system-ui;letter-spacing:.1em;text-transform:uppercase;color:#ffbf10;margin:0 0 8px}
        .r{display:flex;justify-content:space-between;gap:12px;padding:3px 0}
        .r span{color:#9a9aa2}.r b{font-weight:700}
        .tot{border-top:1px solid #ffbf10;margin-top:12px;padding-top:10px;display:flex;justify-content:space-between;align-items:baseline}
        .tot span{font-weight:800}.tot b{font:800 26px/1 system-ui;color:#ffbf10}
        .foot{text-align:center;color:#6a6a72;font-size:10px;margin-top:16px}
      </style>
      <div class="t">
        <h1>REBELL · ARQUEO DE CAJA</h1>
        <div class="sub">${c.id} · ${fmtFecha(d)} · ${fmtHora(d)}</div>
        <div class="sec"><h2>Operaciones</h2>
          ${ln('Tickets', String(c.tickets))}${ln('Ticket medio', e2(c.tickets ? c.total / c.tickets : 0) + ' €')}
        </div>
        <div class="sec"><h2>Por método de pago</h2>
          ${ln('Efectivo', e2(c.efectivo) + ' €')}${ln('Tarjeta', e2(c.tarjeta) + ' €')}
        </div>
        <div class="tot"><span>TOTAL CAJA</span><b>${e2(c.total)} €</b></div>
        <div class="foot">Documento no fiscal · demo REBELL</div>
      </div>
      <script>window.onload=function(){setTimeout(function(){window.print()},120)}<\/script>`
    const w = window.open('', '_blank', 'width=420,height=680')
    if (!w) return
    w.document.write(html)
    w.document.close()
    play('success', 0.5, 1.05)
  }

  const columns: Column[] = [
    { key: 'id', label: 'Cierre' },
    { key: 'fecha', label: 'Fecha' },
    { key: 'tickets', label: 'Tickets', align: 'center' },
    { key: 'efectivo', label: 'Efectivo', align: 'right' },
    { key: 'tarjeta', label: 'Tarjeta', align: 'right' },
    { key: 'total', label: 'Total', align: 'right' },
    { key: 'acc', label: '', align: 'right' },
  ]

  const rows = cierres.map((c) => {
    const d = new Date(c.ts)
    return {
      id: (
        <span className="vtpv-id">
          <b className="tnum">{c.id}</b>
          <Badge tone="gold">Arqueo</Badge>
        </span>
      ),
      fecha: <span className="vtpv-date">{DOW[d.getDay()]} {fmtFecha(d)} · {fmtHora(d)}</span>,
      tickets: `${c.tickets}`,
      efectivo: <span className="tnum">{eur(c.efectivo)} €</span>,
      tarjeta: <span className="tnum">{eur(c.tarjeta)} €</span>,
      total: <b className="tnum vtpv-rowtot">{eur(c.total)} €</b>,
      acc: (
        <span className="vtpv-acc">
          <button className="vtpv-ver" onClick={() => { setSel(c); play('tap') }} aria-label="Ver arqueo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </span>
      ),
    }
  })

  return (
    <div className="section">
      <SectionHeader
        title="Arqueos"
        subtitle="Libro de cierres de caja · auditable"
        right={
          <div className="vtpv-tools">
            <button className="vtpv-export" onClick={exportar}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
              </svg>
              Excel
            </button>
          </div>
        }
      />

      {/* ── CABECERA-HÉROE: acumulado + StatRow + mini-gráfica por cierre ── */}
      <Card className="vtpv-hero">
        <div className="vtpv-hero-main">
          <div className="vtpv-kick">Caja acumulada · {cierres.length} cierre{cierres.length === 1 ? '' : 's'}</div>
          <div className="vtpv-bignum tnum">
            <CountValue value={eur(totalAcum)} />
            <i>€</i>
          </div>
          <StatRow className="vtpv-hero-stats">
            <Stat value={String(cierres.length)} label="Arqueos" />
            <Stat value={eur(media)} unit="€" label="Media / cierre" />
            <Stat value={eur(efeAcum)} unit="€" label="Efectivo" count={false} />
            <Stat value={eur(tarAcum)} unit="€" label="Tarjeta" tone="green" count={false} />
            <Stat value={String(ticketsAcum)} label="Tickets" count={false} />
          </StatRow>
        </div>
        {porCierre.length > 1 && (
          <div className="vtpv-hero-chart">
            <div className="vtpv-chart-lab">Por cierre</div>
            <BarChart data={porCierre} height={120} />
          </div>
        )}
      </Card>

      {/* ── LIBRO ── */}
      <Card>
        {rows.length ? (
          <DataTable columns={columns} rows={rows} />
        ) : (
          <div className="vtpv-empty">Aún no hay cierres registrados. Cierra caja en el TPV y aparecerán aquí.</div>
        )}
      </Card>

      {/* ── DETALLE EN DRAWER (glass) ── */}
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
                  <span className="vtpv-dr-kick">Arqueo</span>
                  <b className="tnum">{sel.id}</b>
                </div>
                <button className="vtpv-dr-close" onClick={() => setSel(null)} aria-label="Cerrar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
              <div className="vtpv-dr-rows">
                <div className="vtpv-dr-row"><span>Fecha</span><b>{fmtFecha(new Date(sel.ts))}</b></div>
                <div className="vtpv-dr-row"><span>Hora de cierre</span><b className="tnum">{fmtHora(new Date(sel.ts))}</b></div>
                <div className="vtpv-dr-row"><span>Tickets</span><b className="tnum">{sel.tickets}</b></div>
                <div className="vtpv-dr-row"><span>Ticket medio</span><b className="tnum">{eur(sel.tickets ? sel.total / sel.tickets : 0)} €</b></div>
                <div className="vtpv-dr-row"><span>Efectivo</span><b className="tnum">{eur(sel.efectivo)} €</b></div>
                <div className="vtpv-dr-row"><span>Tarjeta</span><b className="tnum">{eur(sel.tarjeta)} €</b></div>
              </div>
              <div className="vtpv-dr-tot">
                <span>Total caja</span>
                <b className="tnum"><CountValue value={eur(sel.total)} /> €</b>
              </div>
              <button className="vtpv-z-print" onClick={() => printArqueo(sel)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v8H6z" /></svg>
                Imprimir arqueo
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
