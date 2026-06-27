import { useMemo } from 'react'
import { Card, SectionHeader, KpiTile, BarRow, Badge, Donut, Grid } from '../components/ui'
import { useFoodcost, setCoste, fichaFoodCost, fcMedio } from '../lib/foodcost'
import { imgFor } from '../lib/products'

/* Food cost — escandallo sobre la CARTA REAL (`products.ts`). PVP de la carta, coste editable aquí →
   FC% y margen se calculan; KPIs/donut/barras recalculan en vivo. (audit · Food cost) */

const e2 = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fcTone = (fc: number): 'green' | 'amber' | 'red' => (fc <= 28 ? 'green' : fc <= 33 ? 'amber' : 'red')
const fcColor = (fc: number) => (fc <= 28 ? 'green' : fc <= 33 ? 'amber' : 'red')

export default function FoodCost() {
  const costes = useFoodcost() // suscribe: editar un coste recalcula todo
  const { ficha, medio, mejor, peor, maxFc } = useMemo(() => {
    const ficha = fichaFoodCost().slice().sort((a, b) => a.fc - b.fc)
    return {
      ficha,
      medio: fcMedio(),
      mejor: ficha[0],
      peor: ficha[ficha.length - 1],
      maxFc: Math.max(1, ...ficha.map((f) => f.fc)),
    }
  }, [costes])

  return (
    <div className="section">
      <SectionHeader title="Food cost" subtitle="Ficha técnica · escandallo de la carta · toca un coste para editar" right={<Badge tone="gold">carta activa</Badge>} />

      <Grid cols={3} className="kpi-grid">
        <KpiTile label="Food cost medio" value={String(medio).replace('.', ',')} unit="%" delta="objetivo < 30%" foot="media de la carta" trend={medio < 30 ? 'up' : 'down'} />
        <KpiTile label="Plato más rentable" value={mejor?.name ?? '—'} delta={`${mejor ? String(mejor.fc).replace('.', ',') : 0}% FC`} foot={`margen ${e2(mejor?.margen ?? 0)} €`} trend="up" />
        <KpiTile label="Plato a revisar" value={peor?.name ?? '—'} delta={`${peor ? String(peor.fc).replace('.', ',') : 0}% FC`} foot="revisar receta o PVP" trend="down" />
      </Grid>

      <Grid cols={2}>
        <Card>
          <div className="card-head">
            <h3>Food cost global</h3>
            <Badge tone={fcTone(medio)}>media de la carta</Badge>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem 0' }}>
            <Donut value={Math.round(medio)} label="food cost" sub="media de la carta" tone={fcTone(medio)} />
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <h3>Distribución FC por plato</h3>
            <span className="muted-s">% sobre PVP</span>
          </div>
          <div className="bar-rows">
            {ficha.map((f) => (
              <BarRow key={f.id} label={f.name} value={f.fc} max={maxFc} color={fcColor(f.fc)} amount={String(f.fc).replace('.', ',') + '%'} />
            ))}
          </div>
        </Card>
      </Grid>

      <Card>
        <div className="card-head">
          <h3>Ficha técnica — rentabilidad por plato</h3>
          <Badge tone="muted">{ficha.length} referencias</Badge>
        </div>
        <div className="fc-ficha">
          <div className="fc-row fc-head">
            <span>Plato</span><span>PVP</span><span>Coste mat.</span><span>Food cost</span><span>Margen</span>
          </div>
          {ficha.map((f) => (
            <div className="fc-row" key={f.id}>
              <span className="fc-plato">
                <span className="fc-th">{imgFor(f.name) ? <img src={imgFor(f.name)} alt="" loading="lazy" /> : null}</span>
                {f.name}
              </span>
              <span className="tnum fc-pvp">{e2(f.pvp)} €</span>
              <label className="fc-coste" title="Editar coste de materia">
                <input className="tnum" inputMode="decimal" value={String(f.coste).replace('.', ',')}
                  onChange={(e) => setCoste(f.id, Number(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.')) || 0)}
                  aria-label={`Coste de ${f.name}`} />
                <i>€</i>
              </label>
              <span className="fc-fc"><Badge tone={fcTone(f.fc)}>{String(f.fc).replace('.', ',')}%</Badge></span>
              <b className="tnum fc-margen">{e2(f.margen)} €</b>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
