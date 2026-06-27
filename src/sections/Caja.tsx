import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import SalesChart from '../components/SalesChart'
import { Stat, StatRow } from '../components/ui'
import { play } from '../lib/sound'
import { eur, eur0, reduceMotion, HOY } from '../lib/data'
import { cierreDia, esMismoDia, fmtDiaLargo, addDias } from '../lib/cierre'
import { useCajaDelDia } from '../lib/wallet'

gsap.registerPlugin(useGSAP)

type Turn = { efectivo: number; tarjeta: number; domicilio: number }

// Abreviaturas de día (tira de fechas, estilo week-strip).
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/* Tarta (donut) premium + INTERACTIVA de 3 quesos (efectivo/tarjeta/domicilio): al pasar por un quesito
   (o por su fila), ESE método BRILLA y se eleva, los demás se atenúan, el centro muestra su % en su color
   y su fila se resalta. Donut y leyenda comparten el mismo estado de hover (una sola fuente). (Juan, 27-jun) */
function DayBreakdown({ efe, tar, dom }: { efe: number; tar: number; dom: number }) {
  const segs = [
    { key: 'efectivo', label: 'Efectivo', v: efe, color: 'var(--cash)', icon: 'i-cash' },
    { key: 'tarjeta', label: 'Tarjeta', v: tar, color: 'var(--card)', icon: 'i-card' },
    { key: 'domicilio', label: 'Domicilio', v: dom, color: 'var(--home)', icon: 'i-home' },
  ]
  const total = efe + tar + dom || 1
  const [hov, setHov] = useState<string | null>(null)
  const dominant = segs.reduce((a, b) => (b.v > a.v ? b : a), segs[0])
  const active = (hov && segs.find((s) => s.key === hov)) || dominant
  const pct = Math.round((active.v / total) * 100)

  const r = 30
  const c = 2 * Math.PI * r
  const GAP = 13 // hueco premium entre quesos
  const draw = segs.filter((s) => s.v > 0)
  let acc = 0
  return (
    <div className="day-body" onPointerLeave={() => setHov(null)}>
      <div className={'day-donut' + (hov ? ' hov' : '')}>
        <svg viewBox="0 0 84 84">
          <circle className="dd-track" cx="42" cy="42" r={r} fill="none" strokeWidth="9.5" />
          {draw.map((s) => {
            const seg = (s.v / total) * c
            const len = Math.max(1, seg - GAP)
            const off = -(acc + GAP / 2)
            acc += seg
            return (
              <circle
                key={s.key}
                className={'dd-seg' + (hov === s.key ? ' on' : '')}
                cx="42" cy="42" r={r} fill="none" stroke={s.color} strokeWidth="9.5" strokeLinecap="round"
                strokeDasharray={`${len.toFixed(2)} ${(c - len).toFixed(2)}`} strokeDashoffset={off.toFixed(2)}
                transform="rotate(-90 42 42)"
                style={{ ['--seg' as string]: s.color }}
                onPointerEnter={() => setHov(s.key)}
              />
            )
          })}
        </svg>
        <div className="day-donut-c" style={{ ['--seg' as string]: active.color }}>
          <b className={'tnum' + (hov ? ' on' : '')}>{pct}<i>%</i></b>
          <span className={hov ? 'on' : ''}>{active.label}</span>
        </div>
      </div>
      <div className="day-rows">
        {segs.map((s) => (
          <div
            key={s.key}
            className={'day-row' + (hov === s.key ? ' on' : '')}
            style={{ ['--seg' as string]: s.color }}
            onPointerEnter={() => setHov(s.key)}
          >
            <span className="lbl"><i className={s.icon} />{s.label}</span>
            <b className="amt tnum">{eur(s.v)} €</b>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Caja() {
  const root = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const negRef = useRef<HTMLSpanElement>(null) // número GIGANTE = facturación del negocio
  const islandRef = useRef<HTMLDivElement>(null)
  const islandTxt = useRef<HTMLSpanElement>(null)
  const balanceRef = useRef<HTMLDivElement>(null)

  const [descuadre, setDescuadre] = useState(false)
  const [shine, setShine] = useState(false)

  // ── Navegación por FECHA: el cierre de cualquier día (no solo hoy) ──
  const [fecha, setFecha] = useState<Date>(() => new Date(HOY))
  const dia = useMemo(() => cierreDia(fecha), [fecha])
  const esHoy = esMismoDia(fecha, HOY)
  // FUENTE ÚNICA del dinero de HOY: el wallet real (= "Hoy" cabecera = "Ventas hoy" TPV). El desglose
  // simulado (turnos/franjas/efectivo·tarjeta/medio) se ESCALA al total real (factor kDia) → toda la sección
  // Caja CUADRA con el wallet y nunca diverge. Días PASADOS siguen con el cierre simulado intacto. (Juan, revisor)
  const hoyTotal = useCajaDelDia()
  const totalDia = esHoy ? hoyTotal : dia.total
  // Número GIGANTE del hero = CAJA DEL DÍA (lo que importa en esta vista; la facturación del mes no pinta aquí — Juan 27-jun).
  const heroNum = esHoy ? eur(totalDia) : eur0(totalDia)
  const kDia = esHoy && dia.total > 0 ? hoyTotal / dia.total : 1
  const sc = (v: number) => Math.round(v * kDia * 100) / 100
  const scTurn = (t: Turn): Turn => ({ efectivo: sc(t.efectivo), tarjeta: sc(t.tarjeta), domicilio: sc(t.domicilio) })
  const manana = esHoy ? scTurn(dia.manana) : dia.manana
  const tarde = esHoy ? scTurn(dia.tarde) : dia.tarde
  const subM = esHoy ? sc(dia.subM) : dia.subM
  const subT = esHoy ? sc(dia.subT) : dia.subT
  const medioDia = esHoy && dia.tickets ? Math.round((totalDia / dia.tickets) * 100) / 100 : dia.medio
  const efectivoDia = sc(dia.manana.efectivo + dia.tarde.efectivo)
  const tarjetaDia = sc(dia.manana.tarjeta + dia.tarde.tarjeta)
  const descAmt = dia.descuadre < 0 ? dia.descuadre : -12.4
  const maxUds = Math.max(...dia.topPlatos.map((p) => p.uds), 1)

  // ── Comparar 2 días lado a lado ──
  const [cmpOn, setCmpOn] = useState(false)
  const [fechaB, setFechaB] = useState<Date>(() => addDias(HOY, -1)) // por defecto: ayer (visible en la tira y distinto)
  const diaB = useMemo(() => cierreDia(fechaB), [fechaB])
  const cmpD = totalDia - diaB.total // Δ de caja A−B (A usa el total REAL si es hoy)
  const cmpPct = diaB.total ? (cmpD / diaB.total) * 100 : 0

  // Tira de días tipo ANILLO: 9 días CENTRADOS en el día seleccionado → el activo queda nítido en el centro
  // y los extremos se difuminan (mask horizontal, técnica de --sep en eje X). Las flechas rotan ±1 día.
  const RING = 9
  // Día elegido SIEMPRE centrado; los futuros se renderizan como hueco vacío (no se ven, pero mantienen el
  // centrado) → sin días por venir pero el seleccionado en el medio (Juan, 28-jun).
  const dias = useMemo(() => Array.from({ length: RING }, (_, i) => addDias(fecha, i - (RING >> 1))), [fecha])
  function stepDia(n: number) {
    const nx = addDias(fecha, n)
    if (nx.getTime() > HOY.getTime()) return
    setFecha(nx)
    play('nav', 0.4)
  }
  function elegirDia(d: Date) {
    if (d.getTime() > HOY.getTime()) return
    if (cmpOn) {
      // en modo comparar, el clic elige el día B (el que enfrentas al principal)
      if (esMismoDia(d, fecha) || esMismoDia(d, fechaB)) return
      setFechaB(d)
      play('tap')
    } else {
      if (esMismoDia(d, fecha)) return
      setFecha(d)
      play('tap')
    }
  }
  function toggleCmp() {
    setCmpOn((v) => {
      const nx = !v
      if (nx && esMismoDia(fechaB, fecha)) setFechaB(addDias(fecha, -1))
      return nx
    })
    play('toggle', 0.5)
  }

  // Al cambiar de día, el cuadre y las barras reflejan ESE día.
  useEffect(() => {
    setDescuadre(dia.descuadre < 0)
    fillBars()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia])

  // El número GIGANTE (Caja del día) se muestra SIEMPRE con su valor final (lo renderiza el JSX, reactivo al
  // cambiar de día); aquí solo limpiamos filtro/transform por si quedó algún resto del shine.
  function rollOdo() {
    const el = negRef.current
    if (!el) return
    el.style.filter = ''
    el.style.transform = ''
  }
  function reshine() {
    setShine(false)
    requestAnimationFrame(() => setShine(true))
  }
  function fillBars() {
    root.current?.querySelectorAll<HTMLElement>('.bar span').forEach((b, i) => {
      const p = +(b.dataset.p || '0')
      if (reduceMotion()) {
        gsap.set(b, { scaleX: p })
        return
      }
      gsap.to(b, { scaleX: p, duration: 0.9, ease: 'back.out(1.4)', delay: i * 0.06 })
    })
  }

  useGSAP(
    () => {
      // Total gigante cuenta sobre la cocina viva. Los stats (Caja del día/Tickets/…) cuentan
      // solos vía <Stat>/CountValue. Sin reveal escalonado.
      rollOdo() // número gigante (Caja del día) — el valor lo pone el JSX
      fillBars()
      gsap.delayedCall(1.0, reshine)
    },
    { scope: root },
  )

  useEffect(() => {
    if (reduceMotion() || matchMedia('(pointer:coarse)').matches) return
    const cleanups: (() => void)[] = []
    root.current?.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
      // Estos paneles son GLASS (backdrop-filter) sobre el héroe de vídeo. NO se mueve la tarjeta en hover
      // (ni rotar ni levantar): al desplazarse, el cristal re-muestrea el fondo y la cocina "nada" por debajo
      // → parece que "metes el fondo" (queja de Juan, 25-jun). Solo el spotlight del cursor = luz SOBRE el
      // cristal, que no mueve el fondo.
      const mm = (e: MouseEvent) => {
        const r = el.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width - 0.5
        const py = (e.clientY - r.top) / r.height - 0.5
        el.style.setProperty('--mx', ((px + 0.5) * 100).toFixed(1) + '%')
        el.style.setProperty('--my', ((py + 0.5) * 100).toFixed(1) + '%')
      }
      el.addEventListener('mousemove', mm)
      cleanups.push(() => {
        el.removeEventListener('mousemove', mm)
      })
    })
    return () => cleanups.forEach((f) => f())
  }, [])

  // (Las unidades de cada plato se muestran SIEMPRE con su valor final, sin contador — pedido de Juan, 26-jun.)


  const warnIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5v.01" />
    </svg>
  )
  const okIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  )

  return (
    <div className={'caja' + (shine ? ' shine' : '')} ref={root}>
      {/* filtro chromatic aberration (RGB split sutil) para las cocinas */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="chroma" x="-2%" y="-2%" width="104%" height="104%">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feOffset in="r" dx="1.6" dy="0" result="ro" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
          <feOffset in="b" dx="-1.6" dy="0" result="bo" />
          <feBlend in="ro" in2="g" mode="screen" result="rg" />
          <feBlend in="rg" in2="bo" mode="screen" />
        </filter>
      </svg>

      <div className="island" ref={islandRef}>
        <span className="idot" />
        <span ref={islandTxt} />
      </div>

      <div className="wrap">
        {/* ── HERO COCINA: el local toma el foco; el total del día flota sobre la cocina viva ── */}
        <section className={'ckitchen' + (descuadre ? ' warn' : '')} ref={heroRef}>
          <div className="ck-bg" aria-hidden="true">
            {/* Fondo NEGRO limpio (sin cocina): la información manda. Vignette sutil (no plano-muerto)
                + grano. (Juan, 27-jun: "quita el vídeo de atrás y deja el fondo negro".) */}
            <div className="ck-grain" />
          </div>

          <div className="ck-content">
            {/* identidad arriba-izquierda, flotando a la altura de los botones de tema/sonido */}
            <div className="ck-ident">
              <span className="ck-flag" aria-hidden="true" />
              <div className="ck-ident-tx"><b>REBELL · Bertamiráns</b><span>A Coruña · España</span></div>
            </div>

            {/* navegador de fecha: tira de días (separados por línea fina, como el StatRow). Va DEBAJO de la identidad */}
            <div className="ck-datenav">
              <span className="ckd-spacer" aria-hidden="true" />
              <div className="ckd-nav">
              <button className="ckd-arrow" onClick={() => stepDia(-1)} aria-label="Día anterior">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
              </button>
              <div className="ckd-strip">
                {dias.map((d) => {
                  const sel = esMismoDia(d, fecha)
                  const selB = cmpOn && esMismoDia(d, fechaB)
                  const hoyD = esMismoDia(d, HOY)
                  const fut = d.getTime() > HOY.getTime()
                  // Día futuro → hueco VACÍO (mantiene el ancho para que el seleccionado quede centrado, sin mostrar fechas por venir).
                  if (fut) return <span key={d.getTime()} className="ckd-cell ckd-void" aria-hidden="true" />
                  return (
                    <button key={d.getTime()} className={'ckd-cell' + (sel ? ' on' : '') + (selB ? ' onB' : '') + (hoyD ? ' today' : '')} onClick={() => elegirDia(d)} aria-pressed={sel || selB}>
                      <span className="ckd-dow">{DOW[d.getDay()]}</span>
                      <span className="ckd-dnum tnum">{String(d.getDate()).padStart(2, '0')}</span>
                    </button>
                  )
                })}
              </div>
              <button className="ckd-arrow" onClick={() => stepDia(1)} disabled={esHoy} aria-label="Día siguiente">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              </button>
              </div>
              <button className={'ck-cmp-toggle' + (cmpOn ? ' on' : '')} onClick={toggleCmp} aria-pressed={cmpOn} title="Comparar dos días">
                <span className="cmp-ic">⚖</span>{cmpOn ? 'Comparando' : 'Comparar'}
              </button>
            </div>

            <div className="ck-center">
              <span className="ck-kick">{fmtDiaLargo(fecha, HOY)}</span>
              <div className="ck-total" data-ds="caja.heronum">
                {/* el "ghost" reserva el ANCHO final → nada se reajusta al cambiar de día */}
                <span className="odo-wrap">
                  <span className="odo-ghost" aria-hidden="true">{heroNum}</span>
                  <span className="odonum" ref={negRef}>{heroNum}</span>
                </span>
                <span className="u">€</span>
              </div>
              <div className={'ck-cuadre' + (descuadre ? ' warn' : '')} ref={balanceRef}>
                <span className="ck-cuadre-ic">{descuadre ? warnIcon : okIcon}</span>
                {descuadre ? `Descuadre ${eur(descAmt)} €` : 'Caja cuadrada'}
              </div>
              <div className="ck-cuadre-sub"><span className="cs-emo">💵</span> <b className="tnum">{eur(efectivoDia)} €</b> <span className="cs-dot">·</span> <span className="cs-emo">💳</span> <b className="tnum">{eur(tarjetaDia)} €</b></div>
            </div>

            {/* UNA línea de diseño: el MISMO componente <Stat> para todos → valor grande + unidad
                pequeña dorada + label. Imposible que se descuadre (criterio único del dashboard). */}
            <StatRow className="ck-statrow">
              <Stat value={String(dia.tickets)} label="Tickets" count={false} />
              <Stat value={eur(medioDia)} unit="€" label="Ticket medio" count={false} />
              <Stat value={(dia.deltaSemana >= 0 ? '+' : '') + dia.deltaSemana.toFixed(1)} unit="%" label="vs sem. pasada" tone={dia.deltaSemana >= 0 ? 'green' : 'gold'} count={false} />
              <Stat value="20–22" unit="h" label="Mejor franja" count={false} />
            </StatRow>

            {/* Comparativa de 2 días: cifras-héroe enfrentadas (A = principal, B = el elegido en la tira) con Δ central */}
            {cmpOn && (
              <div className="ck-compare">
                <div className="ckc-col">
                  <span className="ckc-day">{fmtDiaLargo(fecha, HOY)}</span>
                  <span className="ckc-hero tnum">{eur0(totalDia)}<i>€</i></span>
                  <span className="ckc-mini"><b className="tnum">{dia.tickets}</b> tickets · <b className="tnum">{eur(medioDia)}</b> € medio</span>
                </div>
                <div className="ckc-delta">
                  <span className={'ckc-dnum ' + (cmpD >= 0 ? 'up' : 'down')}>{cmpD >= 0 ? '▲' : '▼'} {eur0(Math.abs(cmpD))} €</span>
                  <span className={'ckc-dpct ' + (cmpD >= 0 ? 'up' : 'down')}>{(cmpPct >= 0 ? '+' : '') + cmpPct.toFixed(1)}%</span>
                  <span className="ckc-dlbl">diferencia</span>
                </div>
                <div className="ckc-col b">
                  <span className="ckc-day">{fmtDiaLargo(fechaB, HOY)}</span>
                  <span className="ckc-hero tnum">{eur0(diaB.total)}<i>€</i></span>
                  <span className="ckc-mini"><b className="tnum">{diaB.tickets}</b> tickets · <b className="tnum">{eur(diaB.medio)}</b> € medio</span>
                </div>
              </div>
            )}

            {/* Gráfica + turnos INTEGRADOS dentro de la misma página de cocina (glass), no como recuadros aparte */}
            <div className="ck-sub">
              {/* Gráfica de ventas + Caja del día LADO A LADO (ahorra espacio, todo de un vistazo).
                  En móvil se apilan. (Juan, 27-jun) */}
              <div className="ck-toprow">
              <SalesChart />
              {/* Caja del día UNIFICADA: total + métodos en números limpios (sin barras),
                  con el split Mañana/Tarde debajo. (Juan, 27-jun: "las barras sobran, unificar en 1") */}
              <div className="turno turno-day" data-tilt>
                <div className="turno-head">
                  <div className="turno-name"><span className="badge sol">€</span>Caja del día</div>
                  <div className="turno-sub">{eur(subM + subT)}<span className="cur"> €</span></div>
                </div>
                <DayBreakdown efe={manana.efectivo + tarde.efectivo} tar={manana.tarjeta + tarde.tarjeta} dom={manana.domicilio + tarde.domicilio} />
                <div className="day-split">
                  <span className="ds-seg">☀ Mañana <b className="tnum">{eur(subM)} €</b></span>
                  <span className="ds-dot">·</span>
                  <span className="ds-seg">☾ Tarde <b className="tnum">{eur(subT)} €</b></span>
                </div>
              </div>
              </div>

              {/* Balance de platos del día + alerta de stock para mañana (cruce ventas × stock) */}
              <div className="ck-extra">
                <div className="ck-panel ck-platos" data-tilt>
                  <div className="ck-panel-h"><span className="ck-panel-emo">🍔</span> Platos más vendidos <small>· {fmtDiaLargo(fecha, HOY).toLowerCase()}</small></div>
                  <div className="ck-plato-list">
                    {dia.topPlatos.map((p, i) => (
                      <div className={'ck-plato' + (i < 3 ? ' r' + (i + 1) : '')} key={p.name} style={{ ['--i' as string]: i }}>
                        <span className="ck-plato-img"><img src={p.img} alt="" loading="lazy" draggable={false} /></span>
                        <span className="ck-plato-nm">{p.name}</span>
                        <span className="ck-plato-uds tnum" data-val={p.uds}>{p.uds}</span>
                        <span className="ck-plato-bar"><i style={{ width: ((p.uds / maxUds) * 100).toFixed(1) + '%' }} /></span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ck-panel ck-stock" data-tilt>
                  <div className="ck-panel-h"><span className="ck-panel-emo">📦</span> Stock para mañana <small>· si vendes igual</small></div>
                  {dia.alertas.length ? (
                    <div className="ck-alert-list">
                      {dia.alertas.map((a, i) => (
                        <div className={'ck-alert ' + a.nivel} key={a.item} style={{ ['--i' as string]: i }}>
                          <span className="ck-alert-img"><img src={a.img} alt="" loading="lazy" draggable={false} /></span>
                          <span className="ck-alert-tx">
                            <b>{a.item} <span className="ck-alert-q">· {a.quedan} {a.unidad}</span></b>
                            <small>necesitas ~{a.necesita} {a.unidad}</small>
                          </span>
                          <span className="ck-alert-pill">{a.nivel === 'alta' ? 'Repón ya' : a.nivel === 'media' ? 'Justo' : 'Suficiente'}</span>
                          <span className="ck-alert-bar"><i style={{ width: Math.min(100, (a.quedan / a.necesita) * 100).toFixed(1) + '%' }}><span className="ck-shine" /></i></span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="ck-alert-ok"><span>✓</span> Stock suficiente para mañana</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {!esHoy && (
        <div className="actionbar">
          <div className="action-inner">
            <div className="ck-pastnote">📅 Cierre del {fmtDiaLargo(fecha, HOY).toLowerCase()} · ya cerrado</div>
          </div>
        </div>
      )}
    </div>
  )
}
