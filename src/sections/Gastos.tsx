import { useMemo, useState, type CSSProperties } from 'react'
import { Card, SectionHeader, Badge, CountValue } from '../components/ui'
import { useGastos, setGastoBase, cuotaIva, totalGasto, gastosBaseMes, gastosIvaMes, gastosMes, CAT_META, CAT_ORDER } from '../lib/gastos'

/* Gastos fijos — CALCULADORA con IVA REAL (fuente única `lib/gastos`): cada gasto tiene base + tipo de IVA;
   cuota y total se calculan. El total del mes lo lee el Resumen (P&L) → una sola cifra (gaps 3.1/3.2).
   Editar un importe recalcula tarta + barras + KPIs en vivo (count-up). */

const e0 = (n: number) => n.toLocaleString('es-ES', { useGrouping: true, maximumFractionDigits: 0 })
const e2 = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// días naturales del MES en curso (prorrateo real, no /30 fijo)
const DIM = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()

export default function Gastos() {
  const gastos = useGastos()
  const [editId, setEditId] = useState<string | null>(null)

  const { cats, total, totalBase, totalIva, maxCat } = useMemo(() => {
    const sums: Record<string, number> = {}
    for (const g of gastos) sums[g.cat] = (sums[g.cat] || 0) + totalGasto(g)
    const cats = CAT_ORDER.map((name) => ({ name, value: sums[name] || 0, color: CAT_META[name].color })).filter((c) => c.value > 0)
    const total = gastosMes()
    const maxCat = Math.max(1, ...cats.map((c) => c.value))
    return { cats, total, totalBase: gastosBaseMes(), totalIva: gastosIvaMes(), maxCat }
  }, [gastos])

  const prorrateo = total / DIM

  // conic-gradient de la tarta a partir de las categorías reales.
  let acc = 0
  const stops = cats
    .map((c) => {
      const a = acc
      acc += (c.value / total) * 100
      return `${c.color} ${a.toFixed(2)}% ${acc.toFixed(2)}%`
    })
    .join(', ')

  const lider = cats.slice().sort((a, b) => b.value - a.value)[0]

  return (
    <div className="section">
      <SectionHeader title="Gastos fijos" subtitle="Calculadora con IVA · toca un importe para editar" right={<Badge tone="muted">Junio 2026</Badge>} />

      {/* KPIs vivos: recalculan con count-up al editar */}
      <div className="gx-kpis">
        <div className="gx-kpi">
          <span className="gx-kpi-l">Total con IVA / mes</span>
          <b className="gx-kpi-v tnum"><CountValue value={e0(total)} /><i>€</i></b>
          <span className="gx-kpi-f">{gastos.length} conceptos · base {e0(totalBase)} €</span>
        </div>
        <div className="gx-kpi">
          <span className="gx-kpi-l">IVA del mes</span>
          <b className="gx-kpi-v tnum"><CountValue value={e0(totalIva)} /><i>€</i></b>
          <span className="gx-kpi-f">cuota soportada</span>
        </div>
        <div className="gx-kpi">
          <span className="gx-kpi-l">Prorrateo diario</span>
          <b className="gx-kpi-v tnum"><CountValue value={e0(prorrateo)} /><i>€</i></b>
          <span className="gx-kpi-f">{DIM} días naturales</span>
        </div>
      </div>

      {/* HÉROE: tarta grande animada + barras gordas por categoría (etiqueta encima) */}
      <Card>
        <div className="card-head">
          <h3>Estructura de gastos</h3>
          {cats.length > 0 && <Badge tone="muted">{lider?.name} lidera · {Math.round(((lider?.value || 0) / total) * 100)}%</Badge>}
        </div>
        {cats.length === 0 ? (
          <div className="vtpv-empty">Aún no has registrado gastos fijos. Añádelos abajo y aquí verás su estructura y el total al mes.</div>
        ) : (
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
        )}
      </Card>

      {/* Conceptos EDITABLES: cambiar la base recalcula IVA, total y todo arriba */}
      <Card>
        <div className="card-head">
          <h3>Conceptos</h3>
          <Badge tone="muted">{gastos.length} · {e0(total)} €/mes con IVA</Badge>
        </div>
        <div className="gx-cons">
          {gastos.map((g) => (
            <div className={'gx-con' + (editId === g.id ? ' editing' : '')} key={g.id}>
              <span className="gx-con-dot" style={{ background: CAT_META[g.cat]?.color || 'var(--muted)' }} />
              <div className="gx-con-main">
                <b className="gx-con-name">{g.concepto}</b>
                <span className="gx-con-sub">{g.cat} · IVA {g.iva}% = {e2(cuotaIva(g))} € · total {e2(totalGasto(g))} € · {e0(totalGasto(g) / DIM)} €/día</span>
              </div>
              <label className="gx-con-edit" title="Editar base imponible">
                <input
                  className="gx-con-input tnum"
                  inputMode="numeric"
                  value={g.base}
                  onChange={(e) => setGastoBase(g.id, Number(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.')) || 0)}
                  onFocus={() => setEditId(g.id)}
                  onBlur={() => setEditId(null)}
                  aria-label={`Base de ${g.concepto}`}
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
