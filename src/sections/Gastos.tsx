import { useMemo, useState, type CSSProperties } from 'react'
import { Card, SectionHeader, Badge, CountValue } from '../components/ui'

// Formato es-ES CON punto de millar también en 4 cifras (el locale no lo pone por defecto).
const e0 = (n: number) => n.toLocaleString('es-ES', { useGrouping: true, maximumFractionDigits: 0 })

// Una sola fuente de color por categoría (la comparten tarta, barras y conceptos).
const CAT_META: Record<string, { color: string }> = {
  Alquiler: { color: '#ffbf10' },
  Suministros: { color: '#ff7a45' },
  Otros: { color: '#b58bf0' },
  Seguros: { color: '#4aa3ff' },
  Software: { color: '#34d399' },
}
const CAT_ORDER = Object.keys(CAT_META)

type Concepto = { concepto: string; cat: keyof typeof CAT_META | string; importe: number; iva: string }

const CONCEPTOS_INIT: Concepto[] = [
  { concepto: 'Alquiler local', cat: 'Alquiler', importe: 1200, iva: '0 %' },
  { concepto: 'Luz (Endesa)', cat: 'Suministros', importe: 320, iva: '10 %' },
  { concepto: 'Agua', cat: 'Suministros', importe: 90, iva: '10 %' },
  { concepto: 'Gas natural', cat: 'Suministros', importe: 210, iva: '21 %' },
  { concepto: 'Seguro RC / incendios', cat: 'Seguros', importe: 280, iva: '0 %' },
  { concepto: 'Gestoría laboral', cat: 'Otros', importe: 180, iva: '21 %' },
  { concepto: 'Software TPV (REBELL)', cat: 'Software', importe: 129, iva: '21 %' },
  { concepto: 'Internet + teléfono', cat: 'Software', importe: 81, iva: '21 %' },
  { concepto: 'Contenedor basura', cat: 'Otros', importe: 750, iva: '0 %' },
]

export default function Gastos() {
  // Estado editable: tocar un importe recalcula tarta + barras + KPIs en vivo (count-up).
  const [conceptos, setConceptos] = useState<Concepto[]>(CONCEPTOS_INIT)
  const [editId, setEditId] = useState<number | null>(null)

  const { cats, total, maxCat } = useMemo(() => {
    const sums: Record<string, number> = {}
    for (const c of conceptos) sums[c.cat] = (sums[c.cat] || 0) + c.importe
    const cats = CAT_ORDER.map((name) => ({ name, value: sums[name] || 0, color: CAT_META[name].color })).filter((c) => c.value > 0)
    const total = cats.reduce((s, c) => s + c.value, 0)
    const maxCat = Math.max(1, ...cats.map((c) => c.value))
    return { cats, total, maxCat }
  }, [conceptos])

  const prorrateo = total / 30

  // conic-gradient de la tarta a partir de las categorías reales.
  let acc = 0
  const stops = cats
    .map((c) => {
      const a = acc
      acc += (c.value / total) * 100
      return `${c.color} ${a.toFixed(2)}% ${acc.toFixed(2)}%`
    })
    .join(', ')

  function setImporte(idx: number, raw: string) {
    const n = Math.max(0, Math.round(Number(raw.replace(/[^\d.,]/g, '').replace(',', '.')) || 0))
    setConceptos((prev) => prev.map((c, i) => (i === idx ? { ...c, importe: n } : c)))
  }

  return (
    <div className="section">
      <SectionHeader title="Gastos fijos" subtitle="Costes recurrentes · toca un importe para editar" right={<Badge tone="muted">Junio 2026</Badge>} />

      {/* KPIs vivos: recalculan con count-up al editar */}
      <div className="gx-kpis">
        <div className="gx-kpi">
          <span className="gx-kpi-l">Total mensual</span>
          <b className="gx-kpi-v tnum"><CountValue value={e0(total)} /><i>€</i></b>
          <span className="gx-kpi-f">{conceptos.length} conceptos activos</span>
        </div>
        <div className="gx-kpi">
          <span className="gx-kpi-l">Prorrateo diario</span>
          <b className="gx-kpi-v tnum"><CountValue value={e0(prorrateo)} /><i>€</i></b>
          <span className="gx-kpi-f">30 días naturales</span>
        </div>
        <div className="gx-kpi">
          <span className="gx-kpi-l">Categoría líder</span>
          <b className="gx-kpi-v tnum" style={{ color: cats[0]?.color }}>{cats.slice().sort((a, b) => b.value - a.value)[0]?.name}</b>
          <span className="gx-kpi-f">{Math.round(((cats.slice().sort((a, b) => b.value - a.value)[0]?.value || 0) / total) * 100)}% del total</span>
        </div>
      </div>

      {/* HÉROE: tarta grande animada + barras gordas por categoría (etiqueta encima) */}
      <Card>
        <div className="card-head">
          <h3>Estructura de gastos</h3>
          <Badge tone="muted">por categoría · mensual</Badge>
        </div>
        <div className="gx-hero">
          <div className="gx-pie-wrap">
            <div className="gx-pie" style={{ ['--pie' as string]: `conic-gradient(from -90deg, ${stops})` } as CSSProperties}>
              <div className="gx-pie-hole">
                <b className="tnum"><CountValue value={e0(total)} /> €</b>
                <span>al mes</span>
              </div>
            </div>
          </div>
          <div className="gx-cats">
            {cats.map((c, i) => (
              <div className="gx-cat" key={c.name} style={{ ['--d' as string]: `${i * 70}ms`, ['--c' as string]: c.color } as CSSProperties}>
                <div className="gx-cat-top">
                  <span className="gx-cat-n"><i style={{ background: c.color }} />{c.name}</span>
                  <span className="gx-cat-v tnum">{e0(c.value)} €<em>{Math.round((c.value / total) * 100)}%</em></span>
                </div>
                <div className="gx-cat-track">
                  <span className="gx-cat-fill" style={{ width: (c.value / maxCat) * 100 + '%', background: `linear-gradient(90deg, color-mix(in srgb, ${c.color} 78%, #000), ${c.color})` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Conceptos EDITABLES: cambiar un importe recalcula todo arriba */}
      <Card>
        <div className="card-head">
          <h3>Conceptos</h3>
          <Badge tone="muted">{conceptos.length} · {e0(total)} €/mes</Badge>
        </div>
        <div className="gx-cons">
          {conceptos.map((c, i) => (
            <div className={'gx-con' + (editId === i ? ' editing' : '')} key={i}>
              <span className="gx-con-dot" style={{ background: CAT_META[c.cat]?.color || 'var(--muted)' }} />
              <div className="gx-con-main">
                <b className="gx-con-name">{c.concepto}</b>
                <span className="gx-con-sub">{c.cat} · IVA {c.iva} · {e0(c.importe / 30)} €/día</span>
              </div>
              <label className="gx-con-edit" title="Editar importe">
                <input
                  className="gx-con-input tnum"
                  inputMode="numeric"
                  value={c.importe}
                  onChange={(e) => setImporte(i, e.target.value)}
                  onFocus={() => setEditId(i)}
                  onBlur={() => setEditId(null)}
                  aria-label={`Importe de ${c.concepto}`}
                />
                <span className="gx-con-cur">€</span>
              </label>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
