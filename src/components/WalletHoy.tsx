import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useCajaDelDia, walletTotal, walletEntries, walletBase, type CobroDetail } from '../lib/wallet'
import { playCoin, play } from '../lib/sound'
import { eur, reduceMotion } from '../lib/data'

type Flying = { id: number; x0: number; y0: number; x1: number; y1: number; midX: number; peakY: number; delay: number; rot: number }
type Pop = { id: number; amount: number }

const FLIGHT = 0.62 // s de vuelo de cada moneda
const hhmm = (ts: number) => {
  const d = new Date(ts)
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

/* Cartera del día (cabecera, al lado del botón de tema). Marcador de videojuego: el € sube cuando entra
   dinero. Muestra EXACTAMENTE lo mismo que "Ventas hoy" del TPV (mismo store `useCajaDelDia`). Al PULSARLA
   se abre el DESGLOSE: los pedidos (mesas + tickets) que hicieron esa cifra. Escucha `rebell:cobro` para
   lanzar las monedas DESDE la mesa tocada HACIA la cartera. (Juan, 26-jun) */
export default function WalletHoy() {
  const shown = useCajaDelDia() // valor animado (única fuente, igual que "Ventas hoy")
  const [coins, setCoins] = useState<Flying[]>([])
  const [pops, setPops] = useState<Pop[]>([])
  const [bump, setBump] = useState(0)
  const [open, setOpen] = useState(false)
  const [, force] = useState(0) // refresca el desglose cuando cambia la caja
  const [anchor, setAnchor] = useState({ top: 56, right: 16 })
  const pillRef = useRef<HTMLButtonElement>(null)
  const seq = useRef(0)

  // refresca la lista de pedidos en cuanto cambia la caja (cobro de mesa o ticket)
  useEffect(() => {
    const onCaja = () => force((n) => n + 1)
    window.addEventListener('rebell:caja', onCaja)
    return () => window.removeEventListener('rebell:caja', onCaja)
  }, [])

  useEffect(() => {
    const onCobro = (ev: Event) => {
      const d = (ev as CustomEvent<CobroDetail>).detail
      if (!d || !d.amount) return
      const r = pillRef.current?.getBoundingClientRect()
      const tx = r ? r.left + r.width / 2 : window.innerWidth - 56
      const ty = r ? r.top + r.height / 2 : 40
      const n = Math.max(3, Math.min(12, d.coins ?? 8))
      const popId = ++seq.current
      setPops((p) => [...p, { id: popId, amount: d.amount }])
      window.setTimeout(() => setPops((p) => p.filter((q) => q.id !== popId)), 1100)

      // (el VALOR ya lo sumó el origen del cobro vía addWallet → aquí SOLO el adorno: monedas + sonido + rebote)
      if (reduceMotion()) {
        setBump((b) => b + 1)
        playCoin(0.7, 0)
        return
      }
      const fly: Flying[] = Array.from({ length: n }, (_, i) => {
        const x0 = d.x + (Math.random() * 46 - 23)
        const y0 = d.y + (Math.random() * 36 - 18)
        return {
          id: ++seq.current,
          x0,
          y0,
          x1: tx,
          y1: ty,
          midX: (x0 + tx) / 2 + (Math.random() * 60 - 30),
          peakY: Math.min(y0, ty) - (70 + Math.random() * 60),
          delay: i * 0.055,
          rot: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360),
        }
      })
      setCoins((c) => [...c, ...fly])
      fly.forEach((f, i) => {
        window.setTimeout(() => {
          setBump((b) => b + 1) // rebote de la cartera al aterrizar cada moneda (el valor ya estaba sumado)
          playCoin(0.6, i % n)
          setCoins((c) => c.filter((cc) => cc.id !== f.id))
        }, (f.delay + FLIGHT) * 1000)
      })
    }
    window.addEventListener('rebell:cobro', onCobro as EventListener)
    return () => window.removeEventListener('rebell:cobro', onCobro as EventListener)
  }, [])

  function toggle() {
    const r = pillRef.current?.getBoundingClientRect()
    if (r) setAnchor({ top: Math.round(r.bottom + 8), right: Math.round(window.innerWidth - r.right) })
    setOpen((o) => !o)
    play('tap', 0.5, 1.05)
  }

  const entries = walletEntries()
  const base = walletBase()
  const overlayRoot = (typeof document !== 'undefined' && document.querySelector('.app')) || document.body

  return (
    <>
      <button className={'wallet-hoy' + (open ? ' open' : '')} ref={pillRef} onClick={toggle} title="Caja del día · ver pedidos" aria-expanded={open}>
        <span className="wh-txt">
          <span className="wh-lbl">Hoy</span>
          <motion.span className="wh-val tnum" key={'v' + bump} initial={{ y: 0 }} animate={{ y: [-2, 0] }} transition={{ duration: 0.22 }}>
            {eur(shown)}<i>€</i>
          </motion.span>
        </span>
        <AnimatePresence>
          {pops.map((p) => (
            <motion.span key={p.id} className="wh-pop tnum" initial={{ opacity: 0, y: 6, scale: 0.8 }} animate={{ opacity: 1, y: -16, scale: 1 }} exit={{ opacity: 0, y: -26 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
              +{eur(p.amount)} €
            </motion.span>
          ))}
        </AnimatePresence>
      </button>

      {/* ── DESGLOSE: los pedidos que hicieron la cifra (videojuego) ── */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              <motion.div className="wh-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
              <motion.div
                className="wh-panel"
                style={{ top: anchor.top, right: anchor.right } as CSSProperties}
                initial={{ opacity: 0, scale: 0.94, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -6 }}
                transition={{ type: 'spring', stiffness: 460, damping: 32 }}
              >
                <header className="whp-head">
                  <div className="whp-htxt">
                    <span className="whp-lbl">Caja del día</span>
                    <b className="whp-total tnum">{eur(walletTotal())}<i>€</i></b>
                  </div>
                  <span className="whp-count">{entries.length} pedido{entries.length === 1 ? '' : 's'}</span>
                </header>
                <div className="whp-list">
                  {entries.map((e) => (
                    <motion.div className="whp-row" key={e.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
                      <span className={'whp-ic ' + e.tipo}>{e.tipo === 'mesa' ? '🪙' : '🧾'}</span>
                      <span className="whp-tx">
                        <b>{e.label}</b>
                        <small>{e.tipo === 'mesa' ? 'Cuenta de mesa' : 'Ticket'} · {hhmm(e.ts)}</small>
                      </span>
                      <span className="whp-amt tnum">+{eur(e.amount)} €</span>
                    </motion.div>
                  ))}
                  {base > 0 && (
                    <div className="whp-row whp-base">
                      <span className="whp-ic prev">📒</span>
                      <span className="whp-tx">
                        <b>Ventas anteriores</b>
                        <small>antes de este registro</small>
                      </span>
                      <span className="whp-amt tnum">{eur(base)} €</span>
                    </div>
                  )}
                  {!entries.length && base <= 0 && <div className="whp-empty">Aún no hay cobros hoy</div>}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        overlayRoot,
      )}

      {createPortal(
        <div className="coinfx" aria-hidden="true">
          {coins.map((c) => (
            <motion.span
              key={c.id}
              className="coinfly"
              initial={{ x: c.x0, y: c.y0, scale: 0.45, opacity: 0, rotate: 0 }}
              animate={{ x: [c.x0, c.midX, c.x1], y: [c.y0, c.peakY, c.y1], scale: [0.5, 1.05, 0.7], opacity: [0, 1, 1], rotate: [0, c.rot * 0.5, c.rot] }}
              transition={{ duration: FLIGHT, delay: c.delay, ease: [0.4, 0, 0.7, 1] }}
              style={{ ['--cf' as string]: `${(c.id % 3) * 0.04 + 0.9}` } as CSSProperties}
            >
              €
            </motion.span>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
