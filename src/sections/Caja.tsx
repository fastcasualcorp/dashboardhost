import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import SalesChart from '../components/SalesChart'
import { Stat, StatRow, Money } from '../components/ui'
import { play } from '../lib/sound'
import { eur, eur0, reduceMotion, HOY } from '../lib/data'
import { cierreDia, esMismoDia, fmtDiaLargo, addDias } from '../lib/cierre'
import { useCajaDelDia, walletPorMetodo } from '../lib/wallet'
import { isLive, ventasHoyCount } from '../lib/ventas'
import { isDemoMode } from '../lib/demo'

gsap.registerPlugin(useGSAP)

type Turn = { efectivo: number; tarjeta: number; domicilio: number }

// Abreviaturas de día (tira de fechas, estilo week-strip).
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/* Tarta (donut) premium + INTERACTIVA de 3 quesos (efectivo/tarjeta/domicilio): al pasar por un quesito
   (o por su fila), ESE método BRILLA y se eleva, los demás se atenúan, el centro muestra su % en su color
   y su fila se resalta. Donut y leyenda comparten el mismo estado de hover (una sola fuente). (Juan, 27-jun) */
// Iconos de método de pago (Juan, 28-jun): billete / tarjeta / casa-domicilio. Stroke = color del método.
function methodIcon(key: string) {
  const p = key === 'i-cash'
    ? <><rect x="2.5" y="6.5" width="19" height="11" rx="2" /><circle cx="12" cy="12" r="2.4" /><path d="M6 12h.01M18 12h.01" /></>
    : key === 'i-card'
    ? <><rect x="2.5" y="5.5" width="19" height="13" rx="2.2" /><path d="M2.5 10h19" /><path d="M6 14.5h4" /></>
    : <><path d="M3 11.2 12 4l9 7.2" /><path d="M5.5 9.6V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.6" /><path d="M10 20v-5h4v5" /></>
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p}</svg>
  )
}

function DayBreakdown({ efe, tar, dom }: { efe: number; tar: number; dom: number }) {
  // Opción 1 (lima + neutros): la serie dominante (Tarjeta) en lima; el resto en NEUTROS para no saturar.
  const segs = [
    { key: 'efectivo', label: 'Efectivo', v: efe, color: '#b8bdc4', icon: 'i-cash' },
    { key: 'tarjeta', label: 'Tarjeta', v: tar, color: 'var(--brand)', icon: 'i-card' },
    { key: 'domicilio', label: 'Domicilio', v: dom, color: '#5a5f67', icon: 'i-home' },
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
            <span className="lbl"><i className="m-ic" style={{ color: s.color }}>{methodIcon(s.icon)}</i>{s.label}</span>
            <b className="amt tnum"><Money value={eur(s.v)} /></b>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Caja() {
  // En REAL aún no hay datos de franjas/turnos/top platos/alertas/descuadre simulado: esos bloques vienen
  // del simulador cierreDia() y deben ocultarse o mostrar estado vacío honesto. En DEMO, todo como ahora.
  const demo = isDemoMode()
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
  // REAL (hoy): nº de tickets y efectivo/tarjeta salen de las ventas REALES, no del cierre demo escalado.
  const liveHoy = esHoy && isLive()
  const ticketsDia = liveHoy ? ventasHoyCount() : dia.tickets
  const medioDia = esHoy ? (ticketsDia ? Math.round((totalDia / ticketsDia) * 100) / 100 : 0) : dia.medio
  const efectivoDia = liveHoy ? walletPorMetodo('efectivo') : sc(dia.manana.efectivo + dia.tarde.efectivo)
  const tarjetaDia = liveHoy ? walletPorMetodo('tarjeta') : sc(dia.manana.tarjeta + dia.tarde.tarjeta)
  const descAmt = dia.descuadre < 0 ? dia.descuadre : -12.4
  const maxUds = Math.max(...dia.topPlatos.map((p) => p.uds), 1)

  // ── Comparar 2 días: eliges AMBAS fechas en la tira; los paneles aparecen REACTIVOS (Juan 28-jun) ──
  // pongo la 1ª → aparece el panel A · pongo la 2ª → aparece el panel B y enfrenta los números.
  const [cmpOn, setCmpOn] = useState(false)
  const [cmpA, setCmpA] = useState<Date | null>(null)
  const [cmpB, setCmpB] = useState<Date | null>(null)
  // Datos de un día (total REAL si es hoy vía wallet; cierre simulado si es pasado) para el enfrentamiento.
  const datoDia = (f: Date) => {
    const d = cierreDia(f)
    const esHoyF = esMismoDia(f, HOY)
    const tot = esHoyF ? hoyTotal : d.total
    const medio = esHoyF && d.tickets ? Math.round((tot / d.tickets) * 100) / 100 : d.medio
    return { fecha: f, total: tot, tickets: d.tickets, medio }
  }
  const datA = cmpA ? datoDia(cmpA) : null
  const datB = cmpB ? datoDia(cmpB) : null

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
      // Modo comparar: el clic elige las DOS fechas a enfrentar (1ª → panel A, 2ª → panel B).
      const sameA = cmpA && esMismoDia(d, cmpA)
      const sameB = cmpB && esMismoDia(d, cmpB)
      if (sameA) { setCmpA(cmpB); setCmpB(null); play('tap'); return } // re-clic en A → la quita (B pasa a A)
      if (sameB) { setCmpB(null); play('tap'); return }                // re-clic en B → la quita
      if (!cmpA) { setCmpA(d); play('tap') }                           // 1ª fecha → aparece panel A
      else if (!cmpB) { setCmpB(d); play('toggle', 0.5) }              // 2ª fecha → aparece panel B + enfrentamiento
      else { setCmpA(cmpB); setCmpB(d); play('tap') }                  // ambos llenos → rota (compara las 2 últimas)
      return
    }
    if (esMismoDia(d, fecha)) return
    setFecha(d)
    play('tap')
  }
  function toggleCmp() {
    setCmpOn((v) => {
      const nx = !v
      if (!nx) { setCmpA(null); setCmpB(null) } // al apagar, limpia las dos
      return nx
    })
    play('toggle', 0.5)
  }

  // Al cambiar de día, el cuadre y las barras reflejan ESE día.
  // REAL: el descuadre viene del simulador → no lo mostramos (no hay arqueo real todavía).
  useEffect(() => {
    setDescuadre(demo && dia.descuadre < 0)
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
            {/* La identidad del local (bandera + nombre) ahora vive SIEMPRE en la cabecera (Shell), visible en
                todas las pestañas → aquí ya no se repite. */}

            {/* navegador de fecha: tira de días (separados por línea fina, como el StatRow) */}
            <div className="ck-datenav">
              <span className="ckd-spacer" aria-hidden="true" />
              <div className="ckd-nav">
              <button className="ckd-arrow" onClick={() => stepDia(-1)} aria-label="Día anterior">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
              </button>
              <div className="ckd-strip">
                {dias.map((d) => {
                  // Sin comparar: marca el día activo (oro). Comparando: marca la 1ª (oro) y la 2ª (violeta).
                  const selA = cmpOn ? !!(cmpA && esMismoDia(d, cmpA)) : esMismoDia(d, fecha)
                  const selB = cmpOn && !!(cmpB && esMismoDia(d, cmpB))
                  const hoyD = esMismoDia(d, HOY)
                  const fut = d.getTime() > HOY.getTime()
                  // Día futuro → hueco VACÍO (mantiene el ancho para que el seleccionado quede centrado, sin mostrar fechas por venir).
                  if (fut) return <span key={d.getTime()} className="ckd-cell ckd-void" aria-hidden="true" />
                  return (
                    <button key={d.getTime()} className={'ckd-cell' + (selA ? ' on' : '') + (selB ? ' onB' : '') + (hoyD ? ' today' : '')} onClick={() => elegirDia(d)} aria-pressed={selA || selB}>
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

            {/* COCKPIT (Juan, 28-jun): UN SOLO rectángulo con los 4 datos clave, equidistantes y alineados
                (el mismo <Stat> para todos → imposible descuadrar). El total de HOY es el primero, en lima. */}
            <StatRow className="ck-statrow ck-statrow-top">
              <Stat value={heroNum} unit="€" label="Caja hoy" count={false} className="rs-hoy" />
              <Stat value={demo || liveHoy ? String(ticketsDia) : '—'} label="Tickets" count={false} />
              <Stat value={demo || liveHoy ? eur(medioDia) : '—'} unit={demo || liveHoy ? '€' : ''} label="Ticket medio" count={false} />
              {demo && (
                <Stat value="20–22" unit="h" label="Mejor franja" count={false} />
              )}
            </StatRow>
            {/* Caja cuadrada → barra ANCHA y discreta debajo (Juan, 28-jun): es importante pero no debe gritar. */}
            <div className={'ck-cuadre-bar' + (descuadre ? ' warn' : '')} ref={balanceRef}>
              <span className="ck-cuadre-ic">{descuadre ? warnIcon : okIcon}</span>
              <b>{descuadre ? `Descuadre ${eur(descAmt)} €` : 'Caja cuadrada'}</b>
              <span className="ccb-sub">{descuadre ? 'El efectivo contado no cuadra con lo esperado' : 'El efectivo contado cuadra con lo esperado'}</span>
            </div>

            {/* Comparativa de 2 días: eliges AMBAS fechas en la tira; los paneles aparecen REACTIVOS y se enfrentan
                las cifras (Caja/Tickets/Ticket medio) con flechas ▲▼ verdes/rojas y el % de diferencia. (Juan 28-jun) */}
            {cmpOn && (
              <div className="ck-compare">
                {/* Panel A (1ª fecha) */}
                {datA ? (
                  <div className="ckc-col" key={'A' + datA.fecha.getTime()}>
                    <span className="ckc-tag">1ª fecha</span>
                    <span className="ckc-day">{fmtDiaLargo(datA.fecha, HOY)}</span>
                    <span className="ckc-hero tnum">{eur0(datA.total)}<i>€</i></span>
                    <span className="ckc-mini"><b className="tnum">{datA.tickets}</b> tickets · <b className="tnum">{eur(datA.medio)}</b> € medio</span>
                  </div>
                ) : (
                  <div className="ckc-slot"><span className="ckc-slot-n">1</span><span className="ckc-slot-t">Elige la 1ª fecha en la tira</span></div>
                )}

                {/* Centro: enfrentamiento por métrica (B vs A) con flechas ▲▼ y % */}
                {datA && datB ? (
                  <div className="ckc-deltas" key={'D' + datA.fecha.getTime() + datB.fecha.getTime()}>
                    {[
                      { lbl: 'Caja', a: datA.total, b: datB.total },
                      { lbl: 'Tickets', a: datA.tickets, b: datB.tickets },
                      { lbl: 'Ticket medio', a: datA.medio, b: datB.medio },
                    ].map((r) => {
                      const diff = r.b - r.a
                      const pct = r.a ? (diff / r.a) * 100 : 0
                      const up = diff >= 0
                      return (
                        <div className="ckc-drow" key={r.lbl}>
                          <span className="ckc-dlbl2">{r.lbl}</span>
                          <span className={'ckc-dpct ' + (up ? 'up' : 'down')}>{up ? '▲' : '▼'} {(pct >= 0 ? '+' : '') + pct.toFixed(1)}%</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="ckc-vs" aria-hidden="true">⚖</div>
                )}

                {/* Panel B (2ª fecha) */}
                {datB ? (
                  <div className="ckc-col b" key={'B' + datB.fecha.getTime()}>
                    <span className="ckc-tag">2ª fecha</span>
                    <span className="ckc-day">{fmtDiaLargo(datB.fecha, HOY)}</span>
                    <span className="ckc-hero tnum">{eur0(datB.total)}<i>€</i></span>
                    <span className="ckc-mini"><b className="tnum">{datB.tickets}</b> tickets · <b className="tnum">{eur(datB.medio)}</b> € medio</span>
                  </div>
                ) : (
                  <div className="ckc-slot"><span className="ckc-slot-n">2</span><span className="ckc-slot-t">Elige la 2ª fecha en la tira</span></div>
                )}
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
                  {/* Sin repetir el total (ya está arriba en "Caja hoy"): este panel es el DESGLOSE por método,
                      no otra vez la cifra. Juan, 29-jun: "tenemos repetido caja". */}
                  <div className="turno-name"><span className="badge sol">€</span>Caja del día <small className="turno-tag">por método</small></div>
                </div>
                {/* El desglose por método y el split Mañana/Tarde vienen del simulador (no hay franjas reales
                    todavía) → en REAL, estado vacío honesto. */}
                {demo ? (
                  <>
                    <DayBreakdown efe={efectivoDia} tar={tarjetaDia} dom={manana.domicilio + tarde.domicilio} />
                    <div className="day-split">
                      <span className="ds-seg">☀ Mañana <Money value={eur(subM)} tone="ink" /></span>
                      <span className="ds-dot">·</span>
                      <span className="ds-seg">☾ Tarde <Money value={eur(subT)} tone="ink" /></span>
                    </div>
                  </>
                ) : (
                  <div className="vtpv-empty">Sin desglose por franja todavía</div>
                )}
              </div>
              </div>

              {/* Platos más vendidos de HOY, a ancho completo. (Stock para mañana se movió a su propia
                  pestaña "Preparar mañana" — Caja diaria = solo dinero/ventas de hoy. Juan, 28-jun) */}
              <div className="ck-extra ck-extra-1">
                <div className="ck-panel ck-platos" data-tilt>
                  <div className="ck-panel-h"><span className="ck-panel-emo">🍔</span> Platos más vendidos <small>· {fmtDiaLargo(fecha, HOY).toLowerCase()}</small></div>
                  {/* Top platos viene del simulador → en REAL, estado vacío honesto (sin ranking real todavía). */}
                  {demo ? (
                    <div className="ck-plato-list">
                      {dia.topPlatos.slice(0, 5).map((p, i) => (
                        <div className={'ck-plato' + (i < 3 ? ' r' + (i + 1) : '')} key={p.name} style={{ ['--i' as string]: i }}>
                          <span className="ck-plato-img"><img src={p.img} alt="" loading="lazy" draggable={false} /></span>
                          <span className="ck-plato-nm">{p.name}</span>
                          <span className="ck-plato-bar"><i style={{ width: ((p.uds / maxUds) * 100).toFixed(1) + '%' }} /></span>
                          <span className="ck-plato-uds tnum" data-val={p.uds}>{p.uds}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="vtpv-empty">Aún sin ventas para rankear platos</div>
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
