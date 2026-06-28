import { useMemo, useState } from 'react'
import { HOY, eur } from '../lib/data'
import { prepManana, type PrepItem } from '../lib/cierre'
import { isDemoMode } from '../lib/demo'
import { Money } from '../components/ui'

/* PREPARAR MAÑANA (Juan, 28-jun). Vista forward que SALE de Caja diaria: a partir de lo que vendes, qué te
   falta para mañana, cuánto pedir (editable) y a quién. Dos vistas: Lista (A) y Por proveedor (B).
   Dato = prepManana() (cruza ventas×stock en cierre.ts, FUENTE ÚNICA). € siempre vía <Money>. */

const nivelLabel = (n: PrepItem['nivel']) => (n === 'alta' ? 'Repón ya' : n === 'media' ? 'Justo' : 'Suficiente')
const cargoIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
  </svg>
)

export default function PrepararManana() {
  const demo = isDemoMode()
  const prep = useMemo(() => prepManana(HOY), [])
  const [vista, setVista] = useState<'lista' | 'prov'>('lista')
  // cantidad a pedir editable (arranca del sugerido)
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(prep.items.map((i) => [i.item, i.pedir])))
  const bump = (it: PrepItem, d: number) => setQty((q) => ({ ...q, [it.item]: Math.max(0, (q[it.item] ?? it.pedir) + d) }))

  const reponer = prep.items.filter((i) => i.nivel !== 'ok')
  const total = useMemo(
    () => prep.items.reduce((s, i) => s + Math.round((qty[i.item] ?? i.pedir) * i.precio), 0),
    [qty, prep],
  )
  // agrupado por proveedor con las cantidades EDITADAS (consistente con la lista)
  const grupos = useMemo(() => {
    const m = new Map<string, PrepItem[]>()
    for (const i of reponer) {
      if (!m.has(i.proveedor)) m.set(i.proveedor, [])
      m.get(i.proveedor)!.push(i)
    }
    return [...m.entries()]
      .map(([proveedor, items]) => ({ proveedor, items, total: items.reduce((s, i) => s + Math.round((qty[i.item] ?? i.pedir) * i.precio), 0) }))
      .sort((a, b) => b.total - a.total)
  }, [reponer, qty])

  const Bar = ({ it }: { it: PrepItem }) => {
    const pct = Math.min(100, Math.round((it.quedan / Math.max(1, it.necesita)) * 100))
    return (
      <span className={'prep-bar ' + (it.nivel === 'alta' ? 'b-bad' : it.nivel === 'media' ? 'b-warn' : 'b-ok')}>
        <i style={{ width: pct + '%' }} />
      </span>
    )
  }
  const Estado = ({ n }: { n: PrepItem['nivel'] }) => (
    <span className={'prep-st ' + n}>{nivelLabel(n)}</span>
  )

  return (
    <div className="prep">
      <header className="prep-head">
        <div className="prep-h-tx">
          <h1>Preparar mañana</h1>
          <p>Según lo que sueles vender, esto es lo que te faltará. Ajusta y genera el pedido de un toque.</p>
        </div>
        <div className="prep-toggle" role="tablist" aria-label="Vista">
          <button role="tab" aria-selected={vista === 'lista'} className={vista === 'lista' ? 'on' : ''} onClick={() => setVista('lista')}>Lista</button>
          <button role="tab" aria-selected={vista === 'prov'} className={vista === 'prov' ? 'on' : ''} onClick={() => setVista('prov')}>Por proveedor</button>
        </div>
      </header>

      {!demo ? (
        <div className="prep-empty">Aún sin previsión — cuando entren ventas reales, aquí calculo el pedido de mañana.</div>
      ) : (
        <>
          {/* resumen */}
          <div className="prep-strip">
            <div className="ps"><span className="ps-v">{prep.nRepon}</span><span className="ps-l">A reponer</span></div>
            <div className="ps"><span className="ps-v"><Money value={eur(total)} /></span><span className="ps-l">Pedido estimado</span></div>
            <div className="ps"><span className="ps-v ok">OK</span><span className="ps-l">Cubre hasta el cierre</span></div>
          </div>

          {vista === 'lista' ? (
            <div className="card prep-card">
              <div className="prep-list">
                {prep.items.map((it) => (
                  <div className={'prep-it' + (it.nivel === 'ok' ? ' done' : '')} key={it.item}>
                    <span className="prep-th"><img src={it.img} alt="" loading="lazy" draggable={false} /></span>
                    <div className="prep-grow">
                      <div className="prep-nm">{it.item}</div>
                      <div className="prep-meta">tienes {it.quedan} · necesitas ~{it.necesita} {it.unidad}</div>
                      <Bar it={it} />
                    </div>
                    <div className="prep-qty" data-off={it.nivel === 'ok' ? '1' : undefined}>
                      <span className="pq-lab">pedir</span>
                      <button onClick={() => bump(it, -1)} aria-label="Menos">−</button>
                      <b className="tnum">{qty[it.item] ?? it.pedir} {it.unidad}</b>
                      <button onClick={() => bump(it, 1)} aria-label="Más">+</button>
                    </div>
                    <Estado n={it.nivel} />
                  </div>
                ))}
              </div>
              <div className="prep-foot">
                <button className="prep-cta">{cargoIcon} Generar pedido · <Money value={eur(total)} className="onbrand" /></button>
                <span className="prep-foot-note">Se envía a cada proveedor por WhatsApp/email</span>
              </div>
            </div>
          ) : (
            <div className="prep-prov">
              {grupos.map((g) => (
                <div className="card prep-sup" key={g.proveedor}>
                  <div className="prep-sup-h">
                    <b>{g.proveedor}</b>
                    <span className="prep-sup-tot"><Money value={eur(g.total)} /></span>
                  </div>
                  {g.items.map((it) => (
                    <div className="prep-it sm" key={it.item}>
                      <span className="prep-th sm"><img src={it.img} alt="" loading="lazy" draggable={false} /></span>
                      <div className="prep-grow">
                        <div className="prep-nm">{it.item}</div>
                        <div className="prep-meta">{qty[it.item] ?? it.pedir} {it.unidad}</div>
                      </div>
                      <Estado n={it.nivel} />
                    </div>
                  ))}
                  <div className="prep-foot sm">
                    <button className="prep-cta sm">{cargoIcon} Pedir a {g.proveedor.split(' ')[0]}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
