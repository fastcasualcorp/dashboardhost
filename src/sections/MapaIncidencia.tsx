import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { gsap } from 'gsap'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { CountValue } from '../components/ui'
import { play, playBeast, playLock, playTick, playSweep, playGlitch, setCountMuted } from '../lib/sound'
import { reduceMotion } from '../lib/data'
import { usePower } from '../lib/power'
import { fetchRivalsCached, type PlaceReview, type PlaceRival } from '../lib/places'
import { LOCAL } from '../lib/local'

/* Mapa de Incidencia — rastrea la competencia en un mapa 3D estilo videojuego (Mapbox GL:
   edificios extruidos y EXAGERADOS, vista inclinada, atmósfera, vuelo cinematográfico, sin
   nombres de lugares), con radio configurable, marcadores-carta por rival y un "Radar IA".
   v1 con datos de DEMO; con Google Places + Edge Function serán reales. Diseño REBELL
   (oro sobre casi-negro). Token público en VITE_MAPBOX_TOKEN.
   La ubicación del local sale de `lib/local` (fuente única) → ya NO está hardcodeada (multi-tenant). */

type Signal = { k: 'reseña' | 'promo' | 'noticia' | 'social'; txt: string }
type Rival = { id: string; name: string; tipo: string; lat: number; lng: number; rating: number; reviews: number; precio: number; signal: Signal; reviewsList?: PlaceReview[] }

// Datos de DEMO (cuando el proxy /api/places no responde: dev local sin functions, o sin red).
const DEMO_RIVALES: Rival[] = [
  { id: 'r1', name: 'Malasogra Burger', tipo: 'Hamburguesería', lat: 42.8586, lng: -8.6496, rating: 4.3, reviews: 358, precio: 12.0, signal: { k: 'reseña', txt: 'Nueva reseña 5★: «las mejores patatas de la zona»' } },
  { id: 'r2', name: 'Petiscos Gastrobar', tipo: 'Hamburguesería', lat: 42.8568, lng: -8.6588, rating: 4.4, reviews: 1213, precio: 13.0, signal: { k: 'promo', txt: 'Lanzaron menú a 8,90 € (Instagram)' } },
  { id: 'r3', name: 'Milongas Parrillada', tipo: 'Parrillada', lat: 42.8595, lng: -8.6535, rating: 4.7, reviews: 6456, precio: 18.0, signal: { k: 'noticia', txt: 'La más valorada de la zona (6.456 reseñas)' } },
  { id: 'r4', name: 'Tropic Bertamiráns', tipo: 'Restaurante', lat: 42.8560, lng: -8.6560, rating: 4.5, reviews: 3094, precio: 15.0, signal: { k: 'reseña', txt: '2 reseñas negativas esta semana' } },
  { id: 'r5', name: 'Mama Istambul Kebap', tipo: 'Kebab', lat: 42.8582, lng: -8.6600, rating: 4.1, reviews: 420, precio: 8.0, signal: { k: 'social', txt: 'Vídeo viral en TikTok (12k visualizaciones)' } },
  // rivales más LEJANOS (1,8–4,4 km) → aparecen al ampliar el radio del slider (pueblos vecinos)
  { id: 'r6', name: 'Milladoiro Grill', tipo: 'Hamburguesería', lat: 42.873824, lng: -8.657097, rating: 4.2, reviews: 612, precio: 12.5, signal: { k: 'promo', txt: '2x1 en burgers los martes (cartel)' } },
  { id: 'r7', name: 'Asador O Cruceiro', tipo: 'Asador', lat: 42.8576544, lng: -8.624011, rating: 4.6, reviews: 2890, precio: 19.0, signal: { k: 'noticia', txt: 'Reseñado en La Voz de Galicia' } },
  { id: 'r8', name: 'Pizzería Bella Napoli', tipo: 'Pizzería', lat: 42.835422, lng: -8.687425, rating: 4.0, reviews: 540, precio: 11.0, signal: { k: 'social', txt: 'Sorteo en Instagram esta semana' } },
  { id: 'r9', name: 'Brión BBQ House', tipo: 'Barbacoa', lat: 42.885603, lng: -8.618971, rating: 4.5, reviews: 1740, precio: 16.5, signal: { k: 'reseña', txt: 'Suben fotos de costillas a diario' } },
]
// Lista ACTIVA de rivales (mutable): arranca con la demo y se sustituye por los REALES de Google Places.
let RIVALES: Rival[] = DEMO_RIVALES
let rivalsFetched = false // ya pedimos los reales a Places → al reconstruir el mapa (cambio de tema) NO repetir la llamada

// Reseñas de DEMO de las plataformas de reparto (Glovo/Uber/Just Eat NO exponen API de reseñas → se
// muestran como muestra realista, con su etiqueta de origen. Las de Google sí son reales vía Places).
const DELIVERY_POOL: Omit<PlaceReview, 'rating'>[] = [
  { author: 'Pedido Glovo', text: 'Llegó caliente y rápido, repetiré.', when: 'hace 3 días', source: 'Glovo' },
  { author: 'Cliente Uber Eats', text: 'Buena ración pero la patata fría.', when: 'hace 1 semana', source: 'Uber Eats' },
  { author: 'Usuario Just Eat', text: 'Relación calidad-precio muy buena.', when: 'hace 5 días', source: 'Just Eat' },
  { author: 'Cliente Uber Eats', text: 'La mejor smash de la zona, sin duda.', when: 'ayer', source: 'Uber Eats' },
  { author: 'Pedido Glovo', text: 'Tardó algo en hora punta, pero rico.', when: 'hace 2 días', source: 'Glovo' },
  { author: 'Usuario Just Eat', text: 'Packaging cuidado, todo bien sellado.', when: 'hace 4 días', source: 'Just Eat' },
]
// genera reseñas de reparto deterministas por rival (sin Math.random → no saltan entre renders)
function deliveryReviews(rivalId: string): PlaceReview[] {
  let h = 0
  for (let i = 0; i < rivalId.length; i++) h = (h * 31 + rivalId.charCodeAt(i)) >>> 0
  const n = DELIVERY_POOL.length
  const i1 = h % n
  const i2 = (i1 + 1 + ((h >> 3) % (n - 1))) % n // SIEMPRE distinto de i1 → dos plataformas/textos diferentes
  const stars = [4, 5, 3, 4, 5]
  return [
    { ...DELIVERY_POOL[i1], rating: stars[h % stars.length] },
    { ...DELIVERY_POOL[i2], rating: stars[(h >> 2) % stars.length] },
  ]
}
// Mapea un rival REAL de Places → nuestro tipo Rival (sintetiza la "señal" a partir de los datos reales).
function toRival(p: PlaceRival): Rival {
  const rating = typeof p.rating === 'number' ? p.rating : 0
  const rv = p.googleReviews?.[0]
  const signal: Signal = rv && rv.text
    ? { k: 'reseña', txt: `${rv.rating ?? rating}★: «${rv.text.slice(0, 70)}${rv.text.length > 70 ? '…' : ''}»` }
    : rating > 0
      ? { k: 'noticia', txt: `${p.reviews} reseñas en Google · ${rating.toFixed(1)}★` }
      : { k: 'noticia', txt: 'Local nuevo · aún sin valoración' }
  return { id: p.id, name: p.name, tipo: p.tipo, lat: p.lat, lng: p.lng, rating, reviews: p.reviews, precio: p.precio, signal, reviewsList: p.googleReviews }
}

// Universo de categorías para detectar "tu hueco en la zona" (qué falta en el radio).
const CATEGORIAS = ['Smash burger premium', 'Pizzería', 'Kebab', 'Sushi / Poke', 'Tacos / Mexicano', 'Pollo frito', 'Healthy / Bowls', 'Heladería artesana']
const ALIAS: Record<string, string> = { Hamburguesería: 'Smash burger premium', 'Fast food': 'Smash burger premium' }

const SIG_LABEL: Record<Signal['k'], string> = { reseña: 'Reseña', promo: 'Promo', noticia: 'Noticia', social: 'Redes' }

// origen de la reseña → clase del badge (color por plataforma). Tolerante a source vacío (no peta).
function srcClass(source?: string) {
  const s = (source || '').toLowerCase()
  if (s.includes('glovo')) return 'src-glovo'
  if (s.includes('uber')) return 'src-uber'
  if (s.includes('just')) return 'src-justeat'
  return 'src-google'
}

// Token público de Mapbox (pk...). Es seguro en el cliente; conviene restringirlo por URL.
const MAPBOX_TOKEN = (import.meta.env as Record<string, string | undefined>).VITE_MAPBOX_TOKEN || ''
if (MAPBOX_TOKEN) mapboxgl.accessToken = MAPBOX_TOKEN
// VISTA del mapa: VECTOR oscuro "Watch Dogs" (por defecto) o SATÉLITE 3D cinemático (foto aérea + relieve real),
// conmutable con un botón (Juan 25-jun). El estilo base también cambia con el TEMA (claro/oscuro). Al cambiar vista o
// tema el mapa se reconstruye (effect dep) — `builtOnceRef` evita repetir la intro de vuelo.
const styleFor = (light: boolean, sat: boolean) => (sat ? 'mapbox://styles/mapbox/satellite-streets-v12' : light ? 'mapbox://styles/mapbox/light-v11' : 'mapbox://styles/mapbox/dark-v11')

// Escapa datos de terceros (nombres de Google) antes de meterlos en innerHTML → sin XSS (regla de oro).
function escapeHTML(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function distM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000
  const toR = (d: number) => (d * Math.PI) / 180
  const dLat = toR(bLat - aLat)
  const dLng = toR(bLng - aLng)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)

// Polígono de círculo (en grados) para pintar el radio como capa GeoJSON.
function circlePolygon(lat: number, lng: number, radiusM: number, points = 84) {
  const dLat = radiusM / 111320
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180))
  const coords: [number, number][] = []
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * 2 * Math.PI
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return { type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [coords] }, properties: {} }
}
// zoom continuo según el radio (slider): a más radio, más alejado.
const zoomFor = (m: number) => 16.4 - Math.log2(Math.max(300, m) / 500) * 0.92

// Escala de las tarjetas-comparador según el zoom: PEGADAS al suelo → al alejar se encogen (para ver
// varias a la vez), tope 1 al acercar (no se hinchan) y mínimo 0.22 para que quepan muchas.

// Color base de los edificios 3D (gradiente por altura). Se guarda aparte para poder RESTAURARLO
// tras el flash "ojo de halcón" (que los enciende en oro un instante al aterrizar).
// Oscuro = subido de tono (Juan: "sigue demasiado oscuro"); claro = grises luminosos para el modo día.
const BUILDING_DARK = ['interpolate', ['linear'], ['coalesce', ['get', 'height'], 6], 0, '#222230', 12, '#30303e', 45, '#3c3a30', 110, '#48422c'] as const
const BUILDING_LIGHT = ['interpolate', ['linear'], ['coalesce', ['get', 'height'], 6], 0, '#dadce6', 12, '#cacdd8', 45, '#bfbfca', 110, '#b4b2be'] as const
// Edificios extruidos SOBRE el satélite (Juan 25-jun: "en satélite quedan planos, feos" → volumen real estilo
// Google Earth). Tono hormigón/tejado cálido-neutro que se asienta sobre la foto graduada (oscura, desaturada) sin
// parecer cartón; el vertical-gradient oscurece la base y la luz cálida de escena enciende la arista superior.
const BUILDING_SAT = ['interpolate', ['linear'], ['coalesce', ['get', 'height'], 6], 0, '#6c675a', 12, '#807a69', 45, '#948b75', 110, '#a69b82'] as const

// ── Vegetación sintética RETIRADA (Juan 25-jun: "cuadrados verdes que no sé qué son") ──
// Quitada la arboleda 3D generada (treeGrove/polyAt/mulberry32) y los parches verdes de landcover/landuse:
// confundían y rompían el look "ciudad oscura Watch Dogs". Mandan los edificios 3D oscuros + el HUD dorado.

// Líneas local→rival SOLO para los que caen dentro del radio (coherente con el slider).
function linksFor(radioM: number) {
  return {
    type: 'FeatureCollection',
    features: RIVALES.filter((r) => distM(LOCAL.lat, LOCAL.lng, r.lat, r.lng) <= radioM).map((r) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[LOCAL.lng, LOCAL.lat], [r.lng, r.lat]] },
      properties: { danger: r.rating < 4 || r.signal.k === 'promo', rid: r.id },
    })),
  }
}
// Líneas local→rival en rango, desde un array de rivales YA filtrado (radio + filtro de capa).
type RivD = Rival & { d: number; threat?: number }
function linksFromRivals(rivals: RivD[]) {
  return {
    type: 'FeatureCollection',
    features: rivals.map((r) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[LOCAL.lng, LOCAL.lat], [r.lng, r.lat]] },
      properties: { danger: r.rating < 4 || r.signal.k === 'promo', rid: r.id },
    })),
  }
}
function heatGeo(rivals: RivD[]) {
  return { type: 'FeatureCollection', features: rivals.map((r) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lng, r.lat] }, properties: { w: (r.threat ?? 50) / 100 } })) }
}

export default function MapaIncidencia() {
  const { saver: powerSaver } = usePower() // Salón frío → mapa PLANO (satélite sin 3D) para ahorrar GPU/batería
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const loadedRef = useRef(false)
  const anchorRef = useRef(false) // true tras el vuelo de entrada → la rotación orbita el local
  const isoLoadedRef = useRef(false) // isócronas de reparto ya pedidas (no repetir)
  const rivalMarks = useRef<{ r: Rival; el: HTMLElement }[]>([]) // refs para mostrar/ocultar por radio
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({}) // wrapper de cada comparador (para anclarlo a su punto)
  const comparadosRef = useRef<(Rival & { d: number })[]>([]) // lista viva accesible desde el posicionador
  const positionRef = useRef<() => boolean>(() => false) // DIBUJA los comparadores (lerp + conector); devuelve si sigue animando. Lo invocan el render del mapa y el bucle de asentamiento
  const solveRef = useRef<() => void>(() => {}) // RESUELVE el anti-solape con histéresis; SOLO al abrir/cerrar carta o al pararse el mapa (NUNCA por frame → 0 temblor)
  const armRef = useRef<() => void>(() => {}) // arranca el bucle de asentamiento (rAF auto-parante)
  const nudgeRef = useRef<Record<string, { x: number; y: number }>>({}) // desplazamiento ANTI-SOLAPE animado por carta (x/y = actual, lerp hacia el offset CONGELADO del solver)
  const placeRef = useRef<{ off: Record<string, { dx: number; dy: number }> } | null>(null) // LAYOUT CONGELADO: offset (dx,dy) por carta del solver con histéresis; el dibujo SOLO lo lee → en reposo nada recalcula
  const magRef = useRef<Record<string, { disp: boolean; pulse: number }>>({}) // estado "imantado" por carta (tick + pulso del conector)
  const leadsRef = useRef<SVGSVGElement | null>(null) // capa SVG de los conectores carta→punto (líneas + nodo hexagonal)
  const cardLoopRef = useRef(0) // rAF mientras haya cartas abiertas → anclaje + separación animada
  const visRef = useRef<(Rival & { d: number; threat: number })[]>([]) // rivales visibles (radio + filtro), con amenaza
  const radioRef = useRef(1000) // radio actual accesible desde el sonar/teclado
  const kbdRef = useRef<{ focus: (n: number) => void; cycle: () => void; step: (d: number) => void }>({ focus: () => {}, cycle: () => {}, step: () => {} })
  const [radio, setRadio] = useState(1000)
  // Comparadores ABIERTOS (varios a la vez): cada uno es un marcador anclado a su rival que ESCALA con
  // el zoom (al alejar se hacen pequeños) → puedes abrir varios y verlos todos alejando la cámara.
  const [comparados, setComparados] = useState<(Rival & { d: number })[]>([])
  // CROMOS enviados al cajón lateral derecho (comparar varias tipo cartas Pokémon). Juan 25-jun.
  const [enviadas, setEnviadas] = useState<(Rival & { d: number })[]>([])
  const [flashId, setFlashId] = useState<string | null>(null) // cromo que PARPADEA (ya estaba en el cajón)
  const flashTimer = useRef(0)
  const enviarCromo = (r: Rival & { d: number }) => {
    if (enviadas.some((p) => p.id === r.id)) {
      // ya está a la derecha → que BRILLE para saber que es ESA la que intentas llevar (Juan 25-jun).
      setFlashId(null)
      window.clearTimeout(flashTimer.current)
      requestAnimationFrame(() => setFlashId(r.id)) // null→id reinicia la animación CSS aunque ya estuviera marcada
      flashTimer.current = window.setTimeout(() => setFlashId(null), 1100)
      if (!reduceMotion()) playTick(0.5)
      return
    }
    setEnviadas((prev) => (prev.some((p) => p.id === r.id) ? prev : [...prev, r].slice(-6))) // máx 6 en mano
    if (!reduceMotion()) play('pop', 0.5, 1.12)
  }
  const [clock, setClock] = useState('') // timecode en vivo del HUD
  const [armed, setArmed] = useState(false) // modo operación: el HUD se ensambla tras el vuelo
  const [hot, setHot] = useState<string | null>(null) // rival enfocado (cross-highlight mapa↔panel)
  const [filtro, setFiltro] = useState<'todos' | 'amenaza' | 'baratos' | 'cerca'>('todos') // filtro de capa
  const [capturando, setCapturando] = useState(false) // generando el PNG del informe de inteligencia
  const [heat, setHeat] = useState(false) // mapa de calor de amenaza
  const [reparto, setReparto] = useState(false) // pinta TU zona de reparto vs la de los competidores
  const [mShow, setMShow] = useState(false) // marcadores visibles (poco después de cargar → todo a la vez, sin fantasmas)
  const [mapReady, setMapReady] = useState(false) // el mapa terminó de cargar (dispara efectos)
  const [full, setFull] = useState(false) // modo pantalla completa del mapa (oculta paneles)
  const [satellite, setSatellite] = useState(false) // vista satélite 3D cinemática (vs vector oscuro Watch Dogs)
  const [booting, setBooting] = useState(() => !reduceMotion()) // intro HACKER cubriendo el mapa hasta que cargan las teselas
  const [switching, setSwitching] = useState(false) // overlay terminal "CAMBIANDO DE VISTA" durante el toggle vector↔satélite
  const [switchTo, setSwitchTo] = useState('') // etiqueta de destino del cambio (VISTA SATÉLITE / VECTOR TÁCTICO)
  const [, bumpRiv] = useState(0) // fuerza re-render del panel cuando llegan los rivales REALES
  const [realData, setRealData] = useState(false) // true cuando los rivales vienen de Google Places (no demo)
  const [isLight, setIsLight] = useState(() => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light') // tema día → mapa claro
  const builtOnceRef = useRef(false) // tras el 1er montaje: al reconstruir por cambio de tema NO repetimos el vuelo
  const fxRef = useRef<HTMLCanvasElement | null>(null) // canvas de la onda glitch de transición vector↔satélite
  const fxRun = useRef<((reveal?: boolean) => void) | null>(null) // controlador del FX (false=cae la gota+velo, true=barre y revela)
  const satFxRef = useRef(false) // la próxima reconstrucción (toggle satélite) debe revelarse con la onda glitch

  // ── FX de TRANSICIÓN vector↔satélite (Juan 25-jun): cambiar de estilo NO se corta de golpe. Cae una "gota" en el
  // centro del mapa → onda expansiva MORADA cuyo BORDE es una ola de PÍXELES glitch con glow; barre el mapa y REVELA
  // el nuevo estilo detrás. El velo oscuro TAPA la reconstrucción del mapa mientras carga (sin flash). Todo en un
  // canvas overlay (funciona en cualquier estilo, no depende de los edificios). Respeta reduced-motion (no se llama).
  useEffect(() => {
    const cvs = fxRef.current
    const ctx = cvs?.getContext('2d')
    if (!cvs || !ctx) return
    let raf = 0
    const RISE = 170, SWEEP = 900 // ms: subida del velo (RÁPIDA, tapa antes de reconstruir) / disolución del velo al revelar
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
    const st = { phase: 'idle' as 'idle' | 'rise' | 'hold' | 'sweep', t0: 0, cx: 0, cy: 0, W: 0, H: 0, dpr: 1, maxR: 0 }

    const draw = (now: number) => {
     try {
      // el timestamp de rAF puede ser ANTERIOR al performance.now() con que sellamos t0 al iniciar una fase →
      // e negativo → k<0 → easeOut(k)<0 → radios NEGATIVOS (arc lanza y congela el velo). Clamp a ≥0 lo evita.
      const e = Math.max(0, now - st.t0)
      ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0)
      ctx.clearRect(0, 0, st.W, st.H)
      ctx.globalCompositeOperation = 'source-over'

      if (st.phase === 'rise' || st.phase === 'hold') {
        const k = st.phase === 'rise' ? Math.min(1, e / RISE) : 1
        // velo oscuro violáceo que sube → 100% OPACO (antes 0.94 dejaba ver el mapa reconstruyéndose por debajo =
        // "aparece otro mapa satélite", Juan 25-jun). Opaco total tapa la reconstrucción por completo.
        ctx.fillStyle = 'rgba(9,7,18,' + easeOut(k).toFixed(3) + ')'
        ctx.fillRect(0, 0, st.W, st.H)
        if (st.phase === 'rise') {
          // GOTA QUE CAE: anillos concéntricos que estallan del centro + destello → "algo cae en el mapa".
          for (const off of [0, 0.16, 0.34]) {
            const kk = (k - off) / (1 - off)
            if (kk <= 0) continue
            const rr = easeOut(kk) * st.maxR * 0.46
            const al = (1 - kk) * 0.55
            ctx.strokeStyle = 'rgba(124,92,240,' + al.toFixed(3) + ')'
            ctx.lineWidth = 2 + (1 - kk) * 5
            ctx.beginPath(); ctx.arc(st.cx, st.cy, rr, 0, Math.PI * 2); ctx.stroke()
          }
          const fl = Math.max(0, 1 - k * 1.6)
          if (fl > 0) {
            const g = ctx.createRadialGradient(st.cx, st.cy, 0, st.cx, st.cy, 120)
            g.addColorStop(0, 'rgba(220,210,255,' + (0.85 * fl).toFixed(3) + ')')
            g.addColorStop(1, 'rgba(124,92,240,0)')
            ctx.fillStyle = g
            ctx.beginPath(); ctx.arc(st.cx, st.cy, 120, 0, Math.PI * 2); ctx.fill()
          }
        } else {
          // 'hold': el velo "respira" con un glow tenue en el centro para que no parezca congelado mientras carga.
          const pulse = 0.18 + 0.10 * Math.sin(e * 0.006)
          const g = ctx.createRadialGradient(st.cx, st.cy, 0, st.cx, st.cy, st.maxR * 0.5)
          g.addColorStop(0, 'rgba(124,92,240,' + pulse.toFixed(3) + ')')
          g.addColorStop(1, 'rgba(124,92,240,0)')
          ctx.fillStyle = g
          ctx.fillRect(0, 0, st.W, st.H)
        }
      } else if (st.phase === 'sweep') {
        // DISOLUCIÓN del velo (1→0): la onda expansiva de verdad la hace runVioletSweep recorriendo los EDIFICIOS 3D
        // (Juan 25-jun: "que la onda sea en 3D y adaptándose a los edificios, como la que ya tenemos"). Aquí solo
        // levantamos el velo con un eco morado radial que acompaña a la onda 3D sin competir con ella.
        const k = Math.min(1, e / SWEEP)
        const a = 1 - easeOut(k)
        ctx.fillStyle = 'rgba(9,7,18,' + a.toFixed(3) + ')'
        ctx.fillRect(0, 0, st.W, st.H)
        const R = easeOut(k) * st.maxR
        const ga = Math.max(0, 1 - k) * 0.34
        if (ga > 0.01) {
          const inner = Math.max(0, R - 110)
          const g = ctx.createRadialGradient(st.cx, st.cy, inner, st.cx, st.cy, R + 12)
          g.addColorStop(0, 'rgba(124,92,240,0)')
          g.addColorStop(0.72, 'rgba(124,92,240,' + ga.toFixed(3) + ')')
          g.addColorStop(1, 'rgba(196,181,253,0)')
          ctx.fillStyle = g
          ctx.fillRect(0, 0, st.W, st.H)
        }
        if (k >= 1) { st.phase = 'idle'; ctx.clearRect(0, 0, st.W, st.H); return }
      } else {
        return // idle → no re-armar rAF
      }
      raf = requestAnimationFrame(draw)
     } catch {
      // BLINDAJE: si algo lanza en un frame, NUNCA dejamos el velo congelado tapando el mapa → limpiamos y revelamos.
      try { ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); ctx.clearRect(0, 0, st.W, st.H) } catch { /* noop */ }
      st.phase = 'idle'
     }
    }

    fxRun.current = (reveal) => {
      if (reveal) {
        if (st.phase === 'idle') return // nada que revelar
        st.phase = 'sweep'; st.t0 = performance.now()
        return
      }
      // impacto: dimensiona el canvas al contenedor y arranca la "gota" + velo
      const r = cvs.getBoundingClientRect()
      st.dpr = Math.min(2, window.devicePixelRatio || 1)
      st.W = r.width; st.H = r.height
      cvs.width = Math.round(st.W * st.dpr); cvs.height = Math.round(st.H * st.dpr)
      st.cx = st.W / 2; st.cy = st.H / 2
      st.maxR = Math.hypot(st.W / 2, st.H / 2) * 1.14
      st.phase = 'rise'; st.t0 = performance.now()
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(draw)
    }
    return () => { cancelAnimationFrame(raf); fxRun.current = null }
  }, [])

  // Observa el cambio de tema (data-theme en <html>) → al cambiar, el mapa se reconstruye con el estilo correcto.
  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => setIsLight(el.dataset.theme === 'light'))
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  // SALÓN FRÍO → mapa PLANO (satélite sin edificios 3D ni inclinación) = mucho menos GPU/batería.
  // Reversible: al salir de ahorro vuelve el 3D. Aplica al togglear y también en cuanto el mapa esté listo.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      try {
        if (map.getLayer('rebell-3d-buildings')) map.setLayoutProperty('rebell-3d-buildings', 'visibility', powerSaver ? 'none' : 'visible')
      } catch { /* capa fuera */ }
      try { map.easeTo({ pitch: powerSaver ? 0 : 56, duration: 600, essential: true }) } catch { /* noop */ }
    }
    if (loadedRef.current) apply()
    else map.once('idle', apply)
  }, [powerSaver])

  // El sonido de "números cargando" no pega en el mapa. Lo muteamos SÍNCRONAMENTE en el cuerpo del componente
  // (corre antes de que monten los CountValue hijos, cuyo efecto disparaba el sonido) → al abrir el mapa NO
  // suena el counter. Pedido Juan (24-jun: "no hay ningún counter aquí"). El cleanup lo restaura al salir.
  setCountMuted(true)
  useEffect(() => () => setCountMuted(false), [])

  // Pantalla completa: marca el body (para que el menú lateral se deslice fuera) + ESC para salir.
  useEffect(() => {
    document.body.classList.toggle('map-fullscreen', full)
    // SIN TIRÓN (Juan 25-jun): Mapbox solo redibuja su canvas al llamar resize(); durante la animación de entrar/salir
    // de pantalla completa el canvas se quedaba un frame ESTIRADO y luego "saltaba". Bombeamos resize() CADA frame
    // durante ~1.1s → el canvas sigue al contenedor de forma continua y la transición es suave en ambos sentidos.
    let raf = 0
    if (mapRef.current) {
      const t0 = performance.now()
      const pump = () => {
        try { mapRef.current?.resize() } catch { /* canvas fuera */ }
        if (performance.now() - t0 < 1100) raf = requestAnimationFrame(pump)
      }
      raf = requestAnimationFrame(pump)
    }
    if (!full) {
      document.body.classList.remove('map-fullscreen')
      return () => cancelAnimationFrame(raf)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFull(false)
    }
    window.addEventListener('keydown', onEsc)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onEsc)
      document.body.classList.remove('map-fullscreen')
    }
  }, [full])

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })) // HH:MM, sin segundos
    tick()
    const iv = window.setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [])

  const abrirComparador = (r: Rival & { d: number }) => {
    const cur = comparadosRef.current // ref SIEMPRE actual (los handlers de marcadores capturan closures viejos)
    if (cur.some((p) => p.id === r.id)) { setHot(r.id); return } // ya abierta → solo enfoca
    const next = [...cur, r]
    // AUTO-CAJÓN (Juan 25-jun): en el mapa caben hasta 3; al abrir la 4ª, TODAS pasan al cajón de cromos (derecha)
    // y se ocultan del mapa (4 juntas en el mapa satura). Comparas en grande al lado, como cartas Pokémon.
    if (next.length > 3) {
      setEnviadas((prev) => {
        const merged = [...prev]
        for (const c of next) if (!merged.some((m) => m.id === c.id)) merged.push(c)
        return merged.slice(-6)
      })
      setComparados([])
      setHot(null)
      if (!reduceMotion()) { playLock(0.4); play('pop', 0.5, 1.0) }
      return
    }
    const primero = cur.length === 0 // solo ruge al abrir el PRIMERO (evita cacofonía con varios)
    setComparados(next)
    setHot(r.id) // fija objetivo → enciende su nodo y su línea
    playLock(0.45) // "tlk-tlk" de lock-on
    if (primero) playBeast('lion', 0.55) // rugido SOLO al primer enfrentamiento
    play('pop', 0.5, 1.32)
    // LOCK-ON: el nodo se "arma" (retículo)
    const mk = rivalMarks.current.find((m) => m.r.id === r.id)
    if (mk && !reduceMotion()) {
      mk.el.classList.add('locking')
      window.setTimeout(() => mk.el.classList.remove('locking'), 640)
    }
    // Centramos el rival con un paneo suave y un OFFSET hacia abajo → su marcador queda en la mitad inferior y la
    // carta (que va ENCIMA, modelo ventana) cabe holgada al abrirla. Al hacer zoom luego, se recorta por arriba.
    const map = mapRef.current
    if (map && loadedRef.current) map.easeTo({ center: [r.lng, r.lat], offset: [0, 95], duration: 550, essential: true })
  }
  // "Comparar todos": abre el comparador de TODOS los rivales visibles a la vez y AUTO-ENCUADRA la cámara
  //  (fitBounds) para verlos juntos sin solape → listo para presentación/captura. Si ya están todos abiertos, limpia.
  const compararTodos = () => {
    const vis = visRef.current
    const map = mapRef.current
    if (!vis.length) return
    // TOGGLE OFF: si ya hay algo abierto (mapa o cajón), "Limpiar" lo vacía todo.
    if (comparados.length > 0 || enviadas.length > 0) { setComparados([]); setEnviadas([]); setHot(null); play('pop', 0.4, 0.9); return }
    // Más de 3 rivales → directo al CAJÓN de cromos (el mapa no muestra más de 3). 1-3 → al mapa como antes.
    if (vis.length > 3) {
      setEnviadas(vis.slice(0, 6).map((r) => ({ ...r })))
      setHot(null)
      playLock(0.4); play('pop', 0.5, 1.12)
      return
    }
    setComparados(vis.map((r) => ({ ...r })))
    setHot(null)
    playLock(0.4)
    play('pop', 0.5, 1.12)
    if (map && loadedRef.current) {
      const bounds = new mapboxgl.LngLatBounds()
      bounds.extend([LOCAL.lng, LOCAL.lat])
      vis.forEach((r) => bounds.extend([r.lng, r.lat]))
      map.fitBounds(bounds, { padding: { top: 150, bottom: 120, left: 90, right: 90 }, maxZoom: 16, pitch: 42, duration: 950, essential: true })
    }
  }
  // Ajusta el zoom al SOLTAR el slider (durante el arrastre solo crece el círculo → fluido).
  const flyZoom = (m: number) => {
    const map = mapRef.current
    if (map && loadedRef.current) map.easeTo({ center: [LOCAL.lng, LOCAL.lat], zoom: zoomFor(m), pitch: 60, duration: 650, essential: true })
  }

  // (La carta ya no se ancla al mapa: se pinta en un DOCK fijo en el JSX → ver más abajo.)
  // Puente para abrir el comparador desde los marcadores imperativos del mapa.
  const openRef = useRef<((r: Rival) => void) | null>(null)
  openRef.current = (r) => abrirComparador({ ...r, d: distM(LOCAL.lat, LOCAL.lng, r.lat, r.lng) })

  // Inicializa el mapa 3D una vez.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    // RIVALES REALES de Google Places (vía proxy /api/places). Se pide en paralelo a la carga del mapa;
    // si tarda >2,2s o falla (dev local sin functions), se usan los de DEMO. Radio amplio para cubrir el slider.
    const rivalsPromise: Promise<PlaceRival[] | null> = rivalsFetched
      ? Promise.resolve(null) // ya tenemos los reales en RIVALES (módulo) → reconstrucción por tema sin re-llamar a Places
      : Promise.race<PlaceRival[] | null>([
          fetchRivalsCached(LOCAL.lat, LOCAL.lng, 5000), // caché 12h: 1ª vez busca en Places, luego instantáneo y gratis
          new Promise<null>((res) => window.setTimeout(() => res(null), 2200)),
        ])
    const map = new mapboxgl.Map({
      container: elRef.current,
      style: styleFor(isLight, satellite),
      center: [LOCAL.lng, LOCAL.lat],
      // arranca YA a pie de ciudad, con TODOS los edificios bien visibles (Juan 25-jun: "que no empiece tan
      // arriba, desde donde se ven ya los edificios todos"). 14 está muy dentro del minzoom 12 → el vuelo es un
      // descenso CORTO y cercano (14→~15.5) que se asienta inclinándose, no una caída desde lo alto y pelado.
      zoom: reduceMotion() ? zoomFor(1000) : 14,
      pitch: reduceMotion() ? 60 : 42,
      bearing: reduceMotion() ? -17 : 26,
      attributionControl: false,
      maxPitch: 75,
      antialias: true,
      // preserveDrawingBuffer FUERA (Juan 25-jun): tenerlo siempre ON impedía a la GPU descartar el buffer
      // cada frame = peaje de calor constante. La "Captura inteligente" ahora lee el canvas DENTRO del frame
      // de render (ver grabMapCanvas en capturarInteligencia) → ya no hace falta.
      // OPTIMIZACIÓN + foco: el radio llega a 5 km → acotamos la cámara a una caja de ~10 km alrededor
      // del local. No se puede pasear lejos = no carga más mapa del necesario (menos tiles). Pedido Juan.
      maxBounds: [
        [LOCAL.lng - 0.135, LOCAL.lat - 0.09],
        [LOCAL.lng + 0.135, LOCAL.lat + 0.09],
      ],
      // Las huellas EXTRUIDAS del tileset (composite/building) solo se vuelven densas sobre z≈14 (a 13 son escasas) →
      // por debajo los edificios 3D se veían pelados y "desaparecían" al alejar (Juan 25-jun: "tienen que verse SIEMPRE").
      // Acotamos el zoom-out a 14.3 → a esa altura las huellas 3D ya son densas Y la cámara conserva la inclinación
      // cinemática (Mapbox APLANA el pitch por debajo) → SIEMPRE se ven edificios 3D, nunca el mapa pelado. Coste: con
      // radio 2-5 km el encuadre queda un pelín más cerca (el anillo se sale un poco del recuadro, ya contemplado).
      minZoom: 14.3,
      maxZoom: 20, // antes 17.6 → capaba la carta a 2× ("bloqueada, nunca se escondía"); ahora puedes ACERCARTE más y
      //              la ficha crece y se ATRAVIESA (se esfuma) → ves el mapa debajo. Pedido de Juan 25-jun.
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    // GLITCH MAPA: suena nada más ENTRAR (acompaña la intro hacker), solo en la entrada cinematográfica (no en
    // reconstrucciones por tema/satélite). El boom va aparte, al arrancar la onda expansiva. (Juan 25-jun)
    if (!reduceMotion() && !builtOnceRef.current) playGlitch(0.32)

    // Más SUAVE y controlado (Juan: "al estar concentrados en la zona no tiene sentido que vaya rápido"):
    // el zoom de rueda va MÁS LENTO, y la cámara ORBITA siempre alrededor del local (ancla) al rotar →
    // deja de irse "demasiado libre". El pivote se fija al empezar cada rotación.
    map.scrollZoom.setZoomRate(1 / 130)
    map.scrollZoom.setWheelZoomRate(1 / 620)
    // Anclaje al local SIN congelar el gesto: no tocamos la cámara MIENTRAS se rota (eso congelaba la
    // rotación); al SOLTAR, si la vista se alejó del local, vuelve a centrarse en él con un ease suave →
    // se siente "orbita tu local" pero la rotación responde 100%. Pedido de Juan (24-jun).
    // ROTACIÓN PROPIA, MUY LENTA (Juan 24-jun: "bájale muchísimo más la velocidad, muchísimo más"): el
    // dragRotate de Mapbox iba demasiado rápido y no es configurable → lo desactivo y muevo bearing/pitch a
    // mano con sensibilidad mínima. Sin inercia → control total, sin tirón. Botón derecho = orbitar/inclinar.
    map.dragRotate.disable()
    const ROT_SENS = 0.085 // grados de giro por píxel arrastrado (default Mapbox ~0.4 → esto es MUY lento)
    const PITCH_SENS = 0.10 // grados de inclinación por píxel
    const cc = map.getCanvasContainer()
    let rotating = false, sx = 0, sy = 0, sBear = 0, sPitch = 0
    const onRotDown = (e: PointerEvent) => {
      if (e.button !== 2) return // solo botón DERECHO
      rotating = true; sx = e.clientX; sy = e.clientY; sBear = map.getBearing(); sPitch = map.getPitch()
      cc.style.cursor = 'grabbing'
      e.preventDefault()
    }
    const onRotMove = (e: PointerEvent) => {
      if (!rotating) return
      map.setBearing(sBear + (e.clientX - sx) * ROT_SENS)
      // vertical invertido (Juan 25-jun): arrastrar ARRIBA debe inclinar arriba → signo negativo en el pitch
      map.setPitch(Math.max(0, Math.min(75, sPitch - (e.clientY - sy) * PITCH_SENS)))
    }
    const onRotUp = () => { if (rotating) { rotating = false; cc.style.cursor = '' } }
    const onCtx = (e: Event) => e.preventDefault() // sin menú contextual al rotar con derecho
    cc.addEventListener('pointerdown', onRotDown)
    window.addEventListener('pointermove', onRotMove)
    window.addEventListener('pointerup', onRotUp)
    cc.addEventListener('contextmenu', onCtx)

    // ZOOM con la rueda AUNQUE el ratón esté sobre una carta-comparador (Juan 25-jun: "dentro de una card no me
    // funciona el zoom"). Las cartas tienen pointer-events:auto y se comían el wheel (scroll del propio body). Lo
    // INTERCEPTAMOS en captura sobre el contenedor del mapa y lo REENVIAMOS al canvas → Mapbox hace zoom con su
    // rate ya afinado. El evento sintético tiene como target el canvas (no una carta) → no se vuelve a reenviar.
    const mapBox = elRef.current?.parentElement // .mapa-3d (contiene el canvas y la capa de cartas)
    const onCardWheel = (e: WheelEvent) => {
      const t = e.target as Element | null
      if (t && typeof t.closest === 'function' && t.closest('.cmp-anchor')) {
        e.preventDefault()
        map.getCanvasContainer().dispatchEvent(
          new WheelEvent('wheel', { deltaY: e.deltaY, deltaX: e.deltaX, deltaMode: e.deltaMode, clientX: e.clientX, clientY: e.clientY, bubbles: true, cancelable: true }),
        )
      }
    }
    mapBox?.addEventListener('wheel', onCardWheel, { passive: false, capture: true })

    // ANCLAJE EN SINCRONÍA CON LA CÁMARA: reposicionamos los comparadores en CADA frame que dibuja Mapbox
    // (map.on('render')) → durante paneo/zoom/inercia las cartas siguen el punto en el MISMO frame que el mapa,
    // sin "patinar" ni saltar (el bucle rAF propio solo desacoplaba y dejaba las cartas un frame por detrás).
    // El rAF del efecto [comparados] sigue, pero solo para animar el asentamiento/cometa cuando el mapa está QUIETO.
    const onMapRender = () => { if (comparadosRef.current.length) positionRef.current() }
    map.on('render', onMapRender)
    // Al PARARSE el mapa (fin de paneo/zoom/rotación/inercia/vuelo) re-resolvemos el anti-solape con histéresis
    // (casi siempre devuelve lo mismo) y arrancamos el asentamiento. NUNCA resolvemos por frame → imposible temblar.
    // Mientras el mapa se mueve, las cartas siguen su ancla con el offset CONGELADO (panean/zoomean con el mapa).
    const onMapSettle = () => { if (comparadosRef.current.length) { solveRef.current(); armRef.current() } }
    map.on('moveend', onMapSettle)

    // El contenedor puede crecer tras el primer paint → el canvas se quedaría pequeño/negro.
    // `dead` evita que un resize en cola (ResizeObserver o setTimeout) toque el mapa YA destruido (cambio
    // de sección o reconstrucción por tema) → mataba con "Cannot set properties of undefined (width)".
    let dead = false
    const safeResize = () => { if (!dead && mapRef.current === map) { try { map.resize() } catch { /* canvas fuera */ } } }
    const ro = new ResizeObserver(() => safeResize())
    if (elRef.current) ro.observe(elRef.current)
    let onVis: (() => void) | null = null

    map.on('load', async () => {
      loadedRef.current = true

      // Rivales REALES (si llegaron): sustituyen a la demo ANTES de construir nada (markers, fuentes,
      // análisis) → todo el mapa y el panel salen con datos reales de Google Places. Pedido Juan (24-jun).
      const real = await rivalsPromise
      if (real && real.length) {
        RIVALES = real.slice(0, 12).map(toRival)
        rivalsFetched = true
        setRealData(true)
        bumpRiv((n) => n + 1) // re-render del panel con los reales
      } else if (RIVALES !== DEMO_RIVALES) {
        setRealData(true) // reconstrucción por tema: ya teníamos los reales cargados
      }

      // ETIQUETAS: dejar SOLO nombres de POBLACIONES (ciudades/pueblos) para ubicarse — fuera barrios (subdivision),
      // calles, POIs, agua, tránsito, etc. (Juan 25-jun: "nombres de poblaciones sí, barrios no"). Las capas de
      // 'settlement' (-major/-minor-label) son los núcleos de población; 'subdivision' = barrios → se ocultan.
      const layers = map.getStyle()?.layers || []
      let firstSymbolId: string | undefined
      for (const l of layers) {
        if (l.type === 'symbol') {
          if (!firstSymbolId) firstSymbolId = l.id
          const keep = /settlement/.test(l.id) && !/subdivision/.test(l.id) // pueblos/ciudades sí; barrios no
          try {
            map.setLayoutProperty(l.id, 'visibility', keep ? 'visible' : 'none')
          } catch {
            /* alguna capa sin layout */
          }
        }
      }

      // GRADO "Watch Dogs": oscurece + desatura + contrasta la foto satélite → deja de parecer
      // Google Maps y se vuelve un mapa táctico; el oro del HUD pasa a ser el único color vivo.
      if (satellite) {
        for (const l of map.getStyle()?.layers || []) {
          if (l.type === 'raster') {
            try {
              // MÁS LUZ (Juan 25-jun: "te pasaste de oscuridad"): subimos el techo de brillo y damos piso, bajamos
              // contraste → la foto satélite se ve clara y legible sin perder el tono táctico desaturado.
              map.setPaintProperty(l.id, 'raster-saturation', -0.5)
              map.setPaintProperty(l.id, 'raster-contrast', 0.22)
              map.setPaintProperty(l.id, 'raster-brightness-max', 0.78)
              map.setPaintProperty(l.id, 'raster-brightness-min', 0.08)
            } catch {
              /* la capa raster no admite ese paint */
            }
          }
        }
        // RELIEVE 3D (Google Earth, pero estilizado): el satélite se "viste" sobre la elevación real
        // → colinas y volumen de verdad bajo la cámara inclinada. Exageración para drama de juego.
        try {
          if (!map.getSource('mapbox-dem')) {
            map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 } as never)
          }
          map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 } as never)
        } catch {
          /* el estilo no soporta terreno */
        }
      }

      // Edificios 3D — en VECTOR (sintético oscuro Watch Dogs, exagerado ×6.5 porque el pueblo es bajo) y AHORA
      // TAMBIÉN en SATÉLITE (volumen REAL estilo Google Earth; Juan 25-jun: "en satélite quedaban planos, feos").
      // Mismo footprint REAL (composite/building, que satellite-streets también trae), distinto "vestido": color y
      // exageración de altura por modo. En satélite la foto manda → altura casi real (×2) para no exagerar torres.
      try {
        const buildColor = satellite ? BUILDING_SAT : isLight ? BUILDING_LIGHT : BUILDING_DARK
        const heightMul = satellite ? 1.6 : 4.8 // Juan 25-jun: "bájale algo al tamaño" (vector 6.5→4.8, satélite 2→1.6)
        map.addLayer(
          {
            id: 'rebell-3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', ['get', 'extrude'], 'true'],
            type: 'fill-extrusion',
            minzoom: 10.5, // bajo el minZoom del mapa → la CAPA nunca capa; la visibilidad real la fija el minZoom del mapa.
            paint: {
              'fill-extrusion-color': buildColor as never,
              'fill-extrusion-height': ['*', ['coalesce', ['get', 'height'], 6], heightMul],
              'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
              // Arrancan INVISIBLES y FUNDEN (1.6s) sincronizados con la ONDA MORADA al levantar la intro (Juan 25-jun:
              // "que carguen a medida que la onda recorre el mapa, justo al terminar la intro, sin ningún segundo sin edificios").
              'fill-extrusion-opacity': 0,
              'fill-extrusion-opacity-transition': { duration: 1600, delay: 0 } as never,
              'fill-extrusion-vertical-gradient': true,
            },
          },
          firstSymbolId,
        )
      } catch {
        /* el estilo no trae la fuente composite/building */
      }

      // VEGETACIÓN SINTÉTICA RETIRADA (Juan 25-jun: "cuadrados verdes que no sé qué son"). Antes pintábamos
      // parches verdes de landcover/landuse + una arboleda 3D extruida → confundían y rompían el look "ciudad
      // oscura Watch Dogs". Fuera. El mapa base de Mapbox ya trae su verde sutil; mandan los edificios 3D oscuros.

      // Luz direccional cálida tenue → sombras coherentes en edificios Y árboles (mata el look
      // "pegatina" plano). Sin halo: es luz de escena, no box-shadow.
      try {
        // luz de escena: MÁS viva en oscuro (Juan: "sigue demasiado oscuro"); neutra y brillante en claro.
        map.setLight((isLight
          ? { anchor: 'map', color: '#ffffff', intensity: 0.6, position: [1.3, 210, 30] }
          : { anchor: 'map', color: '#fff4e0', intensity: 1.0, position: [1.3, 210, 32] }) as never) // +luz oscuro (Juan 25-jun)
      } catch {
        /* el estilo no soporta setLight */
      }

      // Atmósfera: en claro = bruma día clara; en oscuro = lo lejano se funde pero MENOS negro (más luz en la zona).
      try {
        map.setFog((isLight
          ? { range: [3.5, 19], color: '#dfe3ec', 'high-color': '#eef1f6', 'horizon-blend': 0.2, 'space-color': '#d2d8e2', 'star-intensity': 0 }
          : satellite
            ? { range: [3, 18], color: '#1d3a2c', 'high-color': '#3a5e49', 'horizon-blend': 0.12, 'space-color': '#13202a', 'star-intensity': 0.06 }
            : { range: [3.5, 20], color: '#262633', 'high-color': '#46402a', 'horizon-blend': 0.2, 'space-color': '#16161f', 'star-intensity': 0.02 }) as never) // +luz (Juan 25-jun)
      } catch {
        /* sin fog en este estilo */
      }

      // Radio: relleno + anillo glow (GeoJSON que se actualiza al cambiar).
      map.addSource('rebell-radio', { type: 'geojson', data: circlePolygon(LOCAL.lat, LOCAL.lng, radio) as never })
      map.addLayer({ id: 'rebell-radio-fill', type: 'fill', source: 'rebell-radio', paint: { 'fill-color': '#ffbf10', 'fill-opacity': 0.05 } })
      map.addLayer({ id: 'rebell-radio-line', type: 'line', source: 'rebell-radio', paint: { 'line-color': '#ffbf10', 'line-width': 1.6, 'line-opacity': 0.65, 'line-blur': 1.2 } })

      // Zonas de REPARTO (toggle "Reparto"): la TUYA en verde vs la de cada competidor en rojo → comparas
      // hasta dónde llega tu entrega frente a la suya. Radios de demo (con datos reales se afinan). Pedido Juan.
      const DELIV_ME = 2500, DELIV_RIV = 1800
      map.addSource('rebell-deliv-me', { type: 'geojson', data: circlePolygon(LOCAL.lat, LOCAL.lng, DELIV_ME) as never })
      map.addLayer({ id: 'rebell-deliv-me-fill', type: 'fill', source: 'rebell-deliv-me', layout: { visibility: 'none' }, paint: { 'fill-color': '#34d399', 'fill-opacity': 0.1 } }, firstSymbolId)
      map.addLayer({ id: 'rebell-deliv-me-line', type: 'line', source: 'rebell-deliv-me', layout: { visibility: 'none' }, paint: { 'line-color': '#34d399', 'line-width': 2.2, 'line-opacity': 0.85, 'line-dasharray': [2, 1.4] } })
      map.addSource('rebell-deliv-riv', { type: 'geojson', data: { type: 'FeatureCollection', features: RIVALES.map((r) => circlePolygon(r.lat, r.lng, DELIV_RIV)) } as never })
      map.addLayer({ id: 'rebell-deliv-riv-fill', type: 'fill', source: 'rebell-deliv-riv', layout: { visibility: 'none' }, paint: { 'fill-color': '#ff5c5c', 'fill-opacity': 0.05 } }, firstSymbolId)
      map.addLayer({ id: 'rebell-deliv-riv-line', type: 'line', source: 'rebell-deliv-riv', layout: { visibility: 'none' }, paint: { 'line-color': '#ff5c5c', 'line-width': 1.4, 'line-opacity': 0.5, 'line-dasharray': [1.5, 1.5] } })

      // Mapa de CALOR de amenaza (oculto por defecto; toggle "CALOR"). Bajo líneas/marcadores.
      map.addSource('rebell-heat', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as never })
      map.addLayer(
        {
          id: 'rebell-heat',
          type: 'heatmap',
          source: 'rebell-heat',
          layout: { visibility: 'none' },
          paint: {
            'heatmap-weight': ['*', ['get', 'w'], 1.6],
            'heatmap-intensity': 1.15,
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 13, 50, 16, 135],
            'heatmap-opacity': 0.62,
            'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.2, 'rgba(52,211,153,0.45)', 0.5, 'rgba(245,179,65,0.7)', 0.8, 'rgba(255,92,92,0.85)', 1, 'rgba(255,60,60,0.95)'],
          },
        },
        firstSymbolId,
      )

      // Líneas de conexión (la "tubería" estática) tu local → cada rival EN RANGO.
      map.addSource('rebell-links', { type: 'geojson', data: linksFor(radio) as never })
      map.addLayer({ id: 'rebell-links-glow', type: 'line', source: 'rebell-links', paint: { 'line-color': ['case', ['get', 'danger'], '#ff5c5c', '#ffbf10'], 'line-width': 10, 'line-opacity': 0.24, 'line-blur': 6 } })
      map.addLayer({ id: 'rebell-links-core', type: 'line', source: 'rebell-links', paint: { 'line-color': ['case', ['get', 'danger'], '#ff8a8a', '#ffd45e'], 'line-width': 3.4, 'line-opacity': 0.62 } })

      // Cometas de datos ELIMINADOS (Juan 25-jun: "ni los vi, fuera"). Eran un bucle requestAnimationFrame a
      // 60 fps que hacía setData en el mapa SIN PARAR → el mapa se repintaba continuamente = calor constante,
      // aunque no tocaras nada. Las líneas estáticas (la "tubería" local→rival) se quedan; eso no cuesta.
      // Solo pausamos las animaciones CSS del HUD (ping + scanline) cuando la pestaña no está visible.
      onVis = () => {
        const wrap = elRef.current?.parentElement // .mapa-3d
        if (document.hidden) wrap?.classList.add('is-hidden')
        else wrap?.classList.remove('is-hidden')
      }
      document.addEventListener('visibilitychange', onVis)

      // Marcador héroe (tu local) con aura + ping de radar.
      const heroEl = document.createElement('div')
      heroEl.className = 'm3-hero'
      heroEl.innerHTML = `<span class="m3-ping"></span><span class="m3-aura"></span><span class="m3-core"><b>${LOCAL.rating.toFixed(1)}</b><i>TÚ</i></span>`
      new mapboxgl.Marker({ element: heroEl, anchor: 'bottom' }).setLngLat([LOCAL.lng, LOCAL.lat]).addTo(map)

      // Marcadores-carta de cada rival (nodo hexagonal táctico + nombre al pasar el ratón).
      rivalMarks.current = []
      RIVALES.forEach((r, i) => {
        const danger = r.rating < 4 || r.signal.k === 'promo' // amenaza → nodo rojo (rima con las líneas)
        const el = document.createElement('button')
        el.className = 'm3-card' + (danger ? ' danger' : '')
        el.type = 'button'
        el.style.setProperty('--i', String(i)) // para el pop escalonado
        const rtTxt = r.rating > 0 ? `${r.rating.toFixed(1)}★` : 'Nuevo'
        el.innerHTML = `<span class="m3-nm">${escapeHTML(r.name)}</span><span class="m3-row"><span class="m3-rt">${rtTxt}</span><span class="m3-pr">${r.precio.toFixed(0)}€</span></span><span class="m3-hex"></span><span class="m3-stem"></span>`
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          openRef.current?.(r)
        })
        // hover en el mapa ↔ resalta su fila en el panel (y viceversa, vía estado `hot`)
        el.addEventListener('mouseenter', () => setHot(r.id))
        el.addEventListener('mouseleave', () => setHot(null))
        // estado inicial según el radio actual (aparecen/desaparecen con el slider)
        el.style.display = distM(LOCAL.lat, LOCAL.lng, r.lat, r.lng) <= radio ? '' : 'none'
        // offset -13: sube la carta para que el HEXÁGONO (que cae 13px bajo la base) quede CENTRADO en el
        // punto geográfico → la línea acaba justo en el nodo hexagonal, no por encima.
        new mapboxgl.Marker({ element: el, anchor: 'bottom', offset: [0, -13] }).setLngLat([r.lng, r.lat]).addTo(map)
        rivalMarks.current.push({ r, el })
      })

      safeResize()
      window.setTimeout(safeResize, 300)
      // Marcadores visibles poco DESPUÉS de cargar (ya posicionados → sin fantasmas) y TODOS a la vez → fluido.
      window.setTimeout(() => setMShow(true), 450)
      // PULSO VIOLETA que ESCANEA los edificios 3D: una banda violeta viaja desde TU local hacia fuera,
      // encendiendo cada fila de edificios al pasar y devolviéndolos a su color base. One-shot, premium
      // (Bertamiráns es rural → pocos edificios → recolorear por frame es barato). Usa la expresión
      // `['distance', punto]` de Mapbox para teñir cada edificio según su distancia al local.
      const runVioletSweep = (durMs = 3000) => {
        if (dead || mapRef.current !== map || !map.getLayer('rebell-3d-buildings')) return
        playSweep(0.16) // "boom efecto escaneo" suena al ARRANCAR la onda expansiva (Juan 25-jun: "bájale al boom" ×2). Afinable en el mezclador del Canon.
        const base = (satellite ? BUILDING_SAT : isLight ? BUILDING_LIGHT : BUILDING_DARK) as unknown
        const here = { type: 'Point', coordinates: [LOCAL.lng, LOCAL.lat] }
        const MAXR = Math.max(1600, radio * 1.7) // alcance del barrido (m) — MÁS EXTENSA (Juan 25-jun)
        const DUR = durMs // intro=3000; en TOGGLE de vista la alargamos → la banda 3D LINGER más en pantalla y se VE bien (Juan 25-jun)
        const t0 = performance.now()
        let last = 0
        const tick = (now: number) => {
          if (dead || mapRef.current !== map || !map.getLayer('rebell-3d-buildings')) return
          const k = (now - t0) / DUR
          if (k >= 1) { try { map.setPaintProperty('rebell-3d-buildings', 'fill-extrusion-color', base as never) } catch { /* capa fuera */ } return }
          if (now - last >= 32) {
            last = now
            // la onda VIAJA más allá del borde visible (×1.5) → SALE del mapa en vez de cortarse de golpe, y en el último
            // tramo la BANDA SE ESTRECHA (fade) → se DESVANECE suave (Juan 25-jun: "que no acabe de golpe, queda feo").
            const R = k * MAXR * 1.5
            const fade = k < 0.58 ? 1 : Math.max(0, 1 - (k - 0.58) / 0.42)
            const w1 = Math.max(6, 100 * fade), w2 = Math.max(16, 280 * fade) // banda más ancha; se estrecha al disiparse
            const band: unknown[] = ['interpolate', ['linear'], ['distance', here],
              R - w2, base,
              R - w1, '#7c5cf0',
              R, '#c4b5fd',
              R + w1, '#7c5cf0',
              R + w2, base]
            try { map.setPaintProperty('rebell-3d-buildings', 'fill-extrusion-color', band as never) } catch { /* capa fuera */ }
          }
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }

      // MODO OPERACIÓN: descenso cinematográfico sobre la zona + HUD que se ensambla. Al RECONSTRUIR por
      // cambio de tema (builtOnceRef) saltamos el vuelo → encuadre directo, sin repetir la intro cada vez.
      // Enciende los edificios (fade 1.6s) cuando las teselas están cargadas. Compartido por ambas ramas.
      const igniteBuildings = () => { if (map.getLayer('rebell-3d-buildings')) { try { map.setPaintProperty('rebell-3d-buildings', 'fill-extrusion-opacity', 0.95) } catch { /* capa fuera */ } } }
      if (reduceMotion() || builtOnceRef.current) {
        map.jumpTo({ center: [LOCAL.lng, LOCAL.lat], zoom: zoomFor(radio), pitch: 60, bearing: -17 })
        setArmed(true)
        setMShow(true)
        anchorRef.current = true
        // sin intro: enciende los edificios en cuanto haya teselas (también en toggle a vista vector)
        const tFade0 = performance.now()
        const reveal = () => {
          // Al revelar un TOGGLE: edificios SÓLIDOS rápido (fundido 220ms, no 1.6s) → la onda 3D los recolorea VISIBLES.
          // Antes, en satélite→vector las teselas cargaban al instante y la onda teñía edificios aún transparentes →
          // "no pasaba la wave al volver a vector" (Juan 25-jun). Ahora se VE igual en ambos sentidos.
          if (satFxRef.current) {
            try { map.setPaintProperty('rebell-3d-buildings', 'fill-extrusion-opacity-transition', { duration: 220, delay: 0 } as never) } catch { /* capa fuera */ }
          }
          igniteBuildings()
          if (satFxRef.current) { satFxRef.current = false; setSwitching(false); runVioletSweep(4600); fxRun.current?.(true) }
        }
        const fade = () => {
          if (dead || mapRef.current !== map) return
          const el = performance.now() - tFade0
          // velo MÍNIMO ~520ms para el toggle aunque las teselas carguen al instante (vector cachea rápido) → el terminal
          // y la onda se ven SIEMPRE, en los dos sentidos. Para la reconstrucción por tema (sin satFx) revela en cuanto cargue.
          const minHold = satFxRef.current ? 520 : 0
          // SATÉLITE: esperar también a que el TERRENO (DEM) esté cargado ANTES de revelar → el suelo "sube" con la
          // exageración BAJO el velo, no después = se acabó el "pequeño golpe" al cambiar a satélite (Juan 25-jun).
          const demReady = !satellite || !map.getSource('mapbox-dem') || map.isSourceLoaded('mapbox-dem')
          if ((map.areTilesLoaded() && demReady && el >= minHold) || el > 6500) { reveal(); return }
          window.setTimeout(fade, 90)
        }
        fade()
      } else {
        map.flyTo({ center: [LOCAL.lng, LOCAL.lat], zoom: zoomFor(radio), pitch: 60, bearing: -17, duration: 2800, curve: 1.42, essential: true })
        // el HUD se ENSAMBLA al ATERRIZAR (fin real del vuelo), no al principio
        map.once('moveend', () => {
          setArmed(true)
          anchorRef.current = true // a partir de aquí, rotar = orbitar el local
        })
        window.setTimeout(() => {
          setArmed(true)
          anchorRef.current = true
        }, 4300) // fallback si moveend no llega
        // REVEAL COORDINADO (Juan 25-jun: "sin ningún segundo sin edificios"): la intro hacker TAPA el mapa hasta que las
        // teselas están cargadas; justo entonces, A LA VEZ → encienden los edificios (fade 1.6s), la ONDA MORADA recorre el
        // mapa, y se levanta la intro. Así los edificios aparecen MIENTRAS la onda barre, sin un instante en blanco.
        const t0 = performance.now()
        const reveal = () => {
          if (dead || mapRef.current !== map) return
          const elapsed = performance.now() - t0
          if ((map.areTilesLoaded() && elapsed > 2000) || elapsed > 6500) {
            igniteBuildings()
            runVioletSweep()
            setBooting(false) // levanta la intro hacker
            return
          }
          window.setTimeout(reveal, 100)
        }
        reveal()
      }

      builtOnceRef.current = true // ya montado al menos una vez → próximas reconstrucciones (tema) sin vuelo
      setMapReady(true) // dispara los efectos que poblan visibilidad/calor/líneas filtradas
    })

    return () => {
      dead = true
      if (onVis) document.removeEventListener('visibilitychange', onVis)
      cc.removeEventListener('pointerdown', onRotDown)
      window.removeEventListener('pointermove', onRotMove)
      window.removeEventListener('pointerup', onRotUp)
      cc.removeEventListener('contextmenu', onCtx)
      mapBox?.removeEventListener('wheel', onCardWheel, true)
      ro.disconnect()
      map.remove()
      mapRef.current = null
      loadedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLight, satellite])

  // Al cambiar radio O filtro: actualiza círculo + qué rivales se ven (marcadores, líneas,
  // cometas, calor) según `visRef` (radio + filtro de capa). El panel usa los mismos `visibles`.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const src = map.getSource('rebell-radio') as mapboxgl.GeoJSONSource | undefined
    src?.setData(circlePolygon(LOCAL.lat, LOCAL.lng, radio) as never)
    const vis = visRef.current
    const visSet = new Set(vis.map((v) => v.id))
    rivalMarks.current.forEach(({ r, el }) => {
      el.style.display = visSet.has(r.id) ? '' : 'none'
    })
    const lsrc = map.getSource('rebell-links') as mapboxgl.GeoJSONSource | undefined
    lsrc?.setData(linksFromRivals(vis) as never)
    const hsrc = map.getSource('rebell-heat') as mapboxgl.GeoJSONSource | undefined
    hsrc?.setData(heatGeo(vis) as never)
  }, [radio, filtro, mapReady])

  // Toggle del mapa de CALOR de amenaza.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    try {
      if (map.getLayer('rebell-heat')) map.setLayoutProperty('rebell-heat', 'visibility', heat ? 'visible' : 'none')
    } catch {
      /* capa aún no lista */
    }
  }, [heat, mapReady])

  // Toggle de las zonas de REPARTO (tuya verde + competidores rojo) + REPARTO INTELIGENTE: al activarlo,
  // pedimos a Mapbox las ISÓCRONAS reales (zona alcanzable por TIEMPO de coche, no un círculo) y reemplazamos
  // los círculos → comparas cobertura real frente a la de cada competidor. Si falla, quedan los círculos.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const v = reparto ? 'visible' : 'none'
    for (const id of ['rebell-deliv-me-fill', 'rebell-deliv-me-line', 'rebell-deliv-riv-fill', 'rebell-deliv-riv-line']) {
      try {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v)
      } catch {
        /* capa aún no lista */
      }
    }
    if (reparto && !isoLoadedRef.current && MAPBOX_TOKEN) {
      isoLoadedRef.current = true
      const iso = async (lng: number, lat: number, min: number) => {
        const ctrl = new AbortController()
        const t = window.setTimeout(() => ctrl.abort(), 7000) // no dejar la promesa colgada si Mapbox no responde
        try {
          const r = await fetch(`https://api.mapbox.com/isochrone/v1/mapbox/driving/${lng},${lat}?contours_minutes=${min}&polygons=true&denoise=1&access_token=${MAPBOX_TOKEN}`, { signal: ctrl.signal })
          const j = (await r.json()) as { features?: unknown[] }
          return (j.features && j.features[0]) || null
        } catch {
          return null
        } finally {
          window.clearTimeout(t)
        }
      }
      void (async () => {
        const me = await iso(LOCAL.lng, LOCAL.lat, 10) // tu zona: 10 min en coche
        const ms = map.getSource('rebell-deliv-me') as mapboxgl.GeoJSONSource | undefined
        if (me && ms) ms.setData(me as never)
        const rivs = (await Promise.all(RIVALES.map((r) => iso(r.lng, r.lat, 8)))).filter(Boolean) // rivales: 8 min
        const rs = map.getSource('rebell-deliv-riv') as mapboxgl.GeoJSONSource | undefined
        if (rivs.length && rs) rs.setData({ type: 'FeatureCollection', features: rivs } as never)
      })()
    }
  }, [reparto, mapReady])

  // Atajos de teclado (cockpit jugable): 1-5 objetivos · Espacio filtro · [ ] radio.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const k = e.key
      if (k >= '1' && k <= '5') kbdRef.current.focus(+k - 1)
      else if (k === ' ') {
        e.preventDefault()
        kbdRef.current.cycle()
      } else if (k === '[') kbdRef.current.step(-100)
      else if (k === ']') kbdRef.current.step(100)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Cross-highlight: el rival "hot" (hover en panel o mapa, o seleccionado) enciende su nodo
  // en el mapa y engrosa su línea → mapa y panel se hablan (sistema, no widgets sueltos).
  // Con un comparador abierto, su marcador pequeño sobra (la info ya está en la carta y el punto lo marca el
  // nodo hexagonal del conector) → lo ocultamos para que no asome "etiqueta fantasma" detrás de la carta.
  useEffect(() => {
    const abiertos = new Set(comparados.map((c) => c.id))
    rivalMarks.current.forEach(({ r, el }) => { el.style.visibility = abiertos.has(r.id) ? 'hidden' : '' })
  }, [comparados])

  useEffect(() => {
    rivalMarks.current.forEach(({ r, el }) => el.classList.toggle('is-hot', r.id === hot))
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const sel = hot ?? '__none__'
    try {
      if (map.getLayer('rebell-links-core')) {
        map.setPaintProperty('rebell-links-core', 'line-width', ['case', ['==', ['get', 'rid'], sel], 6, 3.4] as never)
        map.setPaintProperty('rebell-links-core', 'line-opacity', ['case', ['==', ['get', 'rid'], sel], 1, 0.62] as never)
      }
      if (map.getLayer('rebell-links-glow')) {
        map.setPaintProperty('rebell-links-glow', 'line-opacity', ['case', ['==', ['get', 'rid'], sel], 0.5, 0.2] as never)
      }
    } catch {
      /* capas aún no listas */
    }
  }, [hot])

  // Al abrir/cerrar una carta: RESOLVEMOS el anti-solape una vez (histéresis) y arrancamos el asentamiento
  // (rAF auto-parante). El solver NO corre por frame → 0 temblor; el rAF se detiene solo en reposo → 0 calor.
  useEffect(() => {
    solveRef.current()
    armRef.current()
  }, [comparados])
  // Cancela el bucle al desmontar la sección.
  useEffect(() => () => { if (cardLoopRef.current) cancelAnimationFrame(cardLoopRef.current) }, [])

  // Al abrir el CAJÓN de cromos (derecha) desplazamos el contenido del mapa a la IZQUIERDA con padding de cámara →
  // el local y los rivales quedan centrados en el hueco libre, no tapados por los cromos (Juan 25-jun: "el mapa lo
  // centras a la izquierda al sitio que queda"). Se resetea al cerrar el cajón.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const id = requestAnimationFrame(() => {
      const el = document.querySelector('.cromo-deck') as HTMLElement | null
      const deckW = enviadas.length > 0 && el ? el.getBoundingClientRect().width + 30 : 0 // mide el cajón real (varía en fullscreen)
      try { map.easeTo({ padding: { right: deckW, left: 0, top: 0, bottom: 0 }, duration: 520, essential: true }) } catch { /* mapa no listo */ }
    })
    return () => cancelAnimationFrame(id)
  }, [enviadas.length])

  // Pinchar FUERA del mapa → ocultar todas las cartas (Juan 25-jun). Solo escucha mientras haya cartas abiertas.
  useEffect(() => {
    if (!comparados.length) return
    const onDown = (e: PointerEvent) => {
      const wrap = elRef.current?.closest('.mapa-map')
      if (wrap && !wrap.contains(e.target as Node)) {
        setComparados([])
        setHot(null)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [comparados.length])

  // Ancla cada comparador al PUNTO de su rival y lo ESCALA con el zoom (tamaño anclado al MAPA: como un objeto
  // del mundo, igual que los edificios) → al alejar se encoge y caben varios sin molestarse; tope 1 (no se hace
  // enorme) y suelo .36 (legible). Lo coloca encima del marcador (o debajo), dentro del recuadro (clamp). El pico
  // (--tail-x) apunta a la coordenada real. Pedido de Juan (24-jun: "tamaño anclado al mapa, no fijo en pantalla").
  // Caja base ANCLADA de cada carta (proyectada a su punto, encima/debajo del marcador, dentro del marco) +
  // escala k anclada al zoom. Se recalcula barata por frame (sigue al mapa); la usan TANTO el solver como el dibujo.
  type Box = { id: string; el: HTMLDivElement; px: number; py: number; vw: number; vh: number; left: number; top: number; below: boolean; big: number; vis: number; dC: number; ow: number; off: boolean }
  const computeBoxes = (): { map: mapboxgl.Map; W: number; H: number; k: number; PAD: number; boxes: Box[] } | null => {
    const map = mapRef.current
    const cont = elRef.current?.parentElement as HTMLElement | null // .mapa-3d
    if (!map || !cont) return null
    const W = cont.clientWidth, H = cont.clientHeight
    const PAD = 10, gap = 10
    // Escala PEGADA AL SUELO (objeto del mundo 3D), pedido de Juan 25-jun: la carta sale a un tamaño ESTÁNDAR en el
    // encuadre por defecto; al ACERCARTE (zoom in) CRECE para leerla; al ALEJARTE encoge y, cuando es ilegible,
    // DESAPARECE (fade); al volver a acercarte REAPARECE (sigue seleccionada). Anclamos al zoom por defecto del radio
    // (zoomFor) → el "estándar" es el mismo sea cual sea el radio. 2^Δzoom = escala real del mundo (doble por nivel).
    const z = map.getZoom()
    const STD = 0.46 // tamaño estándar (Juan 25-jun: "70% del actual" → 0.66 × 0.70); todo escala con esto
    const k = Math.min(8, STD * Math.pow(2, z - zoomFor(radioRef.current))) // al ACERCAR CRECE hasta GIGANTE; tope alto para poder ATRAVESARLA
    const HIDE = 0.21, FADE = 0.126 // fade-IN al acercarse desde lejos (k bajo = ilegible → esfumar)
    const visLow = Math.max(0, Math.min(1, (k - HIDE) / FADE)) // se esfuma al ALEJAR / reaparece al acercar
    const boxes: Box[] = []
    for (const r of comparadosRef.current) {
      const el = cardRefs.current[r.id]
      if (!el) continue
      const p = map.project([r.lng, r.lat])
      const ow = el.offsetWidth, oh = el.offsetHeight
      const vw = ow * k, vh = oh * k // tamaño VISUAL (ya escalado)
      // Margen de descarte PROPORCIONAL al tamaño: una carta GIGANTE (zoom in) sigue visible aunque su punto se salga
      // de pantalla (ya te has "metido" dentro de ella); una carta pequeña se descarta en cuanto su punto sale del marco.
      const margin = 120 + Math.max(vw, vh)
      const dC = Math.hypot(p.x - W / 2, p.y - H / 2) // distancia del punto al centro (para acotar la disolución)
      const offscreen = p.x < -margin || p.x > W + margin || p.y < -margin || p.y > H + margin
      // MODELO VENTANA (Juan 25-jun: "es una ventana; las cosas se esconden en la ventana si te mueves"). La carta va
      // PEGADA encima de su marcador y se RECORTA contra el borde del recuadro — NO se reposiciona para seguir visible
      // (nada de "bajar para adecuarse"). Al hacer zoom sube y se OCULTA POR ARRIBA, como un objeto visto por una ventana
      // (corte de techo de Los Sims = RECORTE, no fade ni movimiento). La DISOLUCIÓN tipo "atravesar" se reserva a la
      // carta que miras DE FRENTE (centrada): las de los lados se esconden por recorte, no por fade.
      const over = Math.max(vw / Math.max(1, W), vh / Math.max(1, H)) // 1 = la carta llena el marco
      const centered = Math.max(0, Math.min(1, 1 - dC / (Math.min(W, H) * 0.42))) // 1 si el punto está centrado, 0 si lejos
      const dissolve = Math.max(0, Math.min(1, (1.45 - over) / 0.40)) // 1 nítida → 0 atravesada (solo aplica si está centrada)
      const visHigh = Math.max(dissolve, 1 - centered) // off-center → 1 (solo recorte, sin fade); centrada → se disuelve al llenar
      const vis = Math.min(visLow, visHigh)
      const off = vis <= 0.02 || offscreen // se esfumó (atravesar) o el punto se fue de pantalla → no se ve
      const big = Math.max(0, Math.min(1, (Math.max(vw / Math.max(1, W - 2 * PAD), vh / Math.max(1, H - 2 * PAD)) - 0.85) / 0.30))
      const top = p.y - gap - vh // ENCIMA del marcador, SIN clamp ni flip → puede salirse por arriba (se recorta)
      const left = p.x - vw / 2  // centrada en X sobre el marcador, SIN clamp → se recorta por los lados
      const below = false
      boxes.push({ id: r.id, el, px: p.x, py: p.y, vw, vh, left, top, below, big, vis, dC, ow, off })
    }
    return { map, W, H, k, PAD, boxes }
  }

  // ── SOLVER (anti-solape con HISTÉRESIS). Es la pieza que mata el temblor. Se llama SOLO al abrir/cerrar carta
  //    o cuando el mapa se PARA (moveend) — NUNCA por frame. Calcula un offset (dx,dy) CONGELADO por carta y lo
  //    guarda en placeRef; el dibujo solo lo lee. Claves de estabilidad (literatura: coherencia temporal):
  //    (1) ORDEN por id (no por top proyectado) → quién cede nunca se intercambia entre solves = 0 swap.
  //    (2) preferencia ANCLA → POSICIÓN ACTUAL → espiral: la carta vuelve a casa cuando hay sitio, y si no,
  //        conserva su hueco previo (memoria) en vez de saltar a otro igual de válido.
  const SEP = 14
  const solveLayout = () => {
    const ctx = computeBoxes()
    if (!ctx) return
    const { W, H, PAD, boxes } = ctx
    // VENTANA (Juan 25-jun): el solver SOLO evita solapes; NO clampa al marco (si clampara, al parar el zoom tiraría de
    // la carta para meterla dentro = el "reposicionar" que Juan NO quiere). Las cartas se recortan contra el borde.
    const clX = (_b: Box, x: number) => x
    const clY = (_b: Box, y: number) => y
    const cx = W / 2, cy = H / 2
    const sol = boxes.filter((b) => !b.off)
    const prev = placeRef.current?.off || {}
    const order = [...sol].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) // ESTABLE → sin swap
    const placed: { l: number; t: number; vw: number; vh: number }[] = []
    const pos: Record<string, { l: number; t: number }> = {}
    const off: Record<string, { dx: number; dy: number }> = {}
    const hits = (l: number, t: number, b: Box) =>
      placed.some((p) => l < p.l + p.vw + SEP && l + b.vw + SEP > p.l && t < p.t + p.vh + SEP && t + b.vh + SEP > p.t)
    for (const b of order) {
      // Carta GIGANTE (per-carta, no global): SIN anti-solape → flota anclada a su sitio (a esa escala el offset la
      // desplazaría muchísimo, queja de Juan). No entra en `placed` → no estorba a las pequeñas. Coherente con el dibujo.
      if (b.big > 0.5) { off[b.id] = { dx: 0, dy: 0 }; continue }
      const aL = clX(b, b.left), aT = clY(b, b.top) // ancla
      let L = aL, T = aT, done = false
      if (!hits(aL, aT, b)) done = true // 1) ANCLA (preferida)
      if (!done) { // 2) POSICIÓN ACTUAL (histéresis)
        const po = prev[b.id]
        if (po) { const cl = clX(b, b.left + po.dx), ct = clY(b, b.top + po.dy); if (!hits(cl, ct, b)) { L = cl; T = ct; done = true } }
      }
      if (!done) { // 3) ESPIRAL (abanico simétrico hacia el espacio libre)
        const a0 = Math.atan2(b.top + b.vh / 2 - cy, b.left + b.vw / 2 - cx)
        for (let rad = 16; rad <= 720 && !done; rad += 16) {
          for (let s = 0; s < 24 && !done; s++) {
            const ang = a0 + (s % 2 ? 1 : -1) * Math.ceil(s / 2) * (Math.PI / 8)
            const cl = clX(b, b.left + Math.cos(ang) * rad), ct = clY(b, b.top + Math.sin(ang) * rad)
            if (!hits(cl, ct, b)) { L = cl; T = ct; done = true }
          }
        }
      }
      pos[b.id] = { l: L, t: T }
      off[b.id] = { dx: L - b.left, dy: T - b.top }
      placed.push({ l: L, t: T, vw: b.vw, vh: b.vh })
    }
    // ¿el voraz dejó solape? (clústers MUY apretados de 4-5 cartas) → REJILLA centrada, orden estable (px + id).
    // SOLO cartas pequeñas: las gigantes se saltaron (no tienen `pos` y no participan en la rejilla).
    const small = sol.filter((b) => !(b.big > 0.5))
    let residual = false
    for (let i = 0; i < small.length && !residual; i++) for (let j = i + 1; j < small.length; j++) {
      const A = small[i], B = small[j], pa = pos[A.id], pb = pos[B.id]
      if (Math.min(pa.l + A.vw, pb.l + B.vw) - Math.max(pa.l, pb.l) > 1 &&
          Math.min(pa.t + A.vh, pb.t + B.vh) - Math.max(pa.t, pb.t) > 1) { residual = true; break }
    }
    if (residual && small.length > 1) {
      const cw = small[0].vw, ch = small[0].vh
      const cols = Math.max(1, Math.min(small.length, Math.floor((W - 2 * PAD + SEP) / (cw + SEP))))
      const rows = Math.ceil(small.length / cols)
      const gridW = cols * cw + (cols - 1) * SEP, gridH = rows * ch + (rows - 1) * SEP
      const startX = Math.max(PAD, (W - gridW) / 2), startY = Math.max(PAD, Math.min((H - gridH) / 2, 18))
      const byX = [...small].sort((a, b) => a.px - b.px || (a.id < b.id ? -1 : 1))
      byX.forEach((b, idx) => {
        const L = clX(b, startX + (idx % cols) * (cw + SEP)), T = clY(b, startY + Math.floor(idx / cols) * (ch + SEP))
        off[b.id] = { dx: L - b.left, dy: T - b.top }
      })
    }
    placeRef.current = { off } // LAYOUT CONGELADO → el dibujo solo lo lee (en reposo nada recalcula = 0 temblor)
  }

  // ── DIBUJO (por frame). NO resuelve nada: proyecta el ancla, lee el offset congelado, lo persigue con lerp y
  //    pinta el conector. Devuelve true si SIGUE animando (lerp sin asentar o cometa vivo) → el bucle decide parar.
  const positionCards = (): boolean => {
    const ctx = computeBoxes()
    if (!ctx) return false
    const { map, k, boxes } = ctx // W/H/PAD ya no: la carta NO se clampa (modelo ventana, se recorta sola)
    // Oculta el marcador pequeño SOLO cuando SU carta está bien visible (la info ya está en la carta). Si la carta se
    // esfumó (alejar, atravesar, o no es la del modo foco), REAPARECE el marcador → el rival nunca se queda sin nada.
    const openIds = new Set(comparadosRef.current.map((c) => c.id))
    const visById = new Map(boxes.map((b) => [b.id, b.off ? 0 : b.vis]))
    rivalMarks.current.forEach(({ r, el }) => { const v = (openIds.has(r.id) && (visById.get(r.id) ?? 0) > 0.5) ? 'hidden' : ''; if (el.style.visibility !== v) el.style.visibility = v })
    const offs = placeRef.current?.off || {} // offsets CONGELADOS del solver (NO se recalculan aquí → 0 temblor)
    const moving = map.isMoving() || map.isEasing() || map.isZooming() || map.isRotating()
    const live = new Set<string>()
    const segs: string[] = [] // <line>/<polygon>/<circle> del SVG conector, reconstruido por frame (N pequeño)
    const rm = reduceMotion()
    const now = performance.now()
    // Mientras el mapa se MUEVE, la carta se PEGA a su ancla sin retraso (lerp≈1) → no "patina" ni salta. En reposo,
    // asentamiento suave (.22) hacia el offset congelado. El objetivo ya NO oscila entre frames → no puede temblar.
    const LERP = moving ? 1 : 0.22
    let needsMore = false
    for (const b of boxes) {
      live.add(b.id)
      const o = offs[b.id] || { dx: 0, dy: 0 }
      const tx = o.dx * (1 - b.big), ty = o.dy * (1 - b.big) // el anti-solape se DESVANECE al hacerse gigante (sin tirón al cruzar)
      const n = nudgeRef.current[b.id] || (nudgeRef.current[b.id] = { x: rm ? tx : 0, y: rm ? ty : 0 })
      if (rm) { n.x = tx; n.y = ty } // sin animación → directo al sitio
      else {
        n.x += (tx - n.x) * LERP
        n.y += (ty - n.y) * LERP
        if (Math.abs(tx - n.x) < 0.4) n.x = tx; else needsMore = true // snap al asentar; si no, seguir animando
        if (Math.abs(ty - n.y) < 0.4) n.y = ty; else needsMore = true
      }
      // VENTANA: SIN clamp al marco → la carta va pegada a su punto y se RECORTA contra el borde (no se reposiciona).
      // Solo un SANITY clamp a ±9999 (muy fuera de cualquier marco) para que un punto proyectado lejísimos a zoom
      // extremo no genere un translate de millones de px (la carta ya está oculta por opacidad si está fuera).
      const fl = Math.max(-9999, Math.min(9999, b.left + n.x))
      const ft = Math.max(-9999, Math.min(9999, b.top + n.y))
      b.el.style.opacity = b.off ? '0' : b.vis.toFixed(2) // fade por zoom per-carta (esfumar al alejar / al atravesar / fuera de foco)
      b.el.style.pointerEvents = (b.off || b.vis < 0.5) ? 'none' : 'auto'
      b.el.style.transform = `translate(${Math.round(fl)}px, ${Math.round(ft)}px) scale(${k.toFixed(3)})` // plano (origin 0 0); billboard 3D retirado (se veía escorado)
      // ── MAGNETIZE: cuando una carta se desplaza para no solaparse, su conector se TENSA (pulso) y suena un tick.
      const mg = magRef.current[b.id] || (magRef.current[b.id] = { disp: false, pulse: 0 })
      const dmag = Math.hypot(n.x, n.y)
      if (b.big < 0.5 && dmag > 26 && !mg.disp) { mg.disp = true; mg.pulse = now + 460; if (!rm) playTick(0.3) } // solo en pequeñas (al hacerse gigante el offset→0 no es imantación)
      else if (dmag < 12) mg.disp = false
      const pulse = Math.max(0, Math.min(1, (mg.pulse - now) / 460)) // 1→0 en 460ms (one-shot)
      if (pulse > 0.02) needsMore = true // pulso del imán vivo → seguir animando
      b.el.classList.toggle('cmp-magnet', pulse > 0.02)
      // ── Conector: línea + nodo hexagonal. Solo en cartas pequeñas; en las GIGANTES el punto queda DENTRO de la carta
      //    (está centrada en él), así que no hay tether que dibujar.
      if (!b.off && b.big < 0.5) {
        const mx = b.px, my = b.py // punto del marcador (coords del contenedor)
        const ax = Math.max(fl + 14, Math.min(fl + b.vw - 14, mx)) // ancla X en el borde de la carta (alineada al punto)
        const ay = my <= ft + b.vh / 2 ? ft : ft + b.vh // borde superior o inferior, el que mire al punto
        const dist = Math.hypot(mx - ax, my - ay)
        if (dist > 8) {
          // línea recta carta→punto (estética HUD/cockpit); al imantar se ENGORDA y BRILLA y luego se relaja (tensión).
          const lw = (1.4 + pulse * 2).toFixed(2), lo = (0.5 + pulse * 0.45).toFixed(2)
          segs.push(`<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" class="cl-line" style="stroke-width:${lw};opacity:${lo}"/>`)
          segs.push(`<circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.4" class="cl-dot"/>`)
          // (Cometa del conector RETIRADO 25-jun: animaba en bucle perpetuo → mantenía el rAF vivo = calor en reposo,
          //  igual que los cometas del mapa que Juan ya quitó. La línea + nodo + pulso del imán se quedan.)
        }
        // nodo hexagonal en el punto real del rival (crece un poco al imantar)
        const R = 6.5 + pulse * 3
        const hex = Array.from({ length: 6 }, (_, q) => { const a = (Math.PI / 3) * q - Math.PI / 2; return `${(mx + R * Math.cos(a)).toFixed(1)},${(my + R * Math.sin(a)).toFixed(1)}` }).join(' ')
        segs.push(`<polygon points="${hex}" class="cl-node"/>`)
      }
    }
    if (leadsRef.current) leadsRef.current.innerHTML = segs.join('')
    for (const id of Object.keys(nudgeRef.current)) if (!live.has(id)) delete nudgeRef.current[id] // limpia cartas cerradas
    for (const id of Object.keys(magRef.current)) if (!live.has(id)) delete magRef.current[id]
    return needsMore
  }

  // Bucle de ASENTAMIENTO (rAF auto-parante): anima el lerp hacia el layout congelado y se DETIENE solo cuando todo
  // está quieto (mapa parado + lerp asentado + sin cometa) → 0 CPU/GPU en reposo (anti-calor). Durante el movimiento
  // el dibujo lo conduce map.on('render') (mismo frame que el mapa); aquí solo cubrimos el asentamiento en reposo.
  const armCardLoop = () => {
    if (!comparadosRef.current.length || cardLoopRef.current) return
    const tick = () => {
      // En segundo plano (pestaña oculta) NO repintamos: paramos el bucle, se re-arma al volver a mover el mapa.
      if (document.hidden) { cardLoopRef.current = 0; return }
      const map = mapRef.current
      const moving = !!map && (map.isMoving() || map.isEasing() || map.isZooming() || map.isRotating())
      const more = moving ? false : positionRef.current() // si el mapa se mueve, ya dibuja el render; aquí solo asentar
      cardLoopRef.current = (comparadosRef.current.length && (moving || more)) ? requestAnimationFrame(tick) : 0
    }
    cardLoopRef.current = requestAnimationFrame(tick)
  }
  comparadosRef.current = comparados
  positionRef.current = positionCards
  solveRef.current = solveLayout
  armRef.current = armCardLoop

  const enRango = RIVALES.map((r) => ({ ...r, d: distM(LOCAL.lat, LOCAL.lng, r.lat, r.lng) }))
    .filter((r) => r.d <= radio)
    .sort((a, b) => a.d - b.d)

  // Alertas: rival con rating < 4 o que lanzó promo → reacciona el mismo día.
  const alertas = enRango.filter((r) => r.rating < 4 || r.signal.k === 'promo')
  // Tu hueco en la zona: categorías sin ningún rival en el radio = oportunidades.
  const presentes = new Set(enRango.map((r) => ALIAS[r.tipo] || r.tipo))
  const huecos = CATEGORIAS.filter((c) => !presentes.has(c)).slice(0, 3)
  const radioT = fmtDist(radio)

  // ── Telemetría de combate (datos ya existentes, recompuestos en lenguaje HUD) ──
  // Posición en la zona (ranking por rating, tú incluido).
  const zona = [{ isLocal: true, rating: LOCAL.rating }, ...enRango.map((r) => ({ isLocal: false, rating: r.rating }))].sort((a, b) => b.rating - a.rating)
  const pos = zona.findIndex((z) => z.isLocal) + 1
  // Dominancia: % de rivales en rango a los que igualas o superas en rating.
  const domWins = enRango.filter((r) => LOCAL.rating >= r.rating).length
  const dominancia = enRango.length ? Math.round((domWins / enRango.length) * 100) : 100
  // Amenaza por rival (0-100): rating alto + más barato que tú + señal activa + cercanía.
  const SIGW: Record<Signal['k'], number> = { promo: 1, social: 0.8, reseña: 0.5, noticia: 0.3 }
  const threatOf = (r: Rival & { d: number }) =>
    Math.max(6, Math.min(100, Math.round(42 * (r.rating / 5) + 26 * Math.max(0, 1 - r.precio / LOCAL.precio) + 20 * SIGW[r.signal.k] + 12 * (1 - r.d / radio))))
  const threatLvl = (t: number) => (t >= 64 ? 'hi' : t >= 44 ? 'mid' : 'lo')
  const rivalesAmenaza = enRango.map((r) => ({ ...r, threat: threatOf(r) })).sort((a, b) => b.threat - a.threat)
  // Mini-stats de inteligencia.
  const nPromos = enRango.filter((r) => r.signal.k === 'promo').length
  const nVirales = enRango.filter((r) => r.signal.k === 'social').length
  const nResenas = enRango.filter((r) => r.signal.k === 'reseña').length
  // Oportunidad: rival que flojea (reseñas negativas o rating más bajo en rango).
  const oport = enRango.find((r) => /negativ/i.test(r.signal.txt)) || [...enRango].sort((a, b) => a.rating - b.rating)[0]

  // Filtro de capa: qué rivales se VEN (en mapa y listas). El rank/dominancia siguen sobre TODO el radio.
  const activo = (r: Rival & { d: number }) =>
    filtro === 'todos' ||
    (filtro === 'amenaza' && threatOf(r) >= 58) || // solo los que aprietan de verdad
    (filtro === 'baratos' && r.precio < LOCAL.precio * 0.8) || // claramente más baratos que tú
    (filtro === 'cerca' && r.d <= radio * 0.5)
  const visibles = rivalesAmenaza.filter(activo) // trae threat + orden por amenaza
  visRef.current = visibles
  radioRef.current = radio
  // MODO DENSO: con muchos rivales (gran ciudad) los marcadores se solaparían → colapsan a pastilla compacta
  // (rating+precio) y el nombre pasa a hover. Con pocos (p.ej. Bertamiráns) se ven los nombres como ahora.
  useEffect(() => {
    elRef.current?.parentElement?.classList.toggle('dense', visibles.length > 6)
  }, [visibles.length])

  // ── CAPTURA INTELIGENTE: genera un INFORME de zona en PNG (mapa 3D de fondo + cabecera + tu posición + fichas
  //    de rivales por amenaza + marca REBELL) para compartir. Dibujado a canvas (sin librerías) → control total y
  //    cero problemas de serialización del DOM. El mapa WebGL se lee gracias a preserveDrawingBuffer.
  const capturarInteligencia = async () => {
    const map = mapRef.current
    if (!map || capturando) return
    setCapturando(true)
    play('pop', 0.5, 1.18)
    try {
      try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready } catch { /* fuentes ya listas */ }
      // Sin preserveDrawingBuffer, el canvas WebGL se vacía tras pintar → hay que COPIARLO dentro del propio
      // frame de render (evento 'render'), si no sale negro. Lo volcamos a un canvas 2D normal (ya legible).
      const mapSnap = await new Promise<HTMLCanvasElement | null>((resolve) => {
        const gl = map.getCanvas()
        const grab = () => {
          map.off('render', grab)
          try {
            const s = document.createElement('canvas')
            s.width = gl.width; s.height = gl.height
            s.getContext('2d')?.drawImage(gl, 0, 0)
            resolve(s)
          } catch { resolve(null) }
        }
        map.on('render', grab)
        map.triggerRepaint()
      })
      const W = 1080, H = 1350, S = 2
      const cv = document.createElement('canvas')
      cv.width = W * S; cv.height = H * S
      const ctx = cv.getContext('2d')
      if (!ctx) { setCapturando(false); return }
      ctx.scale(S, S)
      const GOLD = '#ffbf10', INK = '#f5f5f7', MUT = 'rgba(255,255,255,.62)', LINE = 'rgba(255,255,255,.09)'
      const rr = (x: number, y: number, w: number, h: number, rad: number) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, rad) }
      ctx.fillStyle = '#0b0b0d'; ctx.fillRect(0, 0, W, H)
      // 1) MAPA 3D en banda superior (cover-crop). Si el canvas está "tainted" lo capturamos en el try del export.
      const mapH = 548
      try {
        if (mapSnap) {
          const sr = Math.max(W / mapSnap.width, mapH / mapSnap.height)
          const dw = mapSnap.width * sr, dh = mapSnap.height * sr
          ctx.save(); rr(0, 0, W, mapH, 0); ctx.clip()
          ctx.drawImage(mapSnap, (W - dw) / 2, (mapH - dh) / 2, dw, dh); ctx.restore()
        }
      } catch { /* sin fondo de mapa */ }
      const g = ctx.createLinearGradient(0, 0, 0, mapH)
      g.addColorStop(0, 'rgba(8,8,10,.74)'); g.addColorStop(0.42, 'rgba(8,8,10,.12)'); g.addColorStop(0.84, 'rgba(11,11,13,.35)'); g.addColorStop(1, '#0b0b0d')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, mapH)
      // 2) CABECERA (sobre el mapa)
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = GOLD; ctx.font = '800 21px Inter, system-ui, sans-serif'
      ctx.fillText('INTELIGENCIA DE ZONA · EN VIVO', 56, 80)
      ctx.fillStyle = INK; ctx.font = '800 84px "Clash Grotesk", Inter, sans-serif'
      ctx.fillText('Bertamiráns', 52, 162)
      const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
      ctx.fillStyle = MUT; ctx.font = '600 25px Inter, system-ui, sans-serif'
      ctx.fillText(`Radio ${fmtDist(radio)}   ·   ${enRango.length} rivales   ·   ${fecha}`, 56, 204)
      // 3) TU POSICIÓN (tarjeta dorada)
      let y = mapH + 26
      ctx.fillStyle = 'rgba(255,191,16,.10)'; rr(48, y, W - 96, 132, 22); ctx.fill()
      ctx.strokeStyle = 'rgba(255,191,16,.34)'; ctx.lineWidth = 1.4; rr(48, y, W - 96, 132, 22); ctx.stroke()
      ctx.fillStyle = GOLD; ctx.font = '800 18px Inter, sans-serif'
      ctx.fillText('TU POSICIÓN EN LA ZONA', 76, y + 42)
      ctx.fillStyle = INK; ctx.font = '800 64px "Clash Grotesk", Inter, sans-serif'
      ctx.fillText(`#${pos}`, 76, y + 104)
      ctx.fillStyle = MUT; ctx.font = '600 24px Inter, sans-serif'
      ctx.fillText(`de ${zona.length}`, 76 + ctx.measureText(`#${pos}`).width + 18, y + 104)
      ctx.textAlign = 'right'
      ctx.fillStyle = INK; ctx.font = '800 40px "Clash Grotesk", Inter, sans-serif'
      ctx.fillText(`${LOCAL.rating.toFixed(1)}★`, W - 76, y + 70)
      ctx.fillStyle = '#7CEF5A'; ctx.font = '700 22px Inter, sans-serif'
      ctx.fillText(`${dominancia}% dominancia`, W - 76, y + 104)
      ctx.textAlign = 'left'
      // 4) RIVALES (por amenaza)
      y += 132 + 36
      ctx.fillStyle = GOLD; ctx.font = '800 18px Inter, sans-serif'
      ctx.fillText('RIVALES · ORDENADOS POR AMENAZA', 56, y)
      y += 22
      const TH: Record<string, [string, string]> = { hi: ['#ff5c5c', 'ALTA'], mid: ['#f5b341', 'MEDIA'], lo: ['#7CEF5A', 'BAJA'] }
      const filas = (visibles.length ? visibles : rivalesAmenaza).slice(0, 5)
      const rowH = 94
      for (const r of filas) {
        const [tc, tl] = TH[threatLvl(r.threat)]
        rr(48, y, W - 96, rowH - 12, 18); ctx.fillStyle = '#141417'; ctx.fill()
        ctx.strokeStyle = LINE; ctx.lineWidth = 1; rr(48, y, W - 96, rowH - 12, 18); ctx.stroke()
        ctx.fillStyle = tc; rr(48, y + 14, 5, rowH - 40, 3); ctx.fill() // acento de amenaza
        ctx.fillStyle = INK; ctx.font = '700 29px "Clash Grotesk", Inter, sans-serif'
        ctx.fillText(r.name, 78, y + 36)
        ctx.fillStyle = MUT; ctx.font = '500 21px Inter, sans-serif'
        ctx.fillText(`${r.tipo}  ·  ${r.precio.toFixed(2).replace('.', ',')}€  ·  ${fmtDist(r.d)}  ·  ${r.reviews.toLocaleString('es-ES')} reseñas`, 78, y + 66)
        ctx.textAlign = 'right'
        ctx.fillStyle = GOLD; ctx.font = '800 30px "Clash Grotesk", Inter, sans-serif'
        ctx.fillText(`${r.rating.toFixed(1)}★`, W - 150, y + 38)
        ctx.fillStyle = tc; ctx.font = '800 15px Inter, sans-serif'
        const pw = ctx.measureText(tl).width + 26
        rr(W - 76 - pw, y + 22, pw, 28, 14); ctx.fillStyle = tc + '22'; ctx.fill()
        ctx.fillStyle = tc; ctx.fillText(tl, W - 76 - 13, y + 41)
        ctx.textAlign = 'left'
        y += rowH
      }
      // 5) FOOTER (marca)
      ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(0, H - 64, W, 64)
      ctx.fillStyle = GOLD; ctx.font = '800 24px "Clash Grotesk", Inter, sans-serif'
      ctx.fillText('REBELL', 56, H - 24)
      ctx.fillStyle = MUT; ctx.font = '600 19px Inter, sans-serif'
      ctx.fillText('Sala de guerra · panel de inteligencia', 56 + ctx.measureText('REBELL').width + 16, H - 24)
      ctx.textAlign = 'right'; ctx.fillStyle = MUT; ctx.font = '600 18px Inter, sans-serif'
      ctx.fillText('dashboardhost.pages.dev', W - 56, H - 24); ctx.textAlign = 'left'
      // EXPORT + descarga
      let url = ''
      try { url = cv.toDataURL('image/png') } catch { url = '' } // canvas tainted → sin imagen
      if (url) {
        ;(window as unknown as { __lastCapture?: string }).__lastCapture = url
        const a = document.createElement('a')
        a.href = url; a.download = `REBELL-inteligencia-${new Date().toISOString().slice(0, 10)}.png`
        document.body.appendChild(a); a.click(); a.remove()
        playLock(0.45)
      }
    } finally {
      setCapturando(false)
    }
  }
  kbdRef.current = {
    focus: (n) => {
      const r = visibles[n]
      if (r) abrirComparador(r)
    },
    cycle: () => {
      const order = ['todos', 'amenaza', 'baratos', 'cerca'] as const
      setFiltro((f) => order[(order.indexOf(f) + 1) % order.length])
      play('pop', 0.4, 1.1)
    },
    step: (d) => {
      const nv = Math.max(300, Math.min(5000, radio + d))
      setRadio(nv)
      flyZoom(nv)
    },
  }

  // Toggle vista satélite ↔ vector CON la onda glitch (Juan 25-jun). Cae la "gota" + sube el velo (tapa la
  // reconstrucción), reconstruimos el mapa por debajo, y al cargar las teselas la onda BARRE revelando el nuevo
  // estilo (ver el poller `fade` en el efecto del mapa). Con reduced-motion cambia directo, sin onda.
  const toggleSat = () => {
    play('pop', 0.4, satellite ? 0.95 : 1.15)
    if (reduceMotion()) { setSatellite((s) => !s); return }
    satFxRef.current = true
    setSwitchTo(satellite ? 'VECTOR TÁCTICO' : 'VISTA SATÉLITE') // destino = el modo CONTRARIO al actual
    setSwitching(true) // overlay terminal "CAMBIANDO DE VISTA" sobre el velo
    playGlitch(0.26) // "gota" glitch al pulsar (acompaña el impacto)
    fxRun.current?.(false) // velo + ripple de impacto
    window.setTimeout(() => setSatellite((s) => !s), 200) // deja subir el velo (170ms) antes de reconstruir → sin flash
    window.setTimeout(() => { if (satFxRef.current) { satFxRef.current = false; setSwitching(false); fxRun.current?.(true) } }, 3400) // red de seguridad
  }

  return (
    <div className="section mapa-sec">
      <div className={'mapa-wrap' + (full ? ' full' : '')}>
        <div className={'mapa-map mapa-3d' + (comparados.length ? ' comparing' : '') + (mShow ? ' ready' : '') + (satellite ? '' : ' mapa-vector')}>
          <div className="mapa-canvas" ref={elRef} />

          {/* Comparadores ANCLADOS al punto de su rival: cada carta sigue la posición en pantalla del marcador
              (map.project, recalculado en cada frame) con tamaño FIJO (no escala con el zoom) y SIEMPRE dentro
              del recuadro (clamp); un pico la une al punto. Pedido de Juan (24-jun: "anclados al punto"). */}
          {comparados.length > 0 && (
            <div className="cmp-layer">
              {/* conectores carta→punto (líneas + nodo hexagonal), pintados por positionCards en cada frame */}
              <svg className="cmp-leads" ref={leadsRef} aria-hidden="true" />
              {comparados.map((r) => (
                <div
                  className="cmp-anchor"
                  key={r.id}
                  ref={(el) => { cardRefs.current[r.id] = el }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Comparador rival={r} onLayout={() => { solveRef.current(); armRef.current() }} onClose={() => setComparados((prev) => prev.filter((p) => p.id !== r.id))} onSend={enviarCromo} />
                </div>
              ))}
            </div>
          )}

          {/* CAJÓN LATERAL de CROMOS (derecha): cartas FIFA/Pokémon enviadas, lado a lado en VS con gana-stat. */}
          <AnimatePresence>
            {enviadas.length > 0 && (() => {
              // gana-stat: mejor valor entre las enviadas (rating/reseñas = más alto; ticket/distancia = más bajo).
              const wins: Record<string, Record<string, boolean>> = {}
              if (enviadas.length >= 2) {
                const maxR = Math.max(...enviadas.map((r) => r.rating))
                const maxV = Math.max(...enviadas.map((r) => r.reviews))
                const minP = Math.min(...enviadas.map((r) => r.precio))
                const minD = Math.min(...enviadas.map((r) => r.d))
                for (const r of enviadas) wins[r.id] = { rating: r.rating === maxR, reviews: r.reviews === maxV, precio: r.precio === minP, d: r.d === minD }
              }
              return (
                <motion.aside
                  className="cromo-deck"
                  initial={{ x: 60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 60, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                >
                  <div className="cromo-deck-head">
                    <span className="cdh-title">◆ Mis cromos <em>{enviadas.length}</em></span>
                    {enviadas.length >= 2 && <span className="cdh-vs">VS · lidera el resaltado</span>}
                    <button className="cdh-clear" onClick={() => setEnviadas([])}>Vaciar</button>
                  </div>
                  <div className={'cromo-board cols' + Math.min(2, enviadas.length)}>
                    <AnimatePresence>
                      {enviadas.map((r, i) => (
                        <Cromo key={r.id} rival={r} rank={i + 1} wins={wins[r.id]} flash={flashId === r.id} onRemove={() => setEnviadas((p) => p.filter((x) => x.id !== r.id))} />
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.aside>
              )
            })()}
          </AnimatePresence>

          <div className="mapa-hud" aria-hidden="true" />

          {/* Onda glitch de TRANSICIÓN vector↔satélite: velo + ola de píxeles morados que barre y revela el nuevo estilo. */}
          <canvas className="mapa-fx" ref={fxRef} aria-hidden="true" />

          {/* Intro de cambio de vista (sobre el velo): terminal "CAMBIANDO DE VISTA…" + bits de HUD. Entra/sale con fade. */}
          <AnimatePresence>
            {switching && (
              <motion.div className="mapa-switch" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
                <span className="msw-corner tl" /><span className="msw-corner tr" /><span className="msw-corner bl" /><span className="msw-corner br" />
                <span className="msw-scan" />
                <div className="msw-term">
                  <span className="msw-line" style={{ '--i': 0 } as CSSProperties}>&gt; RECALIBRANDO SENSORES</span>
                  <span className="msw-line" style={{ '--i': 1 } as CSSProperties}>&gt; CAMBIANDO A <em>{switchTo}</em></span>
                  <span className="msw-line msw-prog" style={{ '--i': 2 } as CSSProperties}>&gt; <span className="msw-bar"><span /></span></span>
                  <span className="msw-line ok" style={{ '--i': 3 } as CSSProperties}>&gt; VISTA LISTA_</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* INTRO HACKER: tapa el instante en que las teselas aún cargan (los edificios funden por debajo) → no se
              ve el mapa "pelado" ni el pop. One-shot al entrar, se desvanece sola; oculta con reduced-motion (CSS). */}
          <div className={'mapa-hacker' + (booting ? '' : ' lifted')} aria-hidden="true">
            <span className="mh-scan" />
            <div className="mh-term">
              <span className="mh-line">&gt; INICIANDO PROTOCOLO REBELL</span>
              <span className="mh-line">&gt; ACCEDIENDO AL SISTEMA…</span>
              <span className="mh-line">&gt; ESCANEANDO ZONA · BERTAMIRÁNS</span>
              <span className="mh-line">&gt; TRIANGULANDO RIVALES [========] 100%</span>
              <span className="mh-line ok">&gt; ACCESO COMPLETADO_</span>
            </div>
          </div>

          {/* HUD superior estilo F1: zona + datos en vivo */}
          <div className={'map-hud-top' + (armed ? ' armed' : '')}>
            <div className="mht-title">
              <span className="mht-kick">Área de influencia{realData && <em className="mht-src">● Google en vivo</em>}</span>
              <b>Bertamiráns</b>
            </div>
            <div className="mht-stats">
              <div className="mht-stat">
                <span>Rivales</span>
                <b>{enRango.length}</b>
              </div>
              <div className="mht-stat">
                <span>Radio</span>
                <b>{fmtDist(radio)}</b>
              </div>
              <div className="mht-stat">
                <span>Tu rating</span>
                <b className="g">{LOCAL.rating.toFixed(1)}★</b>
              </div>
              <div className="mht-stat">
                <span><i className="mht-live" />OP · LIVE</span>
                <b className="mht-clock">{clock}</b>
              </div>
            </div>
          </div>

          {/* Slider de radio integrado en el HUD del mapa (abajo) */}
          <div className={'map-hud-radio' + (armed ? ' armed' : '')}>
            <span className="mhr-k">Radio</span>
            <input
              type="range"
              className="mhr-range"
              min={300}
              max={5000}
              step={50}
              value={radio}
              onChange={(e) => setRadio(+e.target.value)}
              onPointerUp={(e) => flyZoom(+(e.currentTarget as HTMLInputElement).value)}
              onKeyUp={(e) => flyZoom(+(e.currentTarget as HTMLInputElement).value)}
              style={{ ['--p' as string]: ((radio - 300) / 4700) * 100 + '%' } as CSSProperties}
            />
            <b className="mhr-val">{fmtDist(radio)}</b>
            <div className="mht-acts">
              <button
                className={'mht-act' + (comparados.length > 0 || enviadas.length > 0 ? ' on' : '')}
                onClick={compararTodos}
                disabled={!visibles.length}
              >{comparados.length > 0 || enviadas.length > 0 ? '✕ Limpiar' : '◎ Comparar todos'}</button>
              <button className={'mht-act' + (reparto ? ' on' : '')} onClick={() => { setReparto((r) => !r); play('pop', 0.4, 1.1) }}>🛵 Reparto</button>
              <button className={'mht-act' + (satellite ? ' on' : '')} onClick={toggleSat}>{satellite ? '◼ Vector' : '🛰 Satélite'}</button>
              <button className={'mht-act' + (heat ? ' on' : '')} onClick={() => { setHeat((h) => !h); play('pop', 0.4, 1.05) }}>✦ Calor</button>
              <button className={'mht-act' + (full ? ' on' : '')} onClick={() => { setFull((f) => !f); play('pop', 0.4, full ? 0.9 : 1.15) }}>{full ? '╳ Salir' : '⛶ Pantalla'}</button>
              <button className={'mht-act mht-cap' + (capturando ? ' on' : '')} onClick={capturarInteligencia} disabled={capturando}>{capturando ? '◌ Generando…' : '📸 Informe'}</button>
            </div>
          </div>

        </div>

        <aside className={'mapa-panel' + (armed ? ' armed' : '')}>
          <AnimatePresence>
            {alertas.length > 0 && (
              <motion.div className="mp-alertas" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="mp-al-head">
                  <motion.span className="mp-bell" initial={{ rotate: 0 }} animate={{ rotate: [0, -20, 15, -11, 7, 0] }} transition={{ duration: 0.9, ease: 'easeOut' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
                    </svg>
                  </motion.span>
                  <b>Alertas de rivales</b>
                  <span className="mp-al-count">{alertas.length}</span>
                </div>
                <div className="mp-al-list">
                  {alertas.map((a) => (
                    <button className="mp-al-item" key={a.id} onClick={() => abrirComparador(a)}>
                      <i className={'mp-al-dot ' + (a.rating < 4 ? 'bad' : 'promo')} />
                      <span>{a.rating < 4 ? `${a.name} ha bajado a ${a.rating.toFixed(1)}★` : `${a.name}: ${a.signal.txt}`}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 1 · TU POSICIÓN (HÉROE del panel): rank + gauge de rating + barra de dominancia */}
          <div className="mp-block mp-pos mp-hero">
            <span className="mp-kick"><span className="mp-emo">🎯</span>Tu posición en la zona</span>
            <div className="mp-pos-main">
              <div className="mp-rank">
                <span className="mp-rank-pos">#<CountValue value={String(pos)} /></span>
                <span className="mp-rank-of">de {zona.length}</span>
              </div>
              <RatingGauge value={LOCAL.rating} />
            </div>
            <div className="mp-dom">
              <div className="mp-dom-bar">
                <div className="mp-dom-you" style={{ width: dominancia + '%' }} />
              </div>
              <div className="mp-dom-legend">
                <span>TÚ <b><CountValue value={dominancia + '%'} /></b></span>
                <span className="r">RIVALES <b><CountValue value={100 - dominancia + '%'} /></b></span>
              </div>
            </div>
          </div>

          {/* 2 · INTELIGENCIA: mini-stats + ticker de señales + oportunidad (ya no prosa) */}
          <div className="mp-block mp-intel">
            <span className="mp-kick"><span className="mp-emo">📡</span>Inteligencia de la semana</span>
            <div className="mp-intel-stats">
              <div className="mp-ist"><b><CountValue value={String(enRango.length)} /></b><span>Rivales</span></div>
              <div className="mp-ist"><b className="r"><CountValue value={String(nPromos)} /></b><span>Promos</span></div>
              <div className="mp-ist"><b className="g"><CountValue value={String(nVirales)} /></b><span>Virales</span></div>
              <div className="mp-ist"><b className="o"><CountValue value={String(nResenas)} /></b><span>Reseñas</span></div>
            </div>
            {visibles.length > 0 && (
              <div className="mp-sig-feed">
                {visibles.slice(0, 4).map((r, i) => (
                  <button
                    className={'mp-sig-row' + (hot === r.id ? ' is-hot' : '')}
                    key={r.id}
                    style={{ ['--i' as string]: i } as CSSProperties}
                    onMouseEnter={() => setHot(r.id)}
                    onMouseLeave={() => setHot(null)}
                    onClick={() => abrirComparador(r)}
                  >
                    <span className={'mp-sig-tag s-' + r.signal.k}>{SIG_LABEL[r.signal.k]}</span>
                    <span className="mp-sig-txt"><b>{r.name.split(' ').slice(0, 2).join(' ')}</b> · {r.signal.txt}</span>
                  </button>
                ))}
              </div>
            )}
            {oport && (
              <div className="mp-oport">
                <span className="mp-oport-ic">◎</span>
                <div>
                  <b>Oportunidad</b>
                  <span>{oport.name} flojea → momento de captar a sus clientes</span>
                </div>
              </div>
            )}
          </div>

          {/* 3 · RIVALES por AMENAZA (medidor 0-100, ordenados, color por nivel) */}
          <div className="mp-block mp-threats">
            <span className="mp-kick"><span className="mp-emo">⚔️</span>Rivales por amenaza · pulsa para comparar</span>
            <div className="mp-threat-list">
              {visibles.map((r, i) => {
                const lvl = threatLvl(r.threat)
                return (
                  <button
                    className={'mp-tr' + (hot === r.id ? ' is-hot' : '')}
                    key={r.id}
                    onMouseEnter={() => setHot(r.id)}
                    onMouseLeave={() => setHot(null)}
                    onClick={() => abrirComparador(r)}
                  >
                    <span className="mp-tr-rank">{i + 1}</span>
                    <div className="mp-tr-body">
                      <div className="mp-tr-top">
                        <b>{r.name}</b>
                        <span className="mp-tr-meta">{r.rating.toFixed(1)}★ · {fmtDist(r.d)}</span>
                      </div>
                      <div className="mp-tr-bar">
                        <div className={'mp-tr-fill ' + lvl} style={{ width: r.threat + '%' }} />
                      </div>
                    </div>
                    <span
                      className={'mp-tr-num ' + lvl + (lvl === 'hi' ? ' beat' : '')}
                      style={lvl === 'hi' ? ({ ['--beat' as string]: 1.8 - (r.threat / 100) * 0.9 + 's' } as CSSProperties) : undefined}
                    >
                      <CountValue value={String(r.threat)} />
                    </span>
                  </button>
                )
              })}
              {!visibles.length && <div className="mp-empty">{enRango.length ? 'Ningún rival con este filtro' : 'Sin rivales en este radio'}</div>}
            </div>
          </div>

          {/* 4 · SLOTS LIBRES (huecos como badges de inventario) */}
          {huecos.length > 0 && (
            <div className="mp-block mp-gaps">
              <span className="mp-kick">Slots libres en {radioT}</span>
              <div className="mp-gap-wrap">
                {huecos.map((h, i) => (
                  <span className="mp-gap" key={h} style={{ ['--i' as string]: i } as CSSProperties}>
                    <b>{h}</b>
                    <i>LIBRE</i>
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="mp-demo-foot">Datos de demostración · con Google + IA serán reales y en vivo</p>
        </aside>
      </div>

    </div>
  )
}

/* Gauge circular (donut SVG) del rating — número grande + arco oro que se rellena (one-shot). */
function RatingGauge({ value, max = 5 }: { value: number; max?: number }) {
  const arc = useRef<SVGCircleElement>(null)
  const R = 25
  const C = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(1, value / max))
  useEffect(() => {
    const el = arc.current
    if (!el) return
    if (reduceMotion()) {
      el.style.strokeDashoffset = String(C * (1 - pct))
      return
    }
    gsap.fromTo(el, { strokeDashoffset: C }, { strokeDashoffset: C * (1 - pct), duration: 0.95, ease: 'power3.out', delay: 0.2 })
  }, [C, pct])
  return (
    <div className="mp-gauge">
      <svg viewBox="0 0 60 60">
        <circle className="mp-gauge-track" cx="30" cy="30" r={R} />
        <circle className="mp-gauge-arc" cx="30" cy="30" r={R} ref={arc} strokeDasharray={C} strokeDashoffset={C} transform="rotate(-90 30 30)" />
      </svg>
      <div className="mp-gauge-c">
        <b>{value.toFixed(1)}</b>
        <span>★</span>
      </div>
    </div>
  )
}

/* ── Comparador 1-a-1 (carta premium que se despliega como tarjeta 3D SOBRE el mapa:
   oscuro + glossy dorado + muesca orgánica + semitono + barras con glow, count-up GSAP). ── */
const METRICAS: { key: 'rating' | 'reviews' | 'precio'; label: string; max?: number; suf: string; dec: number; mejor: 'alto' | 'info' }[] = [
  { key: 'rating', label: 'Valoración', max: 5, suf: '★', dec: 1, mejor: 'alto' },
  { key: 'reviews', label: 'Nº de reseñas', suf: '', dec: 0, mejor: 'alto' },
  { key: 'precio', label: 'Ticket medio', suf: ' €', dec: 2, mejor: 'info' },
]

function Comparador({ rival, onClose, onLayout, onSend }: { rival: Rival & { d: number }; onClose: () => void; onLayout?: () => void; onSend?: (r: Rival & { d: number }) => void }) {
  const root = useRef<HTMLDivElement>(null)
  // Por defecto se muestra la INFO del rival; el modo COMPARACIÓN (vs tu local) se activa con un botón. (Juan 24-jun)
  const [mode, setMode] = useState<'info' | 'compare'>('info')
  const gano = METRICAS.filter((m) => m.mejor === 'alto').reduce((n, m) => n + ((LOCAL as never)[m.key] > (rival as never)[m.key] ? 1 : 0), 0)
  const totalAlto = METRICAS.filter((m) => m.mejor === 'alto').length

  useEffect(() => {
    const ctx = gsap.context(() => {
      root.current?.querySelectorAll<HTMLElement>('[data-count]').forEach((el, i) => {
        const to = parseFloat(el.dataset.count || '0')
        const dec = parseInt(el.dataset.dec || '0', 10)
        const suf = el.dataset.suf || ''
        const o = { v: 0 }
        gsap.to(o, {
          v: to,
          duration: 0.9,
          delay: 0.1 + Math.floor(i / 2) * 0.1,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = o.v.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf
          },
        })
      })
      gsap.fromTo(
        root.current?.querySelectorAll('.cmp-fill') || [],
        { width: '0%' },
        { width: (_i: number, el: Element) => (el as HTMLElement).dataset.w || '0%', duration: 0.9, delay: 0.2, ease: 'power3.out', stagger: 0.06 },
      )
    }, root)
    // La altura de la carta cambia al alternar Info/Comparar → avisa al padre para re-anclarla al punto.
    const raf = requestAnimationFrame(() => onLayout?.())
    return () => {
      ctx.revert()
      cancelAnimationFrame(raf)
    }
  }, [rival, mode, onLayout])

  // Reseñas con ORIGEN: las de Google son reales (Places); Glovo/Uber/Just Eat son muestra (sin API pública).
  const revList: PlaceReview[] = [...(rival.reviewsList ?? []), ...deliveryReviews(rival.id)]
    .map((rv) => ({ ...rv, source: rv.source || 'Google' })) // blindaje: nunca source vacío
    .slice(0, 5)

  return (
    <motion.div
      className="cmp-card cmp-3d cmp-anchored"
      ref={root}
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 210, damping: 26 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="cmp-head">
        <div className="cmp-head-dots" aria-hidden="true" />
        {onSend && <button className="cmp-head-send" onClick={() => onSend(rival)} title="Enviar a cromos">✦ Cromo</button>}
        {mode === 'info' ? (
          <>
            <span className="cmp-kicker">{rival.tipo} · {fmtDist(rival.d)}</span>
            <div className="cmp-names"><span className="cmp-n cmp-them cmp-solo">{rival.name}</span></div>
          </>
        ) : (
          <>
            <span className="cmp-kicker">Enfrentamiento · {fmtDist(rival.d)}</span>
            <div className="cmp-names">
              <span className="cmp-n cmp-you">{LOCAL.name.split('·')[0].trim()}</span>
              <span className="cmp-vs">VS</span>
              <span className="cmp-n cmp-them">{rival.name}</span>
            </div>
          </>
        )}
      </div>

      {mode === 'info' ? (
        <div className="cmp-body cmp-info">
          <div className="ci-stats">
            <div className="ci-stat"><b data-count={rival.rating} data-dec="1" data-suf="★">0</b><span>Valoración</span></div>
            <div className="ci-stat"><b data-count={rival.reviews} data-dec="0">0</b><span>Reseñas</span></div>
            <div className="ci-stat"><b data-count={rival.precio} data-dec="2" data-suf=" €">0</b><span>Ticket medio</span></div>
            <div className="ci-stat"><b>{fmtDist(rival.d)}</b><span>Distancia</span></div>
          </div>
          <div className={'ci-signal s-' + rival.signal.k}>
            <span className="ci-sig-tag">{SIG_LABEL[rival.signal.k]}</span>
            <span className="ci-sig-txt">{rival.signal.txt}</span>
          </div>
          {revList.length > 0 && (
            <div className="ci-reviews">
              <div className="ci-rev-h">Reseñas por plataforma</div>
              {revList.map((rv, i) => (
                <div className="ci-rev" key={i}>
                  <span className={'ci-rev-src ' + srcClass(rv.source)}>{rv.source}</span>
                  <div className="ci-rev-main">
                    <div className="ci-rev-top">
                      {rv.rating != null && (
                        <span className="ci-rev-stars" aria-label={`${rv.rating} estrellas`}>
                          <b>{'★'.repeat(Math.round(rv.rating))}</b>{'★'.repeat(Math.max(0, 5 - Math.round(rv.rating)))}
                        </span>
                      )}
                      {rv.when && <span className="ci-rev-when">{rv.when}</span>}
                    </div>
                    {rv.text && <div className="ci-rev-txt">{rv.text}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="cmp-body">
          {METRICAS.map((m) => {
            const lv = (LOCAL as never)[m.key] as number
            const rv = (rival as never)[m.key] as number
            const max = m.max ?? Math.max(lv, rv, 1)
            const youWin = m.mejor === 'alto' && lv >= rv
            const themWin = m.mejor === 'alto' && rv > lv
            return (
              <div className="cmp-metric" key={m.key}>
                <div className="cmp-m-label">{m.label}</div>
                <div className="cmp-rows">
                  <div className={'cmp-row' + (youWin ? ' win' : '')}>
                    <span className="cmp-side">Tú</span>
                    <div className="cmp-track"><div className="cmp-fill you" data-w={`${Math.max(4, (lv / max) * 100)}%`} /></div>
                    <b className="cmp-val" data-count={lv} data-dec={m.dec} data-suf={m.suf}>0</b>
                  </div>
                  <div className={'cmp-row' + (themWin ? ' win them' : '')}>
                    <span className="cmp-side">{rival.name.split(' ')[0]}</span>
                    <div className="cmp-track"><div className="cmp-fill them" data-w={`${Math.max(4, (rv / max) * 100)}%`} /></div>
                    <b className="cmp-val" data-count={rv} data-dec={m.dec} data-suf={m.suf}>0</b>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="cmp-foot">
        <span className="cmp-verdict">
          {mode === 'compare'
            ? gano > totalAlto - gano ? `Ganas en ${gano} de ${totalAlto}` : gano === totalAlto - gano ? 'Empate técnico' : `Te superan en ${totalAlto - gano} de ${totalAlto}`
            : rival.tipo}
        </span>
        <div className="cmp-foot-btns">
          <button className="cmp-mode" onClick={() => setMode((m) => (m === 'info' ? 'compare' : 'info'))}>
            {mode === 'info' ? '⚔ Comparar' : '◁ Info'}
          </button>
          <button className="cmp-close" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </motion.div>
  )
}

// ── CROMOS · cartas coleccionables tipo FIFA/Pokémon de cada rival ────────────────────────────
// Juan 25-jun: "botón enviar → vista lateral derecha para comparar varias, como cromos/cartas Pokémon".
const TIPO_EMOJI: Record<string, string> = {
  Hamburguesería: '🍔', 'Fast food': '🍔', Pizzería: '🍕', Parrillada: '🥩', Asador: '🥩',
  Barbacoa: '🍖', Kebab: '🥙', Restaurante: '🍽️',
}
const tipoEmoji = (t: string) => TIPO_EMOJI[t] || '🍽️'
// Rareza por NOTA (estilo FIFA: oro/plata/bronce). El holo es más fuerte cuanto mejor la carta.
function rarezaDe(rating: number): { tier: 'oro' | 'plata' | 'bronce'; label: string } {
  if (rating >= 4.5) return { tier: 'oro', label: 'Legendario' }
  if (rating >= 4.2) return { tier: 'plata', label: 'Épico' }
  return { tier: 'bronce', label: 'Raro' }
}

function Cromo({ rival, rank, wins, flash, onRemove }: { rival: Rival & { d: number }; rank?: number; wins?: Record<string, boolean>; flash?: boolean; onRemove?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const rz = rarezaDe(rival.rating)
  // FOIL HOLOGRÁFICO + tilt 3D: el brillo y la inclinación siguen al ratón (vars CSS, sin re-render).
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current; if (!el) return
    const b = el.getBoundingClientRect()
    const mx = ((e.clientX - b.left) / b.width) * 100
    const my = ((e.clientY - b.top) / b.height) * 100
    el.style.setProperty('--mx', mx.toFixed(1) + '%')
    el.style.setProperty('--my', my.toFixed(1) + '%')
    el.style.setProperty('--rx', ((50 - my) / 18).toFixed(2) + 'deg') // inclina arriba/abajo (sutil)
    el.style.setProperty('--ry', ((mx - 50) / 15).toFixed(2) + 'deg') // inclina izq/dcha (sutil)
  }
  const onLeave = () => {
    const el = ref.current; if (!el) return
    el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--mx', '50%'); el.style.setProperty('--my', '38%')
  }
  return (
    <motion.div
      ref={ref}
      className={'cromo r-' + rz.tier + (flash ? ' cromo-flash' : '')}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 14, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      layout
    >
      <div className="cromo-inner">
        <div className="cromo-foil" aria-hidden="true" />
        {onRemove && <button className="cromo-x" onClick={onRemove} aria-label="Quitar de la comparación">✕</button>}
        <div className="cromo-top">
          {rank != null && <span className="cromo-rank">#{rank}</span>}
        </div>
        <div className="cromo-portrait">
          <span className="cromo-emoji" aria-hidden="true">{tipoEmoji(rival.tipo)}</span>
          <div className={'cromo-rating' + (wins?.rating ? ' win' : '')}>
            <b>{rival.rating.toFixed(1)}</b><i>★</i>
          </div>
        </div>
        <div className="cromo-name" title={rival.name}>{rival.name}</div>
        <div className="cromo-sub">{rival.tipo}</div>
        <div className="cromo-stats">
          <div className={'cromo-st' + (wins?.reviews ? ' win' : '')}><b>{rival.reviews.toLocaleString('es-ES')}</b><span>Reseñas</span></div>
          <div className={'cromo-st' + (wins?.precio ? ' win' : '')}><b>{rival.precio.toFixed(0)}€</b><span>Ticket</span></div>
          <div className={'cromo-st' + (wins?.d ? ' win' : '')}><b>{fmtDist(rival.d)}</b><span>Distancia</span></div>
        </div>
      </div>
    </motion.div>
  )
}
