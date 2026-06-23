import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { gsap } from 'gsap'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { SectionHeader, Badge } from '../components/ui'
import { play, playBeast } from '../lib/sound'

/* Mapa de Incidencia — rastrea la competencia de tu zona en un mapa 3D estilo
   videojuego (MapLibre GL: edificios extruidos, vista inclinada, vuelo cinematográfico),
   con radio configurable, marcadores-carta por rival y un "Radar IA" del semana. v1 con
   datos de DEMO; con Google Places + Edge Function (Claude) pasarán a ser reales y en vivo.
   Motor sin token (CARTO dark vector, gratis). Con el token de Mapbox se sube a su estilo
   premium. Diseño REBELL (oro sobre casi-negro), no el del panel del socio. */

const LOCAL = { name: 'REBELL · Homeburger', lat: 42.8378, lng: -8.611, rating: 4.6, reviews: 312, precio: 13.5 }

type Signal = { k: 'reseña' | 'promo' | 'noticia' | 'social'; txt: string }
type Rival = { id: string; name: string; tipo: string; lat: number; lng: number; rating: number; reviews: number; precio: number; signal: Signal }

const RIVALES: Rival[] = [
  { id: 'r1', name: 'Burger Brothers', tipo: 'Hamburguesería', lat: 42.8401, lng: -8.6075, rating: 4.2, reviews: 188, precio: 12.0, signal: { k: 'reseña', txt: 'Nueva reseña 5★: «las mejores patatas de la zona»' } },
  { id: 'r2', name: 'La Casa de las Burgers', tipo: 'Hamburguesería', lat: 42.8345, lng: -8.6152, rating: 3.9, reviews: 241, precio: 8.9, signal: { k: 'promo', txt: 'Lanzaron menú a 8,90 € (Instagram)' } },
  { id: 'r3', name: "McDonald's Bertamiráns", tipo: 'Fast food', lat: 42.842, lng: -8.619, rating: 4.0, reviews: 1502, precio: 7.5, signal: { k: 'noticia', txt: 'Reforma del local anunciada (prensa local)' } },
  { id: 'r4', name: 'Pizzería Nápoles', tipo: 'Pizzería', lat: 42.8312, lng: -8.6068, rating: 4.4, reviews: 97, precio: 11.0, signal: { k: 'reseña', txt: '2 reseñas negativas esta semana' } },
  { id: 'r5', name: 'Kebab Estrella', tipo: 'Kebab', lat: 42.8389, lng: -8.621, rating: 4.1, reviews: 64, precio: 8.0, signal: { k: 'social', txt: 'Vídeo viral en TikTok (12k visualizaciones)' } },
]

// Universo de categorías para detectar "tu hueco en la zona" (qué falta en el radio).
const CATEGORIAS = ['Smash burger premium', 'Pizzería', 'Kebab', 'Sushi / Poke', 'Tacos / Mexicano', 'Pollo frito', 'Healthy / Bowls', 'Heladería artesana']
const ALIAS: Record<string, string> = { Hamburguesería: 'Smash burger premium', 'Fast food': 'Smash burger premium' }

const RADIOS = [
  { k: 500, t: '500 m' },
  { k: 1000, t: '1 km' },
  { k: 2000, t: '2 km' },
  { k: 5000, t: '5 km' },
]

const SIG_LABEL: Record<Signal['k'], string> = { reseña: 'Reseña', promo: 'Promo', noticia: 'Noticia', social: 'Redes' }

// Estilo vectorial oscuro gratis (sin token). Si hay token de Mapbox en el entorno
// (VITE_MAPBOX_TOKEN), usa su estilo premium dark-v11 (lo que eligió Juan).
const MAPBOX_TOKEN = (import.meta.env as Record<string, string | undefined>).VITE_MAPBOX_TOKEN
const MAP_STYLE = MAPBOX_TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11?access_token=${MAPBOX_TOKEN}`
  : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

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
const zoomFor = (m: number) => (m <= 500 ? 16.2 : m <= 1000 ? 15.4 : m <= 2000 ? 14.7 : 13.4)

export default function MapaIncidencia() {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const loadedRef = useRef(false)
  const [radio, setRadio] = useState(2000)
  const [comparar, setComparar] = useState<(Rival & { d: number }) | null>(null)

  const abrirComparador = (r: Rival & { d: number }) => {
    setComparar(r)
    play('pop', 0.5, 1.18)
  }
  // Puente para abrir el comparador desde los marcadores imperativos del mapa.
  const openRef = useRef<((r: Rival) => void) | null>(null)
  openRef.current = (r) => abrirComparador({ ...r, d: distM(LOCAL.lat, LOCAL.lng, r.lat, r.lng) })

  // Inicializa el mapa 3D una vez.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: elRef.current,
      style: MAP_STYLE,
      center: [LOCAL.lng, LOCAL.lat],
      zoom: 12.4,
      pitch: 60,
      bearing: -17,
      attributionControl: false,
      maxPitch: 70,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')

    // El contenedor puede crecer tras el primer paint (layout/fuentes) → el canvas se
    // quedaría pequeño y en negro. Un ResizeObserver fuerza el resize al tamaño real.
    const ro = new ResizeObserver(() => map.resize())
    if (elRef.current) ro.observe(elRef.current)

    map.on('load', () => {
      loadedRef.current = true

      // Edificios 3D extruidos (la fuente vectorial CARTO trae la capa 'building').
      try {
        const layers = map.getStyle().layers || []
        const labelLayer = layers.find((l) => l.type === 'symbol')?.id
        map.addLayer(
          {
            id: 'rebell-3d-buildings',
            type: 'fill-extrusion',
            source: 'carto',
            'source-layer': 'building',
            minzoom: 12,
            paint: {
              // tinte cálido (oro) en los edificios altos = look videojuego
              'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, '#181820', 24, '#262630', 70, '#3a3326', 140, '#4a3d22'],
              // altura EXAGERADA (×2.6) para dar relieve aunque el pueblo sea bajo
              'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 14.5, ['*', ['coalesce', ['get', 'render_height'], 8], 2.6], 17, ['*', ['coalesce', ['get', 'render_height'], 8], 3]],
              'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
              'fill-extrusion-opacity': 0.95,
            },
          },
          labelLayer,
        )
      } catch {
        /* si la fuente/capa no existe en el estilo, el mapa base sigue funcionando */
      }

      // Cielo/atmósfera para el horizonte 3D (si lo soporta el estilo).
      try {
        ;(map as unknown as { setSky?: (s: unknown) => void }).setSky?.({
          'sky-color': '#0a0a12',
          'horizon-color': '#1a160b',
          'fog-color': '#0b0b0e',
          'fog-ground-blend': 0.5,
          'sky-horizon-blend': 0.6,
        })
      } catch {
        /* sin sky en este estilo */
      }

      // Radio: capa de relleno + anillo con glow (GeoJSON que se actualiza al cambiar).
      map.addSource('rebell-radio', { type: 'geojson', data: circlePolygon(LOCAL.lat, LOCAL.lng, radio) })
      map.addLayer({ id: 'rebell-radio-fill', type: 'fill', source: 'rebell-radio', paint: { 'fill-color': '#ffbf10', 'fill-opacity': 0.05 } })
      map.addLayer({ id: 'rebell-radio-line', type: 'line', source: 'rebell-radio', paint: { 'line-color': '#ffbf10', 'line-width': 1.6, 'line-opacity': 0.65, 'line-blur': 1.2 } })

      // Marcador héroe (tu local) con aura.
      const heroEl = document.createElement('div')
      heroEl.className = 'm3-hero'
      heroEl.innerHTML = `<span class="m3-aura"></span><span class="m3-core"><b>${LOCAL.rating.toFixed(1)}</b><i>TÚ</i></span>`
      new maplibregl.Marker({ element: heroEl, anchor: 'bottom' }).setLngLat([LOCAL.lng, LOCAL.lat]).addTo(map)

      // Marcadores-carta de cada rival.
      RIVALES.forEach((r) => {
        const el = document.createElement('button')
        el.className = 'm3-card'
        el.type = 'button'
        el.innerHTML = `<span class="m3-rt">${r.rating.toFixed(1)}★</span><span class="m3-pr">${r.precio.toFixed(0)}€</span><span class="m3-stem"></span>`
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          openRef.current?.(r)
        })
        new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([r.lng, r.lat]).addTo(map)
      })

      // Asegura el tamaño correcto antes de volar (evita el canvas en negro).
      map.resize()
      window.setTimeout(() => map.resize(), 300)
      // Entrada cinematográfica: vuela hasta el encuadre del radio.
      map.flyTo({ center: [LOCAL.lng, LOCAL.lat], zoom: zoomFor(radio), pitch: 60, bearing: -17, duration: 2400, essential: true })
    })

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      loadedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Al cambiar el radio: actualiza el círculo y vuela al nuevo encuadre.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const src = map.getSource('rebell-radio') as maplibregl.GeoJSONSource | undefined
    src?.setData(circlePolygon(LOCAL.lat, LOCAL.lng, radio) as never)
    map.flyTo({ center: [LOCAL.lng, LOCAL.lat], zoom: zoomFor(radio), pitch: 60, duration: 1300, essential: true })
  }, [radio])

  const enRango = RIVALES.map((r) => ({ ...r, d: distM(LOCAL.lat, LOCAL.lng, r.lat, r.lng) }))
    .filter((r) => r.d <= radio)
    .sort((a, b) => a.d - b.d)

  // Alertas: rival con rating < 4 o que lanzó promo → reacciona el mismo día.
  const alertas = enRango.filter((r) => r.rating < 4 || r.signal.k === 'promo')
  // Tu hueco en la zona: categorías sin ningún rival en el radio = oportunidades.
  const presentes = new Set(enRango.map((r) => ALIAS[r.tipo] || r.tipo))
  const huecos = CATEGORIAS.filter((c) => !presentes.has(c)).slice(0, 3)
  const radioT = RADIOS.find((r) => r.k === radio)?.t

  return (
    <div className="section mapa-sec">
      <SectionHeader
        title="Mapa de Incidencia"
        subtitle="Rastrea a tu competencia en la zona"
        right={
          <div className="mapa-radios">
            <span className="mr-k">Radio</span>
            {RADIOS.map((r) => (
              <button key={r.k} className={'mr-opt' + (radio === r.k ? ' on' : '')} onClick={() => { setRadio(r.k); play('tap') }}>
                {r.t}
              </button>
            ))}
          </div>
        }
      />

      <div className="mapa-wrap">
        <div className="mapa-map mapa-3d">
          <div className="mapa-canvas" ref={elRef} />
          <div className="mapa-hud" aria-hidden="true" />
          <div className="mapa-scan" aria-hidden="true" />
        </div>

        <aside className="mapa-panel">
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

          <div className="mp-local">
            <div className="mp-loc-l">
              <b>{LOCAL.name}</b>
              <small>Tu local</small>
            </div>
            <div className="mp-rating">
              <span className="mp-stars">★ {LOCAL.rating}</span>
              <small>{LOCAL.reviews} reseñas</small>
            </div>
          </div>

          <div className="mp-radar">
            <div className="mp-radar-head">
              <span className="mp-radar-ic">✦</span>
              <b>Radar de rivales</b>
              <Badge tone="gold">Semana</Badge>
            </div>
            <p>
              Esta semana en tu radio de {RADIOS.find((r) => r.k === radio)?.t}: <b>Burger Brothers</b> sube a 4,2★ con buenas reseñas de sus patatas; <b>La Casa de las Burgers</b> ataca en precio con un menú a 8,90 €; <b>Kebab Estrella</b> se ha hecho viral en TikTok.{' '}
              <span className="mp-op">Oportunidad: Pizzería Nápoles acumula 2 reseñas negativas → buen momento para captar a sus clientes.</span>
            </p>
            <small className="mp-demo">Datos de demostración · con la conexión a Google + IA serán reales y en vivo</small>
          </div>

          {huecos.length > 0 && (
            <div className="mp-hueco">
              <div className="mp-hueco-head">
                <span className="mp-hueco-ic">◎</span>
                <b>Tu hueco en la zona</b>
              </div>
              <div className="mp-hueco-list">
                {huecos.map((h) => (
                  <div className="mp-hueco-item" key={h}>
                    <b>{h}</b>
                    <span>Nadie lo ofrece en {radioT} → tu oportunidad</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mp-list-h">
            {enRango.length} {enRango.length === 1 ? 'rival' : 'rivales'} en tu radio · pulsa para comparar
          </div>
          <div className="mp-list">
            {enRango.map((r) => (
              <button className="mp-rival" key={r.id} onClick={() => abrirComparador(r)}>
                <div className="mp-rival-top">
                  <b>{r.name}</b>
                  <span className="mp-rstars">★ {r.rating}</span>
                </div>
                <div className="mp-rival-meta">
                  <span>{r.tipo}</span>
                  <span>·</span>
                  <span>{fmtDist(r.d)}</span>
                  <span>·</span>
                  <span>{r.reviews} reseñas</span>
                </div>
                <div className={'mp-signal s-' + r.signal.k}>
                  <em>{SIG_LABEL[r.signal.k]}</em>
                  {r.signal.txt}
                </div>
                <span className="mp-vs-hint">Comparar ⚔</span>
              </button>
            ))}
            {!enRango.length && <div className="mp-empty">No hay rivales en este radio</div>}
          </div>
        </aside>
      </div>

      <AnimatePresence>{comparar && <Comparador rival={comparar} onClose={() => setComparar(null)} />}</AnimatePresence>
    </div>
  )
}

/* ── Comparador 1-a-1 (carta premium, estética de la referencia: oscuro + glossy
   dorado + muesca orgánica + semitono + barras con glow, count-up GSAP). ── */
const METRICAS: { key: 'rating' | 'reviews' | 'precio'; label: string; max?: number; suf: string; dec: number; mejor: 'alto' | 'info' }[] = [
  { key: 'rating', label: 'Valoración', max: 5, suf: '★', dec: 1, mejor: 'alto' },
  { key: 'reviews', label: 'Nº de reseñas', suf: '', dec: 0, mejor: 'alto' },
  { key: 'precio', label: 'Ticket medio', suf: ' €', dec: 2, mejor: 'info' },
]

function Comparador({ rival, onClose }: { rival: Rival & { d: number }; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const gano = METRICAS.filter((m) => m.mejor === 'alto').reduce((n, m) => n + ((LOCAL as never)[m.key] > (rival as never)[m.key] ? 1 : 0), 0)
  const totalAlto = METRICAS.filter((m) => m.mejor === 'alto').length

  useEffect(() => {
    playBeast('lion', 0.5) // rugido al abrir el enfrentamiento
    const ctx = gsap.context(() => {
      // count-up de cada número escribiendo en el DOM (sin re-render)
      root.current?.querySelectorAll<HTMLElement>('[data-count]').forEach((el, i) => {
        const to = parseFloat(el.dataset.count || '0')
        const dec = parseInt(el.dataset.dec || '0', 10)
        const suf = el.dataset.suf || ''
        const o = { v: 0 }
        gsap.to(o, {
          v: to,
          duration: 1.0,
          delay: 0.15 + Math.floor(i / 2) * 0.12,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = o.v.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf
          },
        })
      })
      // barras que crecen con glow
      gsap.fromTo(
        root.current?.querySelectorAll('.cmp-fill') || [],
        { width: '0%' },
        { width: (_i: number, el: Element) => (el as HTMLElement).dataset.w || '0%', duration: 0.9, delay: 0.2, ease: 'power3.out', stagger: 0.06 },
      )
    }, root)
    return () => ctx.revert()
  }, [rival])

  return (
    <motion.div className="cmp-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="cmp-card"
        ref={root}
        initial={{ opacity: 0, scale: 0.86, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cmp-head">
          <div className="cmp-head-dots" aria-hidden="true" />
          <span className="cmp-kicker">Enfrentamiento · {fmtDist(rival.d)}</span>
          <div className="cmp-names">
            <span className="cmp-n cmp-you">{LOCAL.name.split('·')[0].trim()}</span>
            <span className="cmp-vs">VS</span>
            <span className="cmp-n cmp-them">{rival.name}</span>
          </div>
        </div>

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
                    <div className="cmp-track">
                      <div className="cmp-fill you" data-w={`${Math.max(4, (lv / max) * 100)}%`} />
                    </div>
                    <b className="cmp-val" data-count={lv} data-dec={m.dec} data-suf={m.suf}>0</b>
                  </div>
                  <div className={'cmp-row' + (themWin ? ' win them' : '')}>
                    <span className="cmp-side">{rival.name.split(' ')[0]}</span>
                    <div className="cmp-track">
                      <div className="cmp-fill them" data-w={`${Math.max(4, (rv / max) * 100)}%`} />
                    </div>
                    <b className="cmp-val" data-count={rv} data-dec={m.dec} data-suf={m.suf}>0</b>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="cmp-foot">
          <span className="cmp-verdict">
            {gano > totalAlto - gano ? `Ganas en ${gano} de ${totalAlto}` : gano === totalAlto - gano ? 'Empate técnico' : `Te superan en ${totalAlto - gano} de ${totalAlto}`}
          </span>
          <button className="cmp-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
