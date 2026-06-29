import { Donut } from '../components/ui'
import { useRevealOnce } from '../lib/reveal'
import { pasosOnboarding, onboardingHechos, onboardingTotal, onboardingPct, onboardingPendientes } from '../lib/onboarding'

/* PRIMEROS PASOS — el semáforo de onboarding (solo modo real; en demo todo está lleno).
   Le dice al cliente QUÉ tiene y QUÉ le falta, en lenguaje llano, y al pulsar un paso lo
   lleva a la sección para rellenarlo (misma puerta de navegación: rebell:goto). Tamaño
   natural: lista corta, NO se estira a pantalla completa (hueco abajo = correcto). */
const goto = (id: string) => window.dispatchEvent(new CustomEvent('rebell:goto', { detail: id }))

export default function PrimerosPasos() {
  const rev = useRevealOnce('primeros')
  const pasos = pasosOnboarding()
  const hechos = onboardingHechos()
  const total = onboardingTotal()
  const pct = onboardingPct()
  const faltan = onboardingPendientes()
  const completo = faltan === 0

  return (
    <div className={'section pp' + (rev ? ' pp-rev' : '')}>
      {/* HERO: anillo de progreso + saludo en lenguaje llano */}
      <div className="pp-hero">
        <Donut value={pct} tone={completo ? 'green' : 'gold'} />
        <div className="pp-hero-txt">
          <h1>{completo ? '¡Tu local está a punto!' : 'Pon tu local a punto'}</h1>
          <p>
            {completo
              ? 'Ya tienes lo básico configurado. Puedes empezar a trabajar con datos reales.'
              : `Llevas ${hechos} de ${total} pasos. Te ${faltan === 1 ? 'falta' : 'faltan'} ${faltan} para tenerlo todo listo.`}
          </p>
        </div>
      </div>

      {/* CHECKLIST: un paso = una tarjeta clicable que te lleva a su sección */}
      <div className="pp-list">
        {pasos.map((p, i) => (
          <button
            key={p.sec}
            className={'pp-step' + (p.hecho ? ' done' : '')}
            style={{ ['--d' as string]: `${i * 60}ms` }}
            onClick={() => goto(p.sec)}
          >
            <span className="pp-emo" aria-hidden="true">{p.emoji}</span>
            <span className="pp-main">
              <b>{p.titulo}</b>
              <span>{p.hecho ? `${p.n} ${p.n === 1 ? p.unidad[0] : p.unidad[1]}` : p.falta}</span>
            </span>
            <span className="pp-status">
              {p.hecho ? (
                <span className="pp-check" aria-label="Hecho">✓</span>
              ) : (
                <span className="pp-cta">Añadir →</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
