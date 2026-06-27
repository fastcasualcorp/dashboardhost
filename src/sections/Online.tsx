/* ════════════════════════════════════════════════════════════════════
   CANAL ONLINE — el "espejo" del cliente DENTRO del panel.
   Juan necesita VER las vistas que no salen en el dashboard (la carta que el
   cliente abre al escanear el QR de su mesa). Aquí la pinta dentro de un
   mockup de móvil con la página REAL (/pedir) en un iframe — interactiva — +
   el QR de cada mesa, listo para imprimir y pegar en la mesa. Una sola fuente:
   la URL la calcula igual que el recibo del TPV (ordenUrl). (visión QR self-order)
   ════════════════════════════════════════════════════════════════════ */
import { useMemo, useState } from 'react'
import { Card, SectionHeader } from '../components/ui'
import { LOCAL } from '../lib/local'
import { loadSalon } from '../lib/salon'

// Misma URL que el QR del recibo: el origen REAL de esta app + local + mesa.
function pedirUrl(mesa: string | null): string {
  const base = typeof window !== 'undefined' ? `${window.location.origin}/pedir` : '/pedir'
  return `${base}?l=bertamirans${mesa ? `&m=${encodeURIComponent(mesa)}` : ''}`
}
const qrSrc = (url: string, size = 220) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encodeURIComponent(url)}`

export default function Online() {
  const mesas = useMemo(() => loadSalon(), [])
  const [mesa, setMesa] = useState<string | null>(mesas[0]?.nombre ?? null)
  const [reload, setReload] = useState(0)

  const url = pedirUrl(mesa)
  const iframeSrc = `${url}${url.includes('?') ? '&' : '?'}_=${reload}`
  const destino = mesa ? `Mesa ${mesa}` : 'Para llevar'

  function copy() {
    try { navigator.clipboard?.writeText(url) } catch { /* sin clipboard */ }
  }
  // Imprime el QR de la mesa elegida como "table tent" (cartelito para la mesa).
  function printOne() {
    printSheet([{ nombre: mesa, url }])
  }
  // GENERADOR: imprime el QR de TODAS las mesas en una hoja → recortar y pegar.
  function printAll() {
    printSheet(mesas.map((m) => ({ nombre: m.nombre, url: pedirUrl(m.nombre) })))
  }
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
        subtitle="La carta que ven tus clientes al escanear el QR de su mesa. Aquí la ves igual que ellos, en vivo."
      />

      <div className="online-stage">
        {/* ── Espejo del cliente: la página real dentro de un móvil ── */}
        <Card className="online-preview" pad={false}>
          <div className="online-pv-bar">
            <span className="dot" /><span className="dot" /><span className="dot" />
            <span className="online-pv-url">rebell.app/pedir · {destino}</span>
            <button className="online-mini" onClick={() => setReload((n) => n + 1)} title="Recargar">⟳</button>
          </div>
          <div className="phone">
            <span className="phone-notch" />
            <iframe key={iframeSrc} className="phone-screen" src={iframeSrc} title="Carta del cliente" />
          </div>
        </Card>

        {/* ── Controles + QR ── */}
        <div className="online-side">
          <Card className="online-qr-card">
            <div className="card-head"><h3>QR de la mesa</h3></div>
            <div className="online-qr"><img src={qrSrc(url, 240)} width={180} height={180} alt={`QR ${destino}`} /></div>
            <div className="online-qr-mesa">{destino}</div>
            <p className="online-qr-help">Pega este QR en la mesa. El cliente lo escanea con su móvil y le abre esta carta directamente.</p>
            <div className="online-actions">
              <button className="btn-line" onClick={() => window.open(url, '_blank')}>Abrir a pantalla completa</button>
              <button className="btn-line" onClick={copy}>Copiar enlace</button>
              <button className="btn-line" onClick={printOne}>Imprimir este QR</button>
              <button className="btn-gold" onClick={printAll}>Generar QR de TODAS las mesas</button>
            </div>
          </Card>

          <Card className="online-mesas">
            <div className="card-head"><h3>Elegir mesa</h3></div>
            <div className="online-mesa-grid">
              {mesas.map((m) => (
                <button key={m.id} className={'online-mesa-chip' + (mesa === m.nombre ? ' on' : '')} onClick={() => setMesa(m.nombre)}>{m.nombre}</button>
              ))}
              <button className={'online-mesa-chip llevar' + (mesa === null ? ' on' : '')} onClick={() => setMesa(null)}>Llevar</button>
            </div>
          </Card>

          <Card className="online-loop">
            <div className="card-head"><h3>El circuito</h3></div>
            <ol className="online-steps">
              <li><b>1</b> El cliente escanea el QR de su mesa</li>
              <li><b>2</b> Ve la carta y monta su pedido</li>
              <li><b>3</b> Paga online (sin camarero)</li>
              <li><b>4</b> El pedido entra en <strong>Comandas</strong> (cocina) y baja el stock</li>
            </ol>
            <p className="online-note">Nota: que el pedido salte EN VIVO a tu cocina desde otro móvil necesita el backend (Supabase). Aquí lo ves funcionando en este mismo equipo.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
