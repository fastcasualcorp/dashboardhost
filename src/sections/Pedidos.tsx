import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Card, SectionHeader, KpiTile, Badge, Grid } from '../components/ui'
import { imgFor } from '../lib/products'
import { eur0 } from '../lib/data'
import { play } from '../lib/sound'

/* Reparto unificado por plataforma: pedidos + ingresos en un solo panel con tarta (donut + glow). */
const PLAT_STATS: { plat: Plat; name: string; ped: number; ing: number }[] = [
  { plat: 'Local', name: 'Local / TPV', ped: 32, ing: 742 },
  { plat: 'Glovo', name: 'Glovo', ped: 26, ing: 486 },
  { plat: 'Uber Eats', name: 'Uber Eats', ped: 16, ing: 321 },
  { plat: 'Just Eat', name: 'Just Eat', ped: 10, ing: 238 },
]

/* ── Identidad de cada plataforma (color de marca + LOGO oficial; glifo de reserva) ──
   `logo` = SVG oficial de la marca en /public/img/brands/. Si el archivo no está, cae al glifo
   + nombre (los logos de marca son registrados → se usan los oficiales, no se recrean). */
type Plat = 'Glovo' | 'Uber Eats' | 'Just Eat' | 'Local'
const PLATFORMS: Record<Plat, { color: string; ink: string; chip: string; bar: string; glyph: ReactNode; logo?: string }> = {
  Glovo: {
    color: '#FFC244', ink: '#1a1205', chip: 'linear-gradient(180deg,#ffd05a,#ffbf2e)', bar: 'glovo', logo: '/img/brands/glovo.svg',
    glyph: <><path d="M6 8h12l-1.1 11.2a1 1 0 0 1-1 .9H8.1a1 1 0 0 1-1-.9L6 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></>,
  },
  'Uber Eats': {
    color: '#06C167', ink: '#04210f', chip: 'linear-gradient(180deg,#2ad982,#06C167)', bar: 'ubereats', logo: '/img/brands/ubereats.svg',
    glyph: <><path d="M4 11h16a8 8 0 0 1-16 0Z" /><path d="M9 6c0-1.1 1.3-2 3-2s3 .9 3 2" /></>,
  },
  'Just Eat': {
    color: '#FF8000', ink: '#fff', chip: 'linear-gradient(180deg,#ff8f1f,#f57600)', bar: 'justeat', logo: '/img/brands/justeat.svg',
    glyph: <><path d="M4 11l8-6 8 6" /><path d="M6 10v9h12v-9" /></>,
  },
  Local: {
    color: '#f0f0f4', ink: '#15151a', chip: 'linear-gradient(180deg,#ffffff,#e6e6ec)', bar: 'local',
    glyph: <><path d="M4 9l1-4h14l1 4" /><path d="M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" /><path d="M5 11v8h14v-8" /></>,
  },
}

function PlatChip({ plat, lg = false }: { plat: Plat; lg?: boolean }) {
  const p = PLATFORMS[plat]
  const [logoOk, setLogoOk] = useState(true)
  const showLogo = !!p.logo && logoOk
  return (
    <span className={'plat-chip' + (lg ? ' lg' : '')} style={{ background: p.chip, color: p.ink, borderColor: p.color + '55' }}>
      {showLogo ? (
        <>
          <span className="plat-logo-plate"><img src={p.logo} alt="" draggable={false} onError={() => setLogoOk(false)} /></span>
          {plat}
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p.glyph}</svg>
          {plat}
        </>
      )}
    </span>
  )
}

type Estado = 'En cocina' | 'En reparto' | 'Entregado'
const estadoTone: Record<Estado, 'amber' | 'blue' | 'green'> = { 'En cocina': 'amber', 'En reparto': 'blue', Entregado: 'green' }

type Item = { name: string; qty: number; price: number }
type Order = {
  num: string; hora: string; plat: Plat; cliente: string; tel: string; dir: string
  items: Item[]; envio: number; comision: number; pago: string; repartidor: string; eta: string; estado: Estado; notas?: string
}

const ORDERS: Order[] = [
  { num: '#0084', hora: '13:47', plat: 'Glovo', cliente: 'Marcos R.', tel: '+34 612 04 88 21', dir: 'Rúa do Sol 14, 2ºB · Bertamiráns', items: [{ name: 'REBELL Classic', qty: 2, price: 11 }, { name: 'Patatas Rebell', qty: 1, price: 4.5 }, { name: 'Refresco', qty: 2, price: 2.7 }], envio: 2.49, comision: 9.21, pago: 'Pagado en Glovo', repartidor: 'Iván · moto', eta: '8 min', estado: 'En cocina', notas: 'Sin cebolla en una de las burgers.' },
  { num: '#0083', hora: '13:41', plat: 'Uber Eats', cliente: 'Laura S.', tel: '+34 698 71 22 09', dir: 'Av. da Maía 3, baixo · Ames', items: [{ name: 'Doble Bacon', qty: 1, price: 13 }, { name: 'Aros de cebolla', qty: 1, price: 4.9 }, { name: 'Cerveza', qty: 1, price: 3 }], envio: 1.99, comision: 6.42, pago: 'Pagado en Uber Eats', repartidor: 'En asignación', eta: '14 min', estado: 'En reparto' },
  { num: '#0082', hora: '13:35', plat: 'Local', cliente: 'Mesa 4', tel: '—', dir: 'Sala · Mesa 4', items: [{ name: 'REBELL Classic', qty: 2, price: 11 }, { name: 'Crispy Chicken', qty: 1, price: 12 }, { name: 'Menú REBELL', qty: 1, price: 13.2 }], envio: 0, comision: 0, pago: 'Tarjeta · TPV', repartidor: '—', eta: '—', estado: 'Entregado' },
  { num: '#0081', hora: '13:28', plat: 'Just Eat', cliente: 'Iria M.', tel: '+34 633 50 17 44', dir: 'Praza do Concello 2, 1ºA · Bertamiráns', items: [{ name: 'Veggie Deluxe', qty: 1, price: 12 }, { name: 'Patatas Rebell', qty: 1, price: 4.5 }, { name: 'Agua', qty: 1, price: 1.8 }], envio: 2.2, comision: 5.46, pago: 'Pagado en Just Eat', repartidor: 'Noa · bici', eta: '11 min', estado: 'En cocina', notas: 'Llamar al llegar, no timbre.' },
  { num: '#0080', hora: '13:19', plat: 'Glovo', cliente: 'Adrián P.', tel: '+34 677 12 90 03', dir: 'Rúa Nova 8 · Bertamiráns', items: [{ name: 'REBELL Classic', qty: 1, price: 11 }], envio: 2.49, comision: 3.1, pago: 'Pagado en Glovo', repartidor: 'Iván · moto', eta: '6 min', estado: 'En reparto' },
  { num: '#0079', hora: '13:11', plat: 'Uber Eats', cliente: 'Cristina V.', tel: '+34 622 84 55 10', dir: 'Camiño Real 21 · Ames', items: [{ name: 'Doble Bacon', qty: 2, price: 13 }, { name: 'Patatas Rebell', qty: 1, price: 4.5 }, { name: 'Refresco', qty: 2, price: 2.7 }], envio: 1.99, comision: 8.07, pago: 'Pagado en Uber Eats', repartidor: 'Pablo · moto', eta: 'Entregado', estado: 'Entregado' },
  { num: '#0078', hora: '13:04', plat: 'Local', cliente: 'Mesa 2', tel: '—', dir: 'Sala · Mesa 2', items: [{ name: 'Menú REBELL', qty: 3, price: 13.2 }, { name: 'Cerveza', qty: 2, price: 3 }], envio: 0, comision: 0, pago: 'Efectivo · TPV', repartidor: '—', eta: '—', estado: 'Entregado' },
  { num: '#0077', hora: '12:56', plat: 'Just Eat', cliente: 'Pablo G.', tel: '+34 644 09 38 71', dir: 'Rúa do Río 5, 3ºC · Bertamiráns', items: [{ name: 'Crispy Chicken', qty: 1, price: 12 }, { name: 'Aros de cebolla', qty: 1, price: 4.9 }], envio: 2.2, comision: 4.18, pago: 'Pagado en Just Eat', repartidor: 'Noa · bici', eta: 'Entregado', estado: 'Entregado' },
  { num: '#0076', hora: '12:48', plat: 'Glovo', cliente: 'Noelia F.', tel: '+34 611 70 26 55', dir: 'Av. da Maía 40, 1ºD · Ames', items: [{ name: 'Doble Bacon', qty: 2, price: 13 }, { name: 'Patatas Rebell', qty: 2, price: 4.5 }, { name: 'Brownie', qty: 1, price: 4.8 }], envio: 2.49, comision: 9.16, pago: 'Pagado en Glovo', repartidor: 'Iván · moto', eta: 'Entregado', estado: 'Entregado' },
  { num: '#0075', hora: '12:39', plat: 'Uber Eats', cliente: 'Tomás L.', tel: '+34 699 41 60 22', dir: 'Rúa do Sol 2 · Bertamiráns', items: [{ name: 'REBELL Classic', qty: 1, price: 11 }, { name: 'Veggie Deluxe', qty: 1, price: 12 }, { name: 'Refresco', qty: 2, price: 2.7 }], envio: 1.99, comision: 5.74, pago: 'Pagado en Uber Eats', repartidor: 'Pablo · moto', eta: 'Entregado', estado: 'Entregado' },
]

const eur = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const sub = (o: Order) => o.items.reduce((s, i) => s + i.price * i.qty, 0)
const tot = (o: Order) => sub(o) + o.envio

const ESTADOS: Estado[] = ['En cocina', 'En reparto', 'Entregado']

export default function Pedidos() {
  const [sel, setSel] = useState<Order | null>(null)
  const [statusMap, setStatusMap] = useState<Record<string, Estado>>({})
  const stOf = (o: Order) => statusMap[o.num] ?? o.estado
  function setStatus(num: string, e: Estado) {
    play('tap', 0.45)
    setStatusMap((m) => ({ ...m, [num]: e }))
  }

  return (
    <div className="section">
      <SectionHeader title="Pedidos" subtitle="Delivery · últimos pedidos" right={<Badge tone="amber">⚡ 6 en cocina</Badge>} />

      <Grid cols={4} className="kpi-grid">
        <KpiTile label="Pedidos hoy" value="84" unit="ped." delta="+12%" foot="vs ayer" trend="up" />
        <KpiTile label="En cocina" value="6" unit="ped." delta="+2" foot="hace 1 min" trend="flat" />
        <KpiTile label="En reparto" value="3" unit="ped." delta="-1" foot="vs hora pico" trend="down" />
        <KpiTile label="Tiempo medio" value="24" unit="min" delta="-3 m" foot="vs ayer" trend="up" />
      </Grid>

      {(() => {
        const totalIng = PLAT_STATS.reduce((s, p) => s + p.ing, 0)
        const totalPed = PLAT_STATS.reduce((s, p) => s + p.ped, 0)
        const maxIng = Math.max(...PLAT_STATS.map((p) => p.ing))
        const C = 2 * Math.PI * 46
        let off = 0
        return (
          <Card>
            <div className="card-head">
              <h3>Reparto por plataforma</h3>
              <Badge tone="muted">hoy · {totalPed} ped · {eur0(totalIng)} €</Badge>
            </div>
            <div className="ped-plat">
              <div className="ped-donut">
                <svg viewBox="0 0 120 120" className="ped-donut-svg" aria-hidden="true">
                  <circle cx="60" cy="60" r="46" className="ped-donut-bg" />
                  {PLAT_STATS.map((p) => {
                    const len = (p.ing / totalIng) * C
                    const seg = <circle key={p.plat} cx="60" cy="60" r="46" className="ped-donut-seg" stroke={PLATFORMS[p.plat].color} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />
                    off += len
                    return seg
                  })}
                </svg>
                <div className="ped-donut-c"><b className="tnum">{totalPed}</b><span>pedidos</span></div>
              </div>
              <div className="ped-legend">
                {PLAT_STATS.map((p) => {
                  const logo = PLATFORMS[p.plat].logo
                  return (
                    <div className="ped-leg-row" key={p.plat}>
                      <span className="ped-leg-name">
                        {logo ? <span className="rs-canal-logo"><img src={logo} alt="" /></span> : <span className="ped-leg-dot" style={{ background: PLATFORMS[p.plat].color }} />}
                        {p.name}
                      </span>
                      <span className="ped-leg-bar"><span style={{ width: (p.ing / maxIng) * 100 + '%', background: PLATFORMS[p.plat].color }} /></span>
                      <span className="ped-leg-val"><b className="tnum">{eur0(p.ing)} €</b><i className="tnum">{p.ped} ped</i></span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        )
      })()}

      <Card>
        <div className="card-head">
          <h3>Cola de pedidos</h3>
          <Badge tone="muted">últimos 84 · toca un pedido para ver el detalle</Badge>
        </div>
        <div className="ord-list">
          {ORDERS.map((o) => (
            <button key={o.num} className="ord-row" style={{ ['--plat' as string]: PLATFORMS[o.plat].color }} onClick={() => setSel(o)}>
              <span className="ord-accent" />
              <span className="ord-thumb">{imgFor(o.items[0].name) ? <img src={imgFor(o.items[0].name)} alt="" loading="lazy" /> : null}</span>
              <span className="ord-num tnum">{o.num}</span>
              <span className="ord-hora tnum">{o.hora}</span>
              <PlatChip plat={o.plat} />
              <span className="ord-cli">{o.cliente}</span>
              <span className="ord-right">
                <span className="ord-items tnum">{o.items.reduce((s, i) => s + i.qty, 0)} art.</span>
                <span className="ord-total tnum">{eur(tot(o))} €</span>
                <Badge tone={estadoTone[stOf(o)]}>{stOf(o)}</Badge>
                <svg className="ord-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* ── Detalle del pedido ── */}
      <AnimatePresence>
        {sel && (
          <motion.div className="ord-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSel(null)}>
            <motion.div
              className="ord-modal"
              style={{ ['--plat' as string]: PLATFORMS[sel.plat].color }}
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="od-head">
                <div>
                  <div className="od-num tnum">{sel.num}</div>
                  <div className="od-sub">{sel.hora} · hoy</div>
                </div>
                <button className="od-close" onClick={() => setSel(null)} aria-label="Cerrar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>

              <div className="od-tags">
                <PlatChip plat={sel.plat} lg />
                <Badge tone={estadoTone[stOf(sel)]}>{stOf(sel)}</Badge>
              </div>

              <div className="od-status">
                {ESTADOS.map((e) => (
                  <button key={e} className={'od-st' + (stOf(sel) === e ? ' on' : '')} onClick={() => setStatus(sel.num, e)}>
                    {e}
                  </button>
                ))}
              </div>

              <div className="od-body">
                <div className="od-block">
                  <div className="od-cli-name">{sel.cliente}</div>
                  <div className="od-line"><Pin /> {sel.dir}</div>
                  {sel.tel !== '—' && <div className="od-line"><Phone /> {sel.tel}</div>}
                  <div className="od-line"><Bike /> {sel.repartidor}{sel.eta !== '—' && sel.eta !== 'Entregado' ? ` · llega en ${sel.eta}` : ''}</div>
                </div>

                {sel.notas && <div className="od-note"><b>Nota del cliente</b><span>{sel.notas}</span></div>}

                <div className="od-block">
                  <div className="od-block-t">Productos</div>
                  {sel.items.map((it, k) => (
                    <div className="od-item" key={k}>
                      <span className="od-item-th">{imgFor(it.name) ? <img src={imgFor(it.name)} alt="" loading="lazy" /> : null}</span>
                      <span className="od-item-q tnum">{it.qty}×</span>
                      <span className="od-item-n">{it.name}</span>
                      <span className="od-item-p tnum">{eur(it.price * it.qty)} €</span>
                    </div>
                  ))}
                </div>

                <div className="od-tot">
                  <div className="od-tr"><span>Subtotal</span><b className="tnum">{eur(sub(sel))} €</b></div>
                  {sel.envio > 0 && <div className="od-tr"><span>Envío</span><b className="tnum">{eur(sel.envio)} €</b></div>}
                  {sel.comision > 0 && <div className="od-tr neg"><span>Comisión {sel.plat}</span><b className="tnum">−{eur(sel.comision)} €</b></div>}
                  <div className="od-tr big"><span>Total</span><b className="tnum">{eur(tot(sel))} €</b></div>
                  {sel.comision > 0 && <div className="od-net"><span>Neto para REBELL</span><b className="tnum">{eur(tot(sel) - sel.comision)} €</b></div>}
                </div>

                <div className="od-pago"><Card2 /> {sel.pago}</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* glifos pequeños del detalle */
const Pin = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
const Phone = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>
const Bike = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="M6 17l4-8h5l3 8M10 9l-1-3H7" /></svg>
const Card2 = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></svg>
