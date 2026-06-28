import { motion } from 'motion/react'
import { eur0, reduceMotion } from '../lib/data'

/* Cascada (waterfall) de la cuenta de resultados: Facturación → −Personal → −Food cost → −Gastos = Neto.
   Cada coste "cae" desde el saldo anterior → se VE cómo se come la facturación hasta el beneficio.
   Columnas EQUIDISTANTES (grid 1fr, regla de Juan). Barras crecen one-shot, sombra neutra, reduced-motion. */

type Tone = 'fact' | 'personal' | 'food' | 'gastos' | 'neto'
const COLORS: Record<Tone, string> = {
  fact: 'linear-gradient(180deg, var(--gold), var(--gold-deep, #d99a16))',
  personal: 'linear-gradient(180deg, #4f95ff, #2f7fd6)',
  food: 'linear-gradient(180deg, #f6b53f, #d99820)',
  gastos: 'linear-gradient(180deg, rgba(255,255,255,.34), rgba(255,255,255,.2))',
  neto: 'linear-gradient(180deg, #ffd45e, var(--gold))',
}

export default function WaterfallPL({ facturacion, personal, foodCost, gastos }: { facturacion: number; personal: number; foodCost: number; gastos: number }) {
  const neto = Math.round((facturacion - personal - foodCost - gastos) * 100) / 100
  const max = facturacion || 1
  const pct = (n: number) => Math.round((n / max) * 1000) / 10
  const rm = reduceMotion()

  const neg = (n: number) => (n ? '−' + eur0(n) : eur0(0)) // sin coste → "0 €", nunca "−0 €"
  // bottom = base de la barra (saldo tras restar) · h = altura (lo que vale el paso)
  const cols: { key: Tone; label: string; amount: number; bottom: number; h: number; signed: string }[] = [
    { key: 'fact', label: 'Facturación', amount: facturacion, bottom: 0, h: facturacion, signed: eur0(facturacion) },
    { key: 'personal', label: 'Personal', amount: personal, bottom: facturacion - personal, h: personal, signed: neg(personal) },
    { key: 'food', label: 'Food cost', amount: foodCost, bottom: facturacion - personal - foodCost, h: foodCost, signed: neg(foodCost) },
    { key: 'gastos', label: 'Gastos fijos', amount: gastos, bottom: neto, h: gastos, signed: neg(gastos) },
    { key: 'neto', label: 'Neto', amount: neto, bottom: 0, h: neto, signed: eur0(neto) },
  ]

  return (
    <div className="wf">
      {cols.map((c, i) => (
        <div className={'wf-col' + (c.key === 'fact' || c.key === 'neto' ? ' total' : '')} key={c.key}>
          <div className="wf-plot">
            <span className="wf-cap tnum" style={{ bottom: `calc(${pct(c.bottom + c.h)}% + 4px)` }}>{c.signed} €</span>
            <motion.div
              className="wf-bar"
              style={{ bottom: pct(c.bottom) + '%', background: COLORS[c.key] }}
              initial={{ height: rm ? pct(c.h) + '%' : 0 }}
              animate={{ height: pct(c.h) + '%' }}
              transition={rm ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 18, delay: 0.06 * i }}
            />
          </div>
          <div className="wf-lab">
            <span>{c.label}</span>
            <small className="tnum">{pct(c.amount)}%</small>
          </div>
        </div>
      ))}
    </div>
  )
}
