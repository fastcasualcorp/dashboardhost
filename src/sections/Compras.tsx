import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Card, SectionHeader, KpiTile, DataTable, Badge, Grid } from '../components/ui'
import { play } from '../lib/sound'
import { useEquipo } from '../lib/equipo'
import { useCompras, addAlbaran, toggleEstado, cuotaIva, totalAlbaran, comprasMes, pendienteMes, pagadoMes, proveedoresActivos, gastoPorProveedor } from '../lib/compras'

const startOfDay = (ts: number) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() }
const fmtDiaLargo = (ts: number) => { const d = new Date(ts); const M = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']; return `${d.getDate()} de ${M[d.getMonth()]} de ${d.getFullYear()}` }

/* Compras — fuente ÚNICA `lib/compras`: das de alta un albarán y entran a la vez la tabla,
   las barras por proveedor y los KPIs. Estado pagado/pendiente con un clic. (audit · Compras) */

const e2 = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const e0 = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 })
const IVA_OPC = [0, 4, 5, 10, 12, 21]
const fmtDia = (ts: number) => { const d = new Date(ts); const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']; return `${d.getDate()} ${M[d.getMonth()]}` }

export default function Compras() {
  const albaranes = useCompras()
  const roster = useEquipo()
  const [alta, setAlta] = useState(false)
  const [selDia, setSelDia] = useState<number | null>(null) // día abierto en el detalle (startOfDay ts)
  // formulario de alta
  const [prov, setProv] = useState('')
  const [conc, setConc] = useState('')
  const [base, setBase] = useState('')
  const [iva, setIva] = useState(12)

  const { porProv, total, pendiente, pagado, nProv, maxProv } = useMemo(() => {
    const porProv = gastoPorProveedor()
    return {
      porProv,
      total: comprasMes(),
      pendiente: pendienteMes(),
      pagado: pagadoMes(),
      nProv: proveedoresActivos(),
      maxProv: Math.max(1, ...porProv.map((p) => p.total)),
    }
  }, [albaranes])

  const pctPagado = total ? Math.round((pagado / total) * 100) : 0
  // Donut ÚNICO (conic-gradient) del gasto por proveedor — unifica las 2 gráficas de antes (Juan 28-jun).
  let acc = 0
  const stops = total
    ? porProv.map((r) => { const a = acc; acc += (r.total / total) * 100; return `${r.color} ${a.toFixed(2)}% ${acc.toFixed(2)}%` }).join(', ')
    : 'var(--line) 0% 100%'
  const baseNum = Number(base.replace(/[^\d.,]/g, '').replace(',', '.')) || 0

  function guardar() {
    if (baseNum <= 0) { play('error', 0.5); return }
    addAlbaran({ proveedor: prov, concepto: conc, base: baseNum, iva, estado: 'pendiente' })
    play('success', 0.5, 1.1)
    setProv(''); setConc(''); setBase(''); setIva(12); setAlta(false)
  }

  const rows = albaranes.map((a) => ({
    fecha: <button className="cmp-dialink" onClick={() => { setSelDia(startOfDay(a.ts)); play('tap') }} title="Ver el día completo">{fmtDia(a.ts)}</button>,
    proveedor: a.proveedor,
    concepto: <span className="cmp-conc">{a.concepto}</span>,
    base: <span className="tnum">{e2(a.base)}</span>,
    iva: <span className="tnum">{e2(cuotaIva(a))}</span>,
    total: <b className="tnum">{e2(totalAlbaran(a))}</b>,
    estado: (
      <button className={'cmp-estado ' + a.estado} onClick={() => { toggleEstado(a.id); play('tap', 0.4) }} title="Cambiar estado">
        <Badge tone={a.estado === 'pagado' ? 'green' : 'amber'}>{a.estado === 'pagado' ? 'Pagado' : 'Pendiente'}</Badge>
      </button>
    ),
  }))

  return (
    <div className="section">
      <SectionHeader
        title="Compras"
        subtitle="Proveedores · albaranes y facturas"
        right={
          <div className="cmp-tools">
            <Badge tone="amber">{e0(pendiente)} € pendientes</Badge>
            <button className="cmp-add" onClick={() => { setAlta(true); play('tap', 0.5, 1.15) }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Nuevo albarán
            </button>
          </div>
        }
      />

      <Grid cols={3} className="kpi-grid">
        <KpiTile label="Compras del mes" value={e0(total)} unit="€" delta={`${nProv} proveedores`} foot="con IVA · este mes" trend="up" tone="neg" />
        <KpiTile label="Proveedores activos" value={String(nProv)} unit="" delta={`${albaranes.length} albaranes`} foot="este mes" trend="flat" />
        <KpiTile label="Pendiente de pago" value={e0(pendiente)} unit="€" delta={`${albaranes.filter((a) => a.estado === 'pendiente').length} facturas`} foot="por pagar" trend="down" tone="neg" />
      </Grid>

      {/* DONUT ÚNICO: distribución del gasto por proveedor + leyenda con barras (mismo donut premium que Gastos) */}
      <Card>
        <div className="card-head">
          <h3>Gasto por proveedor</h3>
          <Badge tone={pctPagado >= 100 ? 'green' : 'amber'}>{pctPagado}% pagado · {e0(pendiente)} € pendiente</Badge>
        </div>
        {porProv.length === 0 ? (
          <p className="muted-s" style={{ textAlign: 'center', padding: '1.5rem 0', margin: 0 }}>Aún no hay compras este mes. Pulsa <strong style={{ color: 'var(--brand)' }}>＋ Nuevo albarán</strong>.</p>
        ) : (
          <div className="gx-hero">
            <div className="gx-pie-wrap">
              <div className="gx-pie" style={{ ['--pie' as string]: `conic-gradient(from -90deg, ${stops})` }}>
                <div className="gx-pie-hole">
                  <b className="tnum neg">{e0(total)} €</b>
                  <span>este mes</span>
                </div>
              </div>
            </div>
            <div className="gx-cats">
              {porProv.map((r, i) => (
                <div className="gx-cat" key={r.proveedor} style={{ ['--d' as string]: `${i * 70}ms`, ['--c' as string]: r.color }}>
                  <div className="gx-cat-top">
                    <span className="gx-cat-n"><i style={{ background: r.color }} />{r.proveedor}</span>
                    <span className="gx-cat-v tnum">{e0(r.total)} €<em>{total ? Math.round((r.total / total) * 100) : 0}%</em></span>
                  </div>
                  <div className="gx-cat-track">
                    <span className="gx-cat-fill" style={{ width: (r.total / maxProv) * 100 + '%', background: `linear-gradient(90deg, color-mix(in srgb, ${r.color} 78%, #000), ${r.color})` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="card-head">
          <h3>Albaranes y facturas</h3>
          <Badge tone="muted">{albaranes.length} registros</Badge>
        </div>
        <DataTable
          columns={[
            { key: 'fecha', label: 'Fecha' },
            { key: 'proveedor', label: 'Proveedor' },
            { key: 'concepto', label: 'Concepto' },
            { key: 'base', label: 'Base (€)', align: 'right' },
            { key: 'iva', label: 'IVA (€)', align: 'right' },
            { key: 'total', label: 'Total (€)', align: 'right' },
            { key: 'estado', label: 'Estado', align: 'right' },
          ]}
          rows={rows}
        />
      </Card>

      {/* ── ALTA DE ALBARÁN (modal glass) ── */}
      <AnimatePresence>
        {alta && (
          <>
            <motion.div className="vtpv-scrim" onClick={() => setAlta(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div
              className="cmp-modal"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            >
              <div className="cmp-modal-head">
                <div>
                  <span className="cmp-modal-kick">Nuevo registro</span>
                  <b>Alta de albarán</b>
                </div>
                <button className="vtpv-dr-close" onClick={() => setAlta(false)} aria-label="Cerrar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
              <label className="cmp-f"><span>Proveedor</span>
                <input value={prov} onChange={(e) => setProv(e.target.value)} placeholder="Makro, Transgourmet…" autoFocus />
              </label>
              <label className="cmp-f"><span>Concepto</span>
                <input value={conc} onChange={(e) => setConc(e.target.value)} placeholder="Carne, salsas, bebidas…" />
              </label>
              <div className="cmp-f-row">
                <label className="cmp-f"><span>Base imponible (€)</span>
                  <input className="tnum" inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} placeholder="0,00" />
                </label>
                <label className="cmp-f"><span>IVA</span>
                  <select value={iva} onChange={(e) => setIva(Number(e.target.value))}>
                    {IVA_OPC.map((v) => <option key={v} value={v}>{v}%</option>)}
                  </select>
                </label>
              </div>
              <div className="cmp-prev">
                <span>Total con IVA</span>
                <b className="tnum">{e2(baseNum + (baseNum * iva) / 100)} €</b>
              </div>
              <button className="cmp-save" onClick={guardar}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                Guardar albarán
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── DETALLE DEL DÍA: qué se compró ese día y QUIÉN lo hizo (Juan 27-jun) ── */}
      <AnimatePresence>
        {selDia != null && (() => {
          const delDia = albaranes.filter((a) => startOfDay(a.ts) === selDia)
          const subBase = delDia.reduce((s, a) => s + a.base, 0)
          const subIva = delDia.reduce((s, a) => s + cuotaIva(a), 0)
          const subTot = delDia.reduce((s, a) => s + totalAlbaran(a), 0)
          const dd = new Date(selDia)
          const resp = roster.length ? roster[(dd.getDate() + dd.getMonth()) % roster.length].nombre : '—'
          return (
            <>
              <motion.div className="vtpv-scrim" onClick={() => setSelDia(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
              <div className="vtpv-center">
              <motion.div className="vtpv-z vt-day" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
                <div className="vtpv-z-head">
                  <div className="vtpv-z-id">
                    <span className="vtpv-z-kick">Compras del día</span>
                    <b>{fmtDiaLargo(selDia)}</b>
                  </div>
                  <button className="vtpv-dr-close" onClick={() => setSelDia(null)} aria-label="Cerrar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </div>
                <div className="vt-lines">
                  {delDia.map((a) => (
                    <div className="vtpv-dr-row" key={a.id}>
                      <span><b style={{ color: 'var(--ink)' }}>{a.proveedor}</b> <small style={{ opacity: 0.6 }}>· {a.concepto || '—'}</small></span>
                      <b className="tnum">{e2(totalAlbaran(a))} €</b>
                    </div>
                  ))}
                  {!delDia.length && <div className="vtpv-dr-row"><span style={{ opacity: 0.6 }}>Sin compras registradas este día</span></div>}
                </div>
                <div className="vtpv-dr-row vt-sub"><span>Base · IVA</span><b className="tnum">{e2(subBase)} € · {e2(subIva)} €</b></div>
                <div className="vtpv-dr-row vt-resp"><span>Responsable</span><b>{resp}</b></div>
                <div className="vtpv-dr-tot"><span>Total compras del día</span><b className="tnum">{e2(subTot)} €</b></div>
              </motion.div>
              </div>
            </>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
