/* ════════════════════════════════════════════════════════════════════
   CANAL ONLINE — centro de mando del pedido por QR (self-order).
   Tres columnas pegadas, sin aire muerto (boceto A2 elegido por Juan):
     1) IZQ — "Lo que ve tu cliente": la página REAL /pedir dentro de un móvil
        (iframe en vivo) + atajo para editar la carta. Grande, para revisarla aquí.
     2) CENTRO — el QR de la mesa (grande) + selector de mesa + imprimir/generar.
     3) DCHA — feed EN VIVO de los pedidos online (fuente única: comandas src='Online').
   Arriba, los KPIs reales de HOY (resumenOnlineHoy, ventas fuente='Online'): en real
   arrancan a 0 (empty-state honesto) y suben con cada pedido. (visión QR self-order)
   ════════════════════════════════════════════════════════════════════ */
import { useMemo, useState } from 'react'
import { Card, SectionHeader } from '../components/ui'
import { LOCAL, localSlug } from '../lib/local'
import { loadSalon } from '../lib/salon'
import { useVentas, resumenOnlineHoy } from '../lib/ventas'
import { useComandas, type Comanda, type CStatus } from '../lib/comandas'
import { PRODUCTOS } from '../lib/products'
import { eur } from '../lib/data'

// Misma URL que el QR del recibo: el origen REAL de esta app + local + mesa. Slug = fuente única (localSlug).
function pedirUrl(mesa: string | null): string {
  const base = typeof window !== 'undefined' ? `${window.location.origin}/pedir` : '/pedir'
  return `${base}?l=${localSlug()}${mesa ? `&m=${encodeURIComponent(mesa)}` : ''}`
}
const qrSrc = (url: string, size = 220) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encodeURIComponent(url)}`
const goto = (id: string) => window.dispatchEvent(new CustomEvent('rebell:goto', { detail: id }))

// Precio de carta por nombre (fuente única PRODUCTOS) → importe honesto de cada pedido del feed.
const PRICE = new Map(PRODUCTOS.map((p) => [p.name, p.price]))
const totalComanda = (c: Comanda) => c.items.reduce((s, i) => s + (PRICE.get(i.name) ?? 0) * i.qty, 0)
// Estado de cocina → etiqueta + color (semáforo): nuevo → en cocina → listo.
const EST: Record<CStatus, { label: string; cls: string }> = {
  nueva: { label: 'Recibido', cls: 'new' },
  prep: { label: 'En cocina', cls: 'cook' },
  lista: { label: 'Listo', cls: 'done' },
}

export default function Online() {
  const mesas = useMemo(() => loadSalon(), [])
  const [mesa, setMesa] = useState<string | null>(mesas[0]?.nombre ?? null)
  const [reload, setReload] = useState(0)
  useVentas() // suscribe a cambios del libro (KPIs reactivos)
  const comandas = useComandas()
  const res = resumenOnlineHoy()
  // Feed: pedidos ONLINE activos, los más nuevos arriba (FIFO inverso para "entrando ahora").
  const feed = comandas.filter((c) => c.src === 'Online').slice().sort((a, b) => b.born - a.born)

  const url = pedirUrl(mesa)
  const iframeSrc = `${url}${url.includes('?') ? '&' : '?'}_=${reload}`
  const destino = mesa ? `Mesa ${mesa}` : 'Para llevar'

  function copy() {
    try { navigator.clipboard?.writeText(url) } catch { /* sin clipboard */ }
  }
  function printOne() { printSheet([{ nombre: mesa, url }]) }
  function printAll() { printSheet(mesas.map((m) => ({ nombre: m.nombre, url: pedirUrl(m.nombre) }))) }
  function printSheet(items: { nombre: string | null; url: string }[]) {
    const w = window.open('', '_blank', 'width=820,height=1040')
    if (!w) return
    const cards = items.map((it) => `
      <div class="card">
        <div class="brand">◢ ${LOCAL.name}</div>
        <div class="qr"><img src="${qrSrc(it.url, 360)}" width="200" height="200" alt="QR"/></div>
        <div class="mesa">${it.nombre ? 'Mesa ' + it.nombre : 'Pide para llevar'}</div>
        <div class="cap">Escanea · pide · paga sin esperar</div>
      </div>`).join('')
    w.document.write(`<!doctype html><meta charset="utf-8"><title>QR de mesas · REBELL</title>
      <style>
        *{box-sizing:border-box} body{margin:0;background:#fff;color:#111;font-family:system-ui,sans-serif;padding:18px}
        .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
        .card{border:1.5px solid #111;border-radius:16px;padding:18px;text-align:center;page-break-inside:avoid}
        .brand{font-weight:800;letter-spacing:.04em;font-size:13px;margin-bottom:10px}
        .qr img{display:block;margin:0 auto}
        .mesa{font-weight:800;font-size:22px;margin-top:12px}
        .cap{color:#666;font-size:11px;margin-top:4px}
        @media print{body{padding:0}}
      </style>
      <div class="grid">${cards}</div>
      <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>`)
    w.document.close()
  }

  return (
    <div className="section online">
      <SectionHeader
        title="Canal online"
        subtitle="Lo que ve tu cliente, tu QR y los pedidos que entran — todo de un vistazo."
      />

      {/* ── Barra de estado + KPIs de hoy ── */}
      <div className="ol-topbar panel-card">
        <span className="ol-dot" />
        <b>Recibiendo pedidos</b>
        <span className="ol-sync">por QR · en vivo</span>
        <div className="ol-kpis">
          <div className="ol-kpi"><span className="k">Pedidos hoy</span><span className="v">{res.pedidos}</span></div>
          <div className="ol-kpi"><span className="k">Facturado online</span><span className="v">{eur(res.total)}<i className="ol-cur">€</i></span></div>
          <div className="ol-kpi"><span className="k">Ticket medio</span><span className="v">{res.pedidos ? <>{eur(res.ticket)}<i className="ol-cur">€</i></> : '—'}</span></div>
        </div>
      </div>

      <div className="ol-main">
        {/* ── IZQUIERDA · espejo del cliente (grande) ── */}
        <Card className="ol-mirror" pad={false}>
          <div className="ol-mirror-head">
            <h3>Lo que ve tu cliente</h3>
            <span>La carta en su móvil · {destino}</span>
          </div>
          <div className="ol-phone">
            <span className="ol-notch" />
            <iframe key={iframeSrc} className="ol-screen" src={iframeSrc} title="Carta del cliente" />
            <button className="ol-reload" onClick={() => setReload((n) => n + 1)} title="Recargar">⟳</button>
          </div>
          <button className="ol-edit" onClick={() => goto('platos')}>Editar lo que ve el cliente</button>
        </Card>

        {/* ── CENTRO · QR grande + mesas ── */}
        <Card className="ol-qr">
          <h3>QR de la mesa · {mesa ?? 'Llevar'}</h3>
          <p className="ol-qr-sub">Pégalo en la mesa. El cliente escanea y le abre esta carta.</p>
          <div className="ol-qrbox"><img src={qrSrc(url, 240)} width={206} height={206} alt={`QR ${destino}`} /></div>
          <div className="ol-chips">
            {mesas.map((m) => (
              <button key={m.id} className={'ol-chip' + (mesa === m.nombre ? ' on' : '')} onClick={() => setMesa(m.nombre)}>{m.nombre}</button>
            ))}
            <button className={'ol-chip llevar' + (mesa === null ? ' on' : '')} onClick={() => setMesa(null)}>Llevar</button>
          </div>
          <div className="ol-acts">
            <button className="ol-btn" onClick={copy}>Copiar enlace</button>
            <button className="ol-btn" onClick={printOne}>Imprimir este QR</button>
            <button className="ol-btn gold" onClick={printAll}>Generar QR de TODAS las mesas</button>
          </div>
        </Card>

        {/* ── DERECHA · feed en vivo ── */}
        <Card className="ol-feed">
          <div className="ol-feed-head"><h3>Pedidos online de hoy</h3><span className="ol-tag">en vivo</span></div>
          {feed.length === 0 ? (
            <div className="ol-empty">
              <div className="ol-empty-ic">📲</div>
              <b>Aún no ha entrado ningún pedido online</b>
              <p>Pega el QR en las mesas. Cuando un cliente pida por su móvil, aparecerá aquí al instante.</p>
            </div>
          ) : (
            <div className="ol-orders">
              {feed.map((c) => {
                const e = EST[c.status]
                return (
                  <div className="ol-ord" key={c.id}>
                    <span className="ol-n">#{c.n}</span>
                    <span className="ol-dst">{c.mesa ? `Mesa ${c.mesa}` : '🛵 Para llevar'}
                      <small>{c.items.map((i) => `${i.qty}× ${i.name}`).join(' · ')}</small>
                    </span>
                    <span className="ol-imp">{eur(totalComanda(c))}<i className="ol-cur">€</i></span>
                    <span className={'ol-st ' + e.cls}>{e.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
