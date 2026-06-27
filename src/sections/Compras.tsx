import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Card, SectionHeader, KpiTile, BarRow, DataTable, Badge, Grid, Donut } from '../components/ui'
import { play } from '../lib/sound'
import { useCompras, addAlbaran, toggleEstado, cuotaIva, totalAlbaran, comprasMes, pendienteMes, pagadoMes, proveedoresActivos, gastoPorProveedor } from '../lib/compras'

/* Compras — fuente ÚNICA `lib/compras`: das de alta un albarán y entran a la vez la tabla,
   las barras por proveedor y los KPIs. Estado pagado/pendiente con un clic. (audit · Compras) */

const e2 = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const e0 = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 })
const IVA_OPC = [0, 4, 5, 10, 12, 21]
const fmtDia = (ts: number) => { const d = new Date(ts); const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']; return `${d.getDate()} ${M[d.getMonth()]}` }

export default function Compras() {
  const albaranes = useCompras()
  const [alta, setAlta] = useState(false)
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
  const top2 = total ? Math.round(((porProv[0]?.total || 0) + (porProv[1]?.total || 0)) / total * 100) : 0
  const baseNum = Number(base.replace(/[^\d.,]/g, '').replace(',', '.')) || 0

  function guardar() {
    if (baseNum <= 0) { play('error', 0.5); return }
    addAlbaran({ proveedor: prov, concepto: conc, base: baseNum, iva, estado: 'pendiente' })
    play('success', 0.5, 1.1)
    setProv(''); setConc(''); setBase(''); setIva(12); setAlta(false)
  }

  const rows = albaranes.map((a) => ({
    fecha: fmtDia(a.ts),
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
        <KpiTile label="Compras del mes" value={e0(total)} unit="€" delta={`${nProv} proveedores`} foot="con IVA · este mes" trend="up" />
        <KpiTile label="Proveedores activos" value={String(nProv)} unit="" delta={`${albaranes.length} albaranes`} foot="este mes" trend="flat" />
        <KpiTile label="Pendiente de pago" value={e0(pendiente)} unit="€" delta={`${albaranes.filter((a) => a.estado === 'pendiente').length} facturas`} foot="por pagar" trend="down" />
      </Grid>

      <Grid cols={2}>
        <Card>
          <div className="card-head">
            <h3>Gasto por proveedor</h3>
            <Badge tone="muted">{nProv} proveedores</Badge>
          </div>
          <div className="bar-rows">
            {porProv.map((r) => (
              <BarRow key={r.proveedor} label={r.proveedor} value={r.total} max={maxProv} color={r.color} amount={e0(r.total) + ' €'} />
            ))}
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <h3>Distribución del gasto</h3>
            <Badge tone="muted">{nProv} proveedores</Badge>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', paddingTop: '0.5rem' }}>
            <Donut value={top2} label="top 2 proveed." sub={porProv.slice(0, 2).map((p) => p.proveedor.split(' ')[0]).join(' + ')} tone="gold" />
            <Donut value={total ? Math.round((pendiente / total) * 100) : 0} label="pendiente" sub="del total del mes" tone="amber" />
            <Donut value={pctPagado} label="pagado" sub="del total del mes" tone="green" />
          </div>
        </Card>
      </Grid>

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
    </div>
  )
}
