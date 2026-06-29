import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { gsap } from 'gsap'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { CountValue } from '../components/ui'
import { play, playBeast, playLock, playSweep, playGlitch, setCountMuted } from '../lib/sound'
import { reduceMotion } from '../lib/data'
import { usePower } from '../lib/power'
import { fetchRivalsCached, type PlaceReview, type PlaceRival } from '../lib/places'
import { LOCAL } from '../lib/local'
import { isDemoMode } from '../lib/demo'

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
// Lista ACTIVA de rivales (mutable). En DEMO arranca con la demo (escaparate). En REAL arranca VACÍA:
// solo se llena con los REALES de Google Places; si Places falla NO caemos a la demo → estado vacío honesto.
let RIVALES: Rival[] = isDemoMode() ? DEMO_RIVALES : []
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
  const demo = isDemoMode() // DEMO = escaparate con datos de ejemplo · REAL = solo dato real o estado vacío honesto
  const { saver: powerSaver } = usePower() // Salón frío → mapa PLANO (satélite sin 3D) para ahorrar GPU/batería
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const loadedRef = useRef(false)
  const anchorRef = useRef(false) // true tras el vuelo de entrada → la rotación orbita el local
  const isoLoadedRef = useRef(false) // isócronas de reparto ya pedidas (no repetir)
  const rivalMarks = useRef<{ r: Rival; el: HTMLElement }[]>([]) // refs para mostrar/ocultar por radio
  const comparadosRef = useRef<(Rival & { d: number })[]>([]) // lista viva (los handlers imperativos de marcadores capturan closures viejos)
  const visRef = useRef<(Rival & { d: number; threat: number })[]>([]) // rivales visibles (radio + filtro), con amenaza
  const radioRef = useRef(1000) // radio actual accesible desde el sonar/teclado
  const kbdRef = useRef<{ focus: (n: number) => void; cycle: () => void; step: (d: number) => void }>({ focus: () => {}, cycle: () => {}, step: () => {} })
  const [radio, setRadio] = useState(1000)
  // Comparadores ABIERTOS: tarjetas GRANDES que OCUPAN el recuadro del mapa. Máximo 2 (1 = a pantalla
  // completa del mapa; 2 = mitad y mitad, responsive). Al abrir un 3º reemplaza al más antiguo. (Juan 28-jun)
  const MAX_CMP = 2
  const [comparados, setComparados] = useState<(Rival & { d: number })[]>([])
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
    // La tarjeta OCUPA el recuadro del mapa. Máximo 2 (al abrir un 3º, sale el más antiguo → siempre las 2 últimas).
    const next = [...cur, r].slice(-MAX_CMP)
    const primero = cur.length === 0 // solo ruge al abrir el PRIMERO (evita cacofonía con varios)
    setComparados(next)
    setHot(r.id) // fija objetivo → enciende su nodo y su línea en el mapa
    playLock(0.45) // "tlk-tlk" de lock-on
    if (primero) playBeast('lion', 0.55) // rugido SOLO al primer enfrentamiento
    play('pop', 0.5, 1.32)
    // LOCK-ON: el nodo se "arma" (retículo) antes de que la tarjeta lo tape
    const mk = rivalMarks.current.find((m) => m.r.id === r.id)
    if (mk && !reduceMotion()) {
      mk.el.classList.add('locking')
      window.setTimeout(() => mk.el.classList.remove('locking'), 640)
    }
  }
  // Botón de acción: si hay tarjetas abiertas → "Cerrar" (vacía); si no → abre las 2 rivales de MAYOR AMENAZA.
  const compararTodos = () => {
    if (comparados.length > 0) { setComparados([]); setHot(null); play('pop', 0.4, 0.9); return }
    const vis = visRef.current
    if (!vis.length) return
    const top = [...vis].sort((a, b) => b.threat - a.threat).slice(0, MAX_CMP).map((r) => ({ ...r }))
    setComparados(top)
    setHot(top[0]?.id ?? null)
    playLock(0.4)
    if (!reduceMotion()) playBeast('lion', 0.5)
    play('pop', 0.5, 1.12)
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
      } else if (RIVALES.length && RIVALES !== DEMO_RIVALES) {
        setRealData(true) // reconstrucción por tema: ya teníamos los reales cargados
      }
      // REAL sin Places (falló / sin config): RIVALES queda VACÍA → NO caemos a la demo. El panel
      // muestra el estado vacío honesto ("Sin datos de zona aún") y la badge "Google en vivo" no sale.

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

  // Pinchar FUERA del mapa → cerrar las tarjetas abiertas. Solo escucha mientras haya tarjetas abiertas.
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

  // Sync de la lista viva: los handlers imperativos de los marcadores capturan closures viejos → leen este ref.
  comparadosRef.current = comparados

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

  // ── LECTURA LLANA + JUGADAS (acción): los mismos datos, traducidos a "dónde estás" y "qué haces". El
  //    no-experto no interpreta "amenaza 78" → aquí se lo decimos en cristiano. (Juan: comprensible para cualquiera)
  const short = (s: string) => s.split(' ').slice(0, 2).join(' ') // nombre corto del rival
  const mejoresQueTu = enRango.filter((r) => r.rating > LOCAL.rating).length
  const lider = [...enRango].sort((a, b) => b.rating - a.rating)[0]
  const masBarato = [...enRango].sort((a, b) => a.precio - b.precio)[0]
  // Posición en una frase (solo demo: en real aún no hay rating propio del local).
  const posRead = mejoresQueTu === 0
    ? 'Eres el mejor valorado de tu zona. Mantén el nivel y aprovéchalo.'
    : `Te superan en valoración ${mejoresQueTu} de ${enRango.length}. Tu mejor palanca para subir: más reseñas buenas.`
  type Jugada = { ic: string; txt: string }
  const jugadas: Jugada[] = []
  if (demo && lider && lider.rating > LOCAL.rating)
    jugadas.push({ ic: '⭐', txt: `Acorta con ${short(lider.name)} (${lider.rating.toFixed(1)}★): pide reseña a tus clientes contentos.` })
  if (oport)
    jugadas.push({ ic: '◎', txt: `Capta a clientes de ${short(oport.name)}: es quien peor valoración tiene cerca.` })
  if (huecos.length)
    jugadas.push({ ic: '🧩', txt: `Hueco de ${huecos[0].toLowerCase()} en tu radio: nadie lo ofrece, podrías ser el primero.` })
  if (demo && masBarato && masBarato.precio < LOCAL.precio * 0.85)
    jugadas.push({ ic: '🛡️', txt: `${short(masBarato.name)} va barato (${masBarato.precio.toFixed(0)}€): no entres en guerra de precios, diferénciate.` })
  const jugadasTop = jugadas.slice(0, 2)

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
      // REAL: rating/dominancia salen del LOCAL de partida (no es dato real del tenant) → no inventamos
      // cifras en el informe; mostramos "—". En DEMO va el escaparate completo como hasta ahora.
      ctx.fillStyle = INK; ctx.font = '800 64px "Clash Grotesk", Inter, sans-serif'
      ctx.fillText(demo ? `#${pos}` : '—', 76, y + 104)
      if (demo) {
        ctx.fillStyle = MUT; ctx.font = '600 24px Inter, sans-serif'
        ctx.fillText(`de ${zona.length}`, 76 + ctx.measureText(`#${pos}`).width + 18, y + 104)
      }
      ctx.textAlign = 'right'
      ctx.fillStyle = INK; ctx.font = '800 40px "Clash Grotesk", Inter, sans-serif'
      ctx.fillText(demo ? `${LOCAL.rating.toFixed(1)}★` : '—', W - 76, y + 70)
      if (demo) {
        ctx.fillStyle = '#34d399'; ctx.font = '700 22px Inter, sans-serif'
        ctx.fillText(`${dominancia}% dominancia`, W - 76, y + 104)
      }
      ctx.textAlign = 'left'
      // 4) RIVALES (por amenaza)
      y += 132 + 36
      ctx.fillStyle = GOLD; ctx.font = '800 18px Inter, sans-serif'
      ctx.fillText('RIVALES · ORDENADOS POR AMENAZA', 56, y)
      y += 22
      const TH: Record<string, [string, string]> = { hi: ['#ff5c5c', 'ALTA'], mid: ['#f5b341', 'MEDIA'], lo: ['#34d399', 'BAJA'] }
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

          {/* Tarjetas de competidor: OCUPAN el recuadro del mapa (Juan 28-jun: "que ocupen todo el recuadro").
              1 abierta = a pantalla completa del mapa · 2 = mitad y mitad (responsive). Overlay en rejilla. */}
          <AnimatePresence>
            {comparados.length > 0 && (
              <motion.div
                className={'cmp-stage cols-' + comparados.length}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {comparados.map((r) => (
                  <Comparador
                    key={r.id}
                    rival={r}
                    solo={comparados.length === 1}
                    demo={demo}
                    onClose={() => { setComparados((prev) => prev.filter((p) => p.id !== r.id)); play('pop', 0.4, 0.9) }}
                  />
                ))}
              </motion.div>
            )}
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
                <b className="g">{demo ? `${LOCAL.rating.toFixed(1)}★` : '—'}</b>
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
                className={'mht-act' + (comparados.length > 0 ? ' on' : '')}
                onClick={compararTodos}
                disabled={!visibles.length}
              >{comparados.length > 0 ? '✕ Cerrar' : '⚔ Comparar 2 top'}</button>
              <button className={'mht-act' + (reparto ? ' on' : '')} onClick={() => { setReparto((r) => !r); play('pop', 0.4, 1.1) }}>🛵 Reparto</button>
              <button className={'mht-act' + (satellite ? ' on' : '')} onClick={toggleSat}>{satellite ? '◼ Vector' : '🛰 Satélite'}</button>
              <button className={'mht-act' + (heat ? ' on' : '')} onClick={() => { setHeat((h) => !h); play('pop', 0.4, 1.05) }}>✦ Calor</button>
              <button className={'mht-act' + (full ? ' on' : '')} onClick={() => { setFull((f) => !f); play('pop', 0.4, full ? 0.9 : 1.15) }}>{full ? '╳ Salir' : '⛶ Pantalla'}</button>
              <button className={'mht-act mht-cap' + (capturando ? ' on' : '')} onClick={capturarInteligencia} disabled={capturando}>{capturando ? '◌ Generando…' : '📸 Informe'}</button>
            </div>
          </div>

        </div>

        <aside className={'mapa-panel' + (armed ? ' armed' : '')}>
          {/* COLUMNA "TÚ": tu posición → tu jugada → alertas (alturas naturales, columnas independientes) */}
          <div className="mp-col">
          {/* 1 · TU POSICIÓN (HÉROE del panel): rank + gauge de rating + barra de dominancia.
              REAL: el rating/precio del LOCAL aún es el de partida (no es dato real del tenant) → no
              calculamos posición/dominancia contra cifras falsas; mostramos un estado vacío honesto. */}
          <div className="mp-block mp-pos mp-hero">
            <span className="mp-kick"><span className="mp-emo">🎯</span>Tu posición en la zona</span>
            {demo ? (
              <>
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
                  <span className="mp-cap">% de rivales a los que igualas o superas en valoración</span>
                </div>
                <p className="mp-read">{posRead}</p>
              </>
            ) : (
              <div className="vtpv-empty">Añade el rating real de tu local para ver tu posición</div>
            )}
          </div>

          {/* 1b · TU JUGADA (acción en lenguaje llano): traduce la inteligencia a QUÉ HACER esta semana. */}
          {jugadasTop.length > 0 && (
            <div className="mp-block mp-jugada">
              <span className="mp-kick"><span className="mp-emo">🎯</span>Tu jugada de la semana</span>
              <div className="mp-play-list">
                {jugadasTop.map((j, i) => (
                  <div className="mp-play" key={i}>
                    <span className="mp-play-ic">{j.ic}</span>
                    <span className="mp-play-txt">{j.txt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alertas de rivales (columna TÚ) */}
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
          </div>{/* /mp-col · TÚ */}

          {/* COLUMNA "ELLOS": inteligencia → rivales por amenaza */}
          <div className="mp-col">
          {/* 2 · INTELIGENCIA: mini-stats + ticker de señales */}
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
          </div>

          {/* 3 · RIVALES por AMENAZA (medidor 0-100, ordenados, color por nivel) */}
          <div className="mp-block mp-threats">
            <span className="mp-kick"><span className="mp-emo">⚔️</span>Rivales por amenaza · pulsa para comparar</span>
            <span className="mp-cap mp-cap-block">Amenaza = cerca de ti + mejor valorado + más barato + con movimiento</span>
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
              {!visibles.length && <div className="mp-empty">{enRango.length ? 'Ningún rival con este filtro' : !demo && !realData ? 'Sin datos de zona aún' : 'Sin rivales en este radio'}</div>}
            </div>
          </div>
          </div>{/* /mp-col · ELLOS */}

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

          {demo ? (
            <p className="mp-demo-foot">Datos de demostración · con Google + IA serán reales y en vivo</p>
          ) : realData ? (
            <p className="mp-demo-foot">Rivales en vivo desde Google · tus datos los completas en tu ficha</p>
          ) : (
            <p className="mp-demo-foot">Sin datos de zona aún · conecta Google Places para ver a tus rivales</p>
          )}
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

function Comparador({ rival, onClose, solo, demo }: { rival: Rival & { d: number }; onClose: () => void; solo?: boolean; demo?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  // Una sola vista RICA: stats del rival + enfrentamiento VS tu local + reseñas. La tarjeta OCUPA su celda del
  // recuadro (1 = todo el mapa; 2 = mitad). Sin toggle ni cromos: toda la inteligencia útil de un vistazo. (Juan 28-jun)
  const altas = METRICAS.filter((m) => m.mejor === 'alto')
  const gano = altas.reduce((n, m) => n + ((LOCAL as never)[m.key] >= (rival as never)[m.key] ? 1 : 0), 0)
  const totalAlto = altas.length
  const verdict = gano > totalAlto - gano ? `Ganas en ${gano} de ${totalAlto}` : gano === totalAlto - gano ? 'Empate técnico' : `Te superan en ${totalAlto - gano} de ${totalAlto}`

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
          delay: 0.1 + Math.floor(i / 2) * 0.08,
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
    return () => ctx.revert()
  }, [rival])

  // Reseñas con ORIGEN: las de Google son reales (Places). Las de Glovo/Uber/Just Eat son SINTÉTICAS
  // (sin API pública) → solo en DEMO. En REAL mostramos únicamente las reseñas reales de Google.
  const revList: PlaceReview[] = [...(rival.reviewsList ?? []), ...(demo ? deliveryReviews(rival.id) : [])]
    .map((rv) => ({ ...rv, source: rv.source || 'Google' })) // blindaje: nunca source vacío
    .slice(0, solo ? 5 : 3)

  return (
    <motion.div
      className={'cmp-card cmp-big' + (solo ? ' cmp-solo-card' : '')}
      ref={root}
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 240, damping: 28 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="cmp-head">
        <button className="cmp-x" onClick={onClose} aria-label="Cerrar">✕</button>
        <span className="cmp-kicker">{rival.tipo} · a {fmtDist(rival.d)}</span>
        <h3 className="cmp-title">{rival.name}</h3>
        <div className={'cmp-signal s-' + rival.signal.k}>
          <span className="cmp-sig-tag">{SIG_LABEL[rival.signal.k]}</span>
          <span className="cmp-sig-txt">{rival.signal.txt}</span>
        </div>
      </div>

      <div className="cmp-body">
        {/* Stats clave del rival (count-up) */}
        <div className="ci-stats">
          <div className="ci-stat"><b data-count={rival.rating} data-dec="1" data-suf="★">0</b><span>Valoración</span></div>
          <div className="ci-stat"><b data-count={rival.reviews} data-dec="0">0</b><span>Reseñas</span></div>
          <div className="ci-stat"><b data-count={rival.precio} data-dec="2" data-suf=" €">0</b><span>Ticket medio</span></div>
          <div className="ci-stat"><b>{fmtDist(rival.d)}</b><span>Distancia</span></div>
        </div>

        {/* Enfrentamiento VS tu local: barras Tú/Ellos con el ganador resaltado.
            REAL: tu rating/reseñas/ticket aún es el de partida (no dato real del tenant) → no enfrentamos
            contra cifras falsas; ocultamos el duelo hasta que haya datos reales del local. */}
        {demo && (
        <div className="cmp-duel">
          <div className="cmp-duel-head"><b>{LOCAL.name.split('·')[0].trim()}</b><span className="cmp-duel-x">VS</span><b className="them">{rival.name.split(' ').slice(0, 2).join(' ')}</b></div>
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
          <div className="cmp-verdict">{verdict}</div>
        </div>
        )}

        {/* Reseñas por plataforma (Google real + delivery muestra) */}
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
    </motion.div>
  )
}
