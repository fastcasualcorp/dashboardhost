import { useMemo, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SectionHeader, Card, Badge, DataTable, Stat, StatRow, CountValue, type Column } from '../components/ui'
import { eur } from '../lib/data'
import { play } from '../lib/sound'
import { useVentas, type Venta } from '../lib/ventas'

/* Ventas TPV — el libro de cada venta del TPV (ticket o factura): base, IVA, total,
   ver/ANULAR y exportar a Excel (CSV). Lee la FUENTE ÚNICA `lib/ventas` → cada cobro
   del TPV/online aparece aquí al instante. (boceto A "Libro contable" + injerto Sala/Online)
   IVA: la carta es hostelería → comida y bebida para consumo en local/delivery van al 10%
   (no hay 21% en la carta). El desglose DERIVA de ese tipo; si algún día se vende algo a otro
   tipo (botellas para llevar, merchandising), bastará marcar ese producto y se desglosa solo. */

const PERIODOS = [
  { k: 'hoy', t: 'Hoy', dias: 1 },
  { k: 'semana', t: 'Semana', dias: 7 },
  { k: 'mes', t: 'Mes', dias: 31 },
  { k: 'todo', t: 'Todo', dias: 9999 },
]
const CANALES = [
  { k: 'todo', t: 'Todo' },
  { k: 'sala', t: 'Sala' },
  { k: 'online', t: 'Online' },
]
const METODOS = [
  { k: 'todo', t: 'Todos' },
  { k: 'efectivo', t: 'Efectivo' },
  { k: 'tarjeta', t: 'Tarjeta' },
]

const IVA_RATE = 10 // hostelería: comida + bebida para consumo en local/delivery → 10%
const baseDe = (total: number) => total / (1 + IVA_RATE / 100)
const ivaDe = (total: number) => total - baseDe(total)
const canalDe = (v: Venta): 'Sala' | 'Online' => (v.fuente === 'Online' ? 'Online' : 'Sala')

const fmtFecha = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const fmtHora = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const e2 = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/* Búsqueda flexible: por Nº (id), método, tipo o IMPORTE. Soporta ">20", "<10" y rangos "20-30". */
function matchVenta(v: Venta, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const cmp = s.match(/^([<>])=?\s*(\d+(?:[.,]\d+)?)$/)
  if (cmp) {
    const n = parseFloat(cmp[2].replace(',', '.'))
    return cmp[1] === '>' ? v.total > n : v.total < n
  }
  const rng = s.match(/^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)$/)
  if (rng) {
    const a = parseFloat(rng[1].replace(',', '.')), b = parseFloat(rng[2].replace(',', '.'))
    return v.total >= Math.min(a, b) && v.total <= Math.max(a, b)
  }
  if (`${v.id} ${v.tipo} ${v.metodo || ''} ${canalDe(v)}`.toLowerCase().includes(s)) return true
  if (/^\d+(?:[.,]\d+)?$/.test(s)) {
    const n = parseFloat(s.replace(',', '.'))
    return Math.round(v.total) === Math.round(n) || String(v.total).includes(s)
  }
  return false
}

export default function VentasTpv() {
  const ventas = useVentas() // FUENTE ÚNICA: cada cobro del TPV/online entra aquí en vivo
  const [periodo, setPeriodo] = useState('todo')
  const [canal, setCanal] = useState('todo')
  const [metodo, setMetodo] = useState('todo')
  const [anuladas, setAnuladas] = useState<Set<string>>(() => new Set())
  const [sel, setSel] = useState<Venta | null>(null)
  const [query, setQuery] = useState('')
  const [zOpen, setZOpen] = useState(false)

  // PERIODO → manda las cifras de cabecera y el Cierre Z. Incluye anuladas para PODER mostrarlas tachadas.
  const delPeriodo = useMemo(() => {
    const dias = PERIODOS.find((p) => p.k === periodo)?.dias ?? 9999
    const ahora = new Date()
    const limite = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - dias + 1).getTime()
    return ventas.filter((v) => dias >= 9999 || v.ts >= limite)
  }, [ventas, periodo])
  // ACTIVAS = las que cuentan (las anuladas NO suman, como manda Hacienda: no se borran, se anulan).
  const activas = useMemo(() => delPeriodo.filter((v) => !anuladas.has(v.id)), [delPeriodo, anuladas])

  // Filtros de TABLA (canal + método + búsqueda) — la cabecera sigue mostrando el total del periodo.
  const visibles = useMemo(
    () => delPeriodo.filter((v) => (canal === 'todo' || canalDe(v).toLowerCase() === canal) && (metodo === 'todo' || (v.metodo ?? 'tarjeta') === metodo) && matchVenta(v, query)),
    [delPeriodo, canal, metodo, query],
  )

  const totTotal = activas.reduce((s, v) => s + v.total, 0)
  const totBase = activas.reduce((s, v) => s + baseDe(v.total), 0)
  const totIva = totTotal - totBase
  const medio = activas.length ? totTotal / activas.length : 0
  const periodoLabel = PERIODOS.find((p) => p.k === periodo)?.t ?? 'Todo'

  // Sala vs Online (datos REALES, de v.fuente) → dona + insight.
  const sala = activas.filter((v) => canalDe(v) === 'Sala')
  const online = activas.filter((v) => canalDe(v) === 'Online')
  const salaT = sala.reduce((s, v) => s + v.total, 0)
  const onlineT = online.reduce((s, v) => s + v.total, 0)
  const pctSala = totTotal ? Math.round((salaT / totTotal) * 100) : 100
  const pctOnline = 100 - pctSala
  const tkSala = sala.length ? salaT / sala.length : 0
  const tkOnline = online.length ? onlineT / online.length : 0
  // Cobro por método (efectivo vs tarjeta) → equilibra la tarjeta fiscal y da control de caja real.
  const efectivo = activas.filter((v) => (v.metodo ?? 'tarjeta') === 'efectivo')
  const tarjeta = activas.filter((v) => (v.metodo ?? 'tarjeta') === 'tarjeta')
  const efectivoT = efectivo.reduce((s, v) => s + v.total, 0)
  const tarjetaT = tarjeta.reduce((s, v) => s + v.total, 0)
  const insight = online.length === 0
    ? 'Todas tus ventas entran por sala/TPV. Pega los QR del Canal online para empezar a recibir pedidos sin camarero.'
    : pctSala >= pctOnline
      ? `Mandas en sala (${pctSala}%). Ticket medio: sala ${eur(tkSala)}€ · online ${eur(tkOnline)}€${tkOnline < tkSala ? ' — sube el carrito online con un upsell.' : '.'}`
      : `El online ya manda (${pctOnline}%). Ticket medio: online ${eur(tkOnline)}€ · sala ${eur(tkSala)}€.`

  // ── CIERRE Z (fiscal): resumen oficial del PERIODO, solo ACTIVAS ──
  const z = useMemo(() => {
    const sum = (arr: Venta[]) => arr.reduce((s, v) => s + v.total, 0)
    const efe = activas.filter((v) => (v.metodo ?? 'tarjeta') === 'efectivo')
    const tar = activas.filter((v) => (v.metodo ?? 'tarjeta') === 'tarjeta')
    const total = sum(activas)
    const ts = activas.map((v) => v.ts).sort((a, b) => a - b)
    return {
      n: activas.length, tickets: activas.filter((v) => v.tipo === 'ticket').length, facturas: activas.filter((v) => v.tipo === 'factura').length,
      efe: { n: efe.length, t: sum(efe) }, tar: { n: tar.length, t: sum(tar) },
      sala: { n: sala.length, t: salaT }, online: { n: online.length, t: onlineT },
      total, base: total / (1 + IVA_RATE / 100), iva: total - total / (1 + IVA_RATE / 100),
      medio: activas.length ? total / activas.length : 0, desde: ts[0], hasta: ts[ts.length - 1],
    }
  }, [activas, sala, online, salaT, onlineT])

  function printZ() {
    const f = new Date()
    const ln = (a: string, b: string) => `<div class="r"><span>${a}</span><b>${b}</b></div>`
    const rango = z.desde ? `${fmtHora(new Date(z.desde))} – ${fmtHora(new Date(z.hasta))}` : '—'
    const html = `<!doctype html><meta charset="utf-8"><title>Cierre Z</title>
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
        <h1>REBELL · CIERRE Z</h1>
        <div class="sub">${f.getDate()}/${f.getMonth() + 1}/${f.getFullYear()} · ${fmtHora(f)} · periodo: ${periodoLabel}</div>
        <div class="sec"><h2>Operaciones</h2>
          ${ln('Ventas', String(z.n))}${ln('· Tickets', String(z.tickets))}${ln('· Facturas', String(z.facturas))}${ln('Franja', rango)}${ln('Ticket medio', e2(z.medio) + ' €')}
        </div>
        <div class="sec"><h2>Por canal</h2>
          ${ln(`Sala (${z.sala.n})`, e2(z.sala.t) + ' €')}${ln(`Online (${z.online.n})`, e2(z.online.t) + ' €')}
        </div>
        <div class="sec"><h2>Por método de pago</h2>
          ${ln(`Efectivo (${z.efe.n})`, e2(z.efe.t) + ' €')}${ln(`Tarjeta (${z.tar.n})`, e2(z.tar.t) + ' €')}
        </div>
        <div class="sec"><h2>Desglose fiscal</h2>
          ${ln('Base imponible', e2(z.base) + ' €')}${ln(`IVA (${IVA_RATE}%)`, e2(z.iva) + ' €')}
        </div>
        <div class="tot"><span>TOTAL</span><b>${e2(z.total)} €</b></div>
        <div class="foot">Documento no fiscal · demo REBELL</div>
      </div>
      <script>window.onload=function(){setTimeout(function(){window.print()},120)}<\/script>`
    const w = window.open('', '_blank', 'width=420,height=680')
    if (!w) return
    w.document.write(html); w.document.close(); play('success', 0.5, 1.05)
  }

  function printDoc(v: Venta) {
    const d = new Date(v.ts)
    const base = baseDe(v.total), iva = ivaDe(v.total)
    const esFactura = v.tipo === 'factura'
    const fecha = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} · ${fmtHora(d)}`
    const ln = (a: string, b: string) => `<div class="r"><span>${a}</span><b>${b}</b></div>`
    const fiscal = esFactura ? `<div class="fiscal"><b>REBELL Bertamiráns S.L.</b><br>CIF B-70XXXXXX · Rúa do Sol 14, Bertamiráns (A Coruña)</div>` : ''
    const html = `<!doctype html><meta charset="utf-8"><title>${esFactura ? 'Factura' : 'Ticket'} ${v.id}</title>
      <style>
        *{box-sizing:border-box} body{margin:0;background:#0d0d0f;color:#f5f5f7;font:13px/1.5 ui-monospace,Menlo,monospace;padding:22px}
        .t{max-width:360px;margin:0 auto}
        h1{font:800 18px/1.1 system-ui;letter-spacing:.14em;text-align:center;margin:0 0 3px}
        .doc{text-align:center;color:#ffbf10;font:800 12px/1 system-ui;letter-spacing:.14em;text-transform:uppercase;margin-bottom:3px}
        .sub{text-align:center;color:#9a9aa2;font-size:11px;margin-bottom:12px}
        .fiscal{text-align:center;color:#c8c8d0;font-size:10px;line-height:1.5;border-top:1px dashed #3a3a40;border-bottom:1px dashed #3a3a40;padding:8px 0;margin-bottom:6px}
        .sec{border-top:1px dashed #3a3a40;margin-top:10px;padding-top:9px}
        .r{display:flex;justify-content:space-between;gap:12px;padding:3px 0}
        .r span{color:#9a9aa2}.r b{font-weight:700}
        .tot{border-top:1px solid #ffbf10;margin-top:12px;padding-top:10px;display:flex;justify-content:space-between;align-items:baseline}
        .tot span{font-weight:800}.tot b{font:800 26px/1 system-ui;color:#ffbf10}
        .foot{text-align:center;color:#6a6a72;font-size:10px;margin-top:16px}
      </style>
      <div class="t">
        <h1>REBELL</h1>
        <div class="doc">${esFactura ? 'Factura' : 'Ticket'} · ${v.id}</div>
        <div class="sub">${fecha}${v.mesa ? ' · ' + v.mesa : ''} · ${canalDe(v)}</div>
        ${fiscal}
        <div class="sec">${ln('Artículos', String(v.arts) + ' ud')}${ln('Método de pago', (v.metodo ?? 'tarjeta') === 'efectivo' ? 'Efectivo' : 'Tarjeta')}</div>
        <div class="sec">${ln('Base imponible', e2(base) + ' €')}${ln(`IVA (${IVA_RATE}%)`, e2(iva) + ' €')}</div>
        <div class="tot"><span>TOTAL</span><b>${e2(v.total)} €</b></div>
        <div class="foot">${esFactura ? 'Factura simplificada' : 'Ticket de compra'} · Gracias por tu visita · REBELL</div>
      </div>
      <script>window.onload=function(){setTimeout(function(){window.print()},120)}<\/script>`
    const w = window.open('', '_blank', 'width=420,height=720')
    if (!w) return
    w.document.write(html); w.document.close(); play('success', 0.5, 1.05)
  }

  function anular(id: string) {
    setAnuladas((b) => { const n = new Set(b); n.has(id) ? n.delete(id) : n.add(id); return n })
    play('toggle', 0.4, 0.8)
  }
  function ver(v: Venta) { setSel(v); play('tap') }

  function exportar() {
    const head = ['Nº', 'Tipo', 'Canal', 'Estado', 'Fecha', 'Artículos', 'Base', 'IVA', 'Total']
    const rows = delPeriodo.map((v) => [v.id, v.tipo, canalDe(v), anuladas.has(v.id) ? 'ANULADA' : 'OK', fmtFecha(new Date(v.ts)), String(v.arts), baseDe(v.total).toFixed(2), ivaDe(v.total).toFixed(2), v.total.toFixed(2)])
    const csv = [head, ...rows].map((r) => r.map((c) => `"${c}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `ventas-tpv-${periodo}.csv`; a.click()
    URL.revokeObjectURL(url); play('success', 0.4, 1.1)
  }

  const columns: Column[] = [
    { key: 'id', label: 'Nº' },
    { key: 'canal', label: 'Canal' },
    { key: 'fecha', label: 'Fecha' },
    { key: 'arts', label: 'Artículos', align: 'center' },
    { key: 'base', label: 'Base', align: 'right' },
    { key: 'iva', label: 'IVA', align: 'right' },
    { key: 'total', label: 'Total', align: 'right' },
    { key: 'acc', label: '', align: 'right' },
  ]

  const rows = visibles.map((v) => {
    const anu = anuladas.has(v.id)
    const ch = canalDe(v)
    return {
      _className: anu ? 'vtpv-row-anu' : undefined,
      id: (
        <span className="vtpv-id">
          <b className="tnum">{v.id}</b>
          <Badge tone={v.tipo === 'factura' ? 'gold' : 'muted'}>{v.tipo === 'factura' ? 'Factura' : 'Ticket'}</Badge>
          {anu && <span className="vtpv-anu-tag">Anulada</span>}
        </span>
      ),
      canal: <span className={'vtpv-ch ' + (ch === 'Online' ? 'on' : 'sa')}>{ch}</span>,
      fecha: <span className="vtpv-date">{fmtFecha(new Date(v.ts))}</span>,
      arts: `${v.arts} ud`,
      base: <span className="tnum">{eur(baseDe(v.total))} €</span>,
      iva: <span className="vtpv-ivacell tnum">{eur(ivaDe(v.total))} €<small>{IVA_RATE}%</small></span>,
      total: <b className="tnum vtpv-rowtot">{eur(v.total)} €</b>,
      acc: (
        <span className="vtpv-acc">
          <button className="vtpv-ver" onClick={() => ver(v)} aria-label="Ver detalle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
          </button>
          <button className={'vtpv-del' + (anu ? ' on' : '')} onClick={() => anular(v.id)} aria-label={anu ? 'Restaurar venta' : 'Anular venta'} title={anu ? 'Restaurar' : 'Anular (no se borra del libro)'}>
            {anu ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></svg>
            )}
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
                <button key={p.k} className={'vtpv-pk' + (periodo === p.k ? ' on' : '')} onClick={() => { setPeriodo(p.k); play('tap') }}>{p.t}</button>
              ))}
            </div>
            <button className="vtpv-zbtn" onClick={() => { setZOpen(true); play('tap', 0.5, 1.1) }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h12M6 22h12M8 2v3l4 5-4 5v5M16 2v3l-4 5 4 5v5" /></svg>
              Cierre Z
            </button>
            <button className="vtpv-export" onClick={exportar}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
              Excel
            </button>
          </div>
        }
      />

      {/* ── CABECERA-HÉROE: izq facturado + StatRow + Sala/Online · dcha desglose fiscal ── */}
      <div className="vtpv-hero2">
        <Card className="vtpv-hero-l">
          <div className="vtpv-kick">Facturado · {periodoLabel.toLowerCase()}</div>
          <div className="vtpv-bignum tnum"><CountValue value={eur(totTotal)} /><i>€</i></div>
          <StatRow className="vtpv-hero-stats">
            <Stat value={String(activas.length)} label="Ventas" />
            <Stat value={eur(medio)} unit="€" label="Ticket medio" />
          </StatRow>
          <div className="vtpv-split">
            <div className="vtpv-donut" style={{ ['--p' as string]: pctSala + '%' } as CSSProperties} aria-hidden />
            <div className="vtpv-split-leg">
              <div className="vtpv-lg"><i className="sa" />Sala<b>{eur(salaT)} €</b><span>{pctSala}% · {sala.length}</span></div>
              <div className="vtpv-lg"><i className="on" />Online<b>{eur(onlineT)} €</b><span>{pctOnline}% · {online.length}</span></div>
            </div>
          </div>
          <p className="vtpv-insight"><span>💡</span>{insight}</p>
        </Card>

        <Card className="vtpv-fiscal">
          <div className="vtpv-kick gold">Desglose fiscal</div>
          <div className="vtpv-fis-note">Hostelería: comida y bebida al <b>{IVA_RATE}%</b>. Si vendes algo a otro tipo (botellas para llevar, merchandising), se desglosa aquí solo.</div>
          <div className="vtpv-fis-rows">
            <div className="vtpv-fis-row"><span>Base imponible</span><b className="tnum">{eur(totBase)} €</b></div>
            <div className="vtpv-fis-row"><span>IVA ({IVA_RATE}%)</span><b className="tnum">{eur(totIva)} €</b></div>
          </div>
          <div className="vtpv-fis-sub">Cobrado por método</div>
          <div className="vtpv-fis-rows">
            <div className="vtpv-fis-row"><span>💵 Efectivo · {efectivo.length}</span><b className="tnum">{eur(efectivoT)} €</b></div>
            <div className="vtpv-fis-row"><span>💳 Tarjeta · {tarjeta.length}</span><b className="tnum">{eur(tarjetaT)} €</b></div>
          </div>
          <div className="vtpv-fis-tot"><span>Total {periodoLabel.toLowerCase()}</span><b className="tnum"><CountValue value={eur(totTotal)} /> €</b></div>
        </Card>
      </div>

      {/* ── LIBRO (buscador + filtros canal/método) ── */}
      <Card>
        <div className="vtpv-searchrow">
          <div className="vtpv-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nº, canal, método o importe…  (ej: T-0007 · online · >30 · 20-40)" aria-label="Buscar en el libro de ventas" />
            {query && <button className="vtpv-search-x" onClick={() => setQuery('')} aria-label="Limpiar búsqueda">✕</button>}
          </div>
          <div className="vtpv-filters">
            {CANALES.map((c) => (
              <button key={c.k} className={'vtpv-fchip' + (canal === c.k ? ' on' : '')} onClick={() => { setCanal(c.k); play('tap') }}>{c.t}</button>
            ))}
            <span className="vtpv-fsep" />
            {METODOS.map((m) => (
              <button key={m.k} className={'vtpv-fchip' + (metodo === m.k ? ' on' : '')} onClick={() => { setMetodo(m.k); play('tap') }}>{m.t}</button>
            ))}
          </div>
          <span className="vtpv-search-count">{visibles.length} de {delPeriodo.length}</span>
        </div>
        {rows.length ? (
          <DataTable columns={columns} rows={rows} />
        ) : (
          <div className="vtpv-empty">{query || canal !== 'todo' || metodo !== 'todo' ? 'Sin resultados con estos filtros' : 'Sin ventas en este periodo'}</div>
        )}
      </Card>

      {/* ── DETALLE EN DRAWER ── */}
      <AnimatePresence>
        {sel && (
          <>
            <motion.div className="vtpv-scrim" onClick={() => setSel(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.aside className="vtpv-drawer" initial={{ opacity: 0, x: 34 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 34 }} transition={{ type: 'spring', stiffness: 360, damping: 32 }}>
              <div className="vtpv-dr-head">
                <div className="vtpv-dr-id">
                  <span className="vtpv-dr-kick">{sel.tipo === 'factura' ? 'Factura' : 'Ticket'} · {canalDe(sel)}</span>
                  <b className="tnum">{sel.id}</b>
                </div>
                <button className="vtpv-dr-close" onClick={() => setSel(null)} aria-label="Cerrar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
              </div>
              <div className="vtpv-dr-rows">
                <div className="vtpv-dr-row"><span>Fecha</span><b>{new Date(sel.ts).getDate()}/{new Date(sel.ts).getMonth() + 1}/{new Date(sel.ts).getFullYear()}</b></div>
                <div className="vtpv-dr-row"><span>Hora</span><b className="tnum">{fmtHora(new Date(sel.ts))}</b></div>
                <div className="vtpv-dr-row"><span>Canal</span><b>{canalDe(sel)}</b></div>
                <div className="vtpv-dr-row"><span>Método</span><b>{(sel.metodo ?? 'tarjeta') === 'efectivo' ? 'Efectivo' : 'Tarjeta'}</b></div>
                <div className="vtpv-dr-row"><span>Artículos</span><b className="tnum">{sel.arts}</b></div>
                <div className="vtpv-dr-row"><span>Base imponible</span><b className="tnum">{eur(baseDe(sel.total))} €</b></div>
                <div className="vtpv-dr-row"><span>IVA ({IVA_RATE}%)</span><b className="tnum">{eur(ivaDe(sel.total))} €</b></div>
              </div>
              <div className="vtpv-dr-tot"><span>Total</span><b className="tnum"><CountValue value={eur(sel.total)} /> €</b></div>
              <button className="vtpv-z-print" onClick={() => printDoc(sel)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v8H6z" /></svg>
                Descargar {sel.tipo === 'factura' ? 'factura' : 'ticket'}
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── CIERRE Z FISCAL ── */}
      <AnimatePresence>
        {zOpen && (
          <>
            <motion.div className="vtpv-scrim" onClick={() => setZOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div className="vtpv-z" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
              <div className="vtpv-z-head">
                <div className="vtpv-z-id"><span className="vtpv-z-kick">Cierre Z · {periodoLabel}</span><b>Resumen fiscal</b></div>
                <button className="vtpv-dr-close" onClick={() => setZOpen(false)} aria-label="Cerrar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
              </div>
              <div className="vtpv-z-grid">
                <div className="vtpv-z-mini"><span>Operaciones</span><b className="tnum">{z.n}</b></div>
                <div className="vtpv-z-mini"><span>Tickets</span><b className="tnum">{z.tickets}</b></div>
                <div className="vtpv-z-mini"><span>Facturas</span><b className="tnum">{z.facturas}</b></div>
                <div className="vtpv-z-mini"><span>Ticket medio</span><b className="tnum">{e2(z.medio)} €</b></div>
              </div>
              <div className="vtpv-z-sec">Por canal</div>
              <div className="vtpv-dr-row"><span>Sala · {z.sala.n}</span><b className="tnum">{e2(z.sala.t)} €</b></div>
              <div className="vtpv-dr-row"><span>Online · {z.online.n}</span><b className="tnum">{e2(z.online.t)} €</b></div>
              <div className="vtpv-z-sec">Por método de pago</div>
              <div className="vtpv-dr-row"><span>Efectivo · {z.efe.n}</span><b className="tnum">{e2(z.efe.t)} €</b></div>
              <div className="vtpv-dr-row"><span>Tarjeta · {z.tar.n}</span><b className="tnum">{e2(z.tar.t)} €</b></div>
              <div className="vtpv-z-sec">Desglose fiscal</div>
              <div className="vtpv-dr-row"><span>Base imponible</span><b className="tnum">{e2(z.base)} €</b></div>
              <div className="vtpv-dr-row"><span>IVA ({IVA_RATE}%)</span><b className="tnum">{e2(z.iva)} €</b></div>
              <div className="vtpv-dr-tot"><span>Total {periodoLabel.toLowerCase()}</span><b className="tnum"><CountValue value={e2(z.total)} /> €</b></div>
              <button className="vtpv-z-print" onClick={printZ}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v8H6z" /></svg>
                Imprimir cierre Z
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
