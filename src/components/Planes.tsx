import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import GlitterBG from './GlitterBG'
import { play } from '../lib/sound'

const PRO_PRICE = 59
// Palancas de AHORRO que da Pro, como % de la facturación (prudentes, defendibles ante el dueño):
//  food cost controlado (escandallo + alertas) ~2%, personal ajustado a la demanda ~1%, compras/mermas ~0.7%.
const LEVERS = [
  { emo: '🍔', tx: 'Food cost optimizado', pct: 0.02 },
  { emo: '👥', tx: 'Personal ajustado a la demanda', pct: 0.01 },
  { emo: '📦', tx: 'Compras y mermas bajo control', pct: 0.007 },
]
const fmtN = (n: number) => Math.round(n).toLocaleString('es-ES')

// CALCULADORA DE ROI: el dueño mueve su facturación → ve EN VIVO lo que Pro le devuelve al mes/año.
// "Vender el plan con su propio retorno" (norte de producto de Juan, 28-jun).
function RoiCalc() {
  const MIN = 3000, MAX = 80000
  const [rev, setRev] = useState(18000)
  const total = LEVERS.reduce((s, l) => s + rev * l.pct, 0)
  const roi = total / PRO_PRICE
  const pct = ((rev - MIN) / (MAX - MIN)) * 100
  return (
    <div className="roi-calc panel-card">
      <div className="roi-head">
        <span className="roi-kick">📈 Calculadora de retorno</span>
        <h2>¿Cuánto te haría ganar <b>Pro</b>?</h2>
      </div>
      <div className="roi-slider-wrap">
        <div className="roi-lab-row">
          <label htmlFor="roi-rev">Tu facturación mensual</label>
          <span className="roi-revval"><b>{fmtN(rev)}</b><i>€</i></span>
        </div>
        <input
          id="roi-rev" className="roi-range" type="range" min={MIN} max={MAX} step={500} value={rev}
          onChange={(e) => setRev(parseInt(e.target.value))}
          style={{ ['--p' as string]: pct + '%' }}
          aria-label="Tu facturación mensual"
        />
        <div className="roi-scale"><span>3.000 €</span><span>80.000 €</span></div>
      </div>
      <div className="roi-result">
        <div className="roi-big">
          <span className="roi-big-lab">Con Pro recuperarías hasta</span>
          <span className="roi-big-num"><b>{fmtN(total)}</b><i>€/mes</i></span>
          <span className="roi-big-year">≈ {fmtN(total * 12)} € al año</span>
        </div>
        <ul className="roi-breakdown">
          {LEVERS.map((l) => (
            <li key={l.tx}>
              <span className="rb-emo">{l.emo}</span>
              <span className="rb-tx">{l.tx}</span>
              <b>+{fmtN(rev * l.pct)} €</b>
            </li>
          ))}
        </ul>
        <div className="roi-verdict">
          Pro cuesta <b>{PRO_PRICE} €/mes</b> y se paga solo <b className="roi-x">{roi >= 10 ? Math.round(roi) : roi.toFixed(1)}×</b>.
        </div>
      </div>
    </div>
  )
}

/* Pantalla de PLANES (pricing premium): Free · Basic · Pro. Pro va cargado de features y resaltado
   (glow dorado + "Recomendado") para que COMPENSE pasarse. Fondo = el mismo glitter de la intro.
   Se abre desde el perfil ("Mejorar") vía evento 'rebell:open-planes'. (Juan, 28-jun) */

type Plan = {
  id: 'free' | 'basic' | 'pro'
  name: string
  price: string
  tagline: string
  features: string[]
  best?: boolean
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '0',
    tagline: 'Lo esencial para arrancar',
    features: ['Caja diaria', 'TPV básico', 'Comandas (KDS)', '1 local', 'Soporte por email'],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '29',
    tagline: 'Controla los números',
    features: ['Todo lo de Free', 'Ventas + Compras por día', 'Coste de personal', 'Food cost', 'Gastos fijos', 'Resumen / P&L', 'Hasta 3 locales'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '59',
    tagline: 'El arsenal completo',
    best: true,
    features: [
      'Todo lo de Basic',
      '🛰️ Mapa de rivales con IA',
      '📱 Pedido online por QR',
      '🔔 Alertas inteligentes de competencia',
      '📈 Analítica avanzada + tendencias',
      '♾️ Locales ilimitados',
      '🎯 Soporte prioritario 24/7',
      '✨ Acceso anticipado a novedades',
    ],
  },
]

export default function Planes({ onClose, current = 'pro' }: { onClose: () => void; current?: string }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  return (
    <motion.div className="planes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <GlitterBG />
      <div className="planes-veil" aria-hidden="true" />
      <button className="planes-x" onClick={onClose} aria-label="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>

      <motion.div className="planes-inner" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 26 }}>
        <header className="planes-head">
          <span className="planes-kick">◆ Planes REBELL</span>
          <h1>Lleva tu negocio al siguiente nivel</h1>
          <p>Empieza gratis y sube cuando quieras. <b>Pro</b> incluye todo lo que de verdad mueve la aguja.</p>
        </header>

        <RoiCalc />

        <div className="planes-grid">
          {PLANS.map((p) => (
            <div key={p.id} className={'plan-card' + (p.best ? ' best' : '') + (current === p.id ? ' current' : '')}>
              {p.best && <span className="plan-badge">★ Recomendado</span>}
              <div className="plan-name">{p.name}</div>
              <div className="plan-price"><b>{p.price}</b><i>€/mes</i></div>
              <div className="plan-tag">{p.tagline}</div>
              <ul className="plan-feats">
                {p.features.map((f, i) => (
                  <li key={i}><span className="pf-check">✓</span>{f}</li>
                ))}
              </ul>
              <button
                className={'plan-cta' + (p.best ? ' gold' : '')}
                disabled={current === p.id}
                onClick={() => play(p.best ? 'success' : 'tap', 0.5, p.best ? 1.1 : 1)}
              >
                {current === p.id ? 'Tu plan actual' : p.id === 'free' ? 'Empezar gratis' : `Mejorar a ${p.name}`}
              </button>
            </div>
          ))}
        </div>

        <p className="planes-foot">Sin permanencia · cancela cuando quieras · IVA no incluido</p>
      </motion.div>
    </motion.div>
  )
}
