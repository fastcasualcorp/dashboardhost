import { type CSSProperties } from 'react'
import { type Mesa, elePath, mmss } from '../lib/salon'

/* Superficie VISUAL de una mesa (forma + número + cuenta atrás). FUENTE ÚNICA: la usan el editor de
   Salón y el selector de mesa del TPV → nunca se ven distintos (la mesa en L, los colores de estado y
   el timer salen de un solo sitio). El COLOR de estado lo pinta el wrapper (.salon-mesa.srv.e-<estado>),
   también compartido por ambos. (Juan, 26-jun) */
export function MesaTile({
  mesa,
  rem = null,
  over = false,
  cobrar = false,
  rot,
  grouped = false,
}: {
  mesa: Mesa
  rem?: number | null // ms que quedan de reserva (null = no mostrar timer)
  over?: boolean // reserva pasada → "Liberar"
  cobrar?: boolean // muestra el € (por cobrar)
  rot?: number // rotación de la mesa → el contenido se contra-rota para leerse derecho
  grouped?: boolean // forma parte de un banco unido → su superficie no se pinta (la dibuja el grupo)
}) {
  const round = mesa.forma === 'redonda'
  const isEle = mesa.forma === 'ele'
  // L: el contenido se ancla al centroide (left/top en CSS) → translate(-50%,-50%) lo centra ahí; + contra-rotación.
  const contentTransform = isEle ? `translate(-50%, -50%) rotate(${-(rot ?? 0)}deg)` : rot ? `rotate(${-rot}deg)` : undefined
  return (
    <div
      className={'sm-surface' + (mesa.forma === 'ele' ? ' ele' : '') + (grouped ? ' grouped' : '')}
      style={mesa.forma === 'ele' ? undefined : { borderRadius: round ? '50%' : 16 }}
    >
      {mesa.forma === 'ele' && (
        <svg className="sm-ele-svg" viewBox={`0 0 ${Math.max(1, Math.round(mesa.w))} ${Math.max(1, Math.round(mesa.h))}`} preserveAspectRatio="none" aria-hidden="true">
          <path className="sm-ele-path" d={elePath(mesa.w, mesa.h)} />
        </svg>
      )}
      {/* contenido contra-rotado → el número/timer SIEMPRE se leen derechos aunque la mesa gire */}
      <div className="sm-content" style={contentTransform ? ({ transform: contentTransform } as CSSProperties) : undefined}>
        <span className="sm-numrow">
          <span className="sm-num">{mesa.nombre}</span>
          {cobrar && (
            // pila de moneditas JUNTO al número → "hay que cobrar esta mesa"; al tocarla vuelan a la cartera (Juan)
            <span className="sm-coins" aria-hidden="true">
              <i className="sm-coin" />
              <i className="sm-coin" />
              <i className="sm-coin">€</i>
            </span>
          )}
        </span>
        {rem != null &&
          (over ? (
            <span className="sm-timer over">Liberar</span>
          ) : (
            // reloj + cuenta atrás → se lee SIN duda como "lo que queda de reserva" (no una hora del día)
            <span className="sm-timer tnum">
              <svg className="sm-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5V12l3.2 2" />
              </svg>
              {mmss(rem)}
            </span>
          ))}
      </div>
    </div>
  )
}
