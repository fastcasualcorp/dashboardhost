import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { SectionHeader, Badge } from '../components/ui'
import { play } from '../lib/sound'

/* Mapa de Incidencia — rastrea la competencia de tu zona en un mapa real (oscuro),
   con un radio configurable, fichas de cada rival y un "Radar IA" con el resumen de
   la semana. v1 con datos de DEMO + mapa Leaflet/CARTO (sin API key de pago); con la
   key de Google Places + una Edge Function con Claude pasarán a ser reales y en vivo.
   Diseño REBELL, no el del panel del socio. */

const LOCAL = { name: 'REBELL · Homeburger', lat: 42.8378, lng: -8.611, rating: 4.6, reviews: 312 }

type Signal = { k: 'reseña' | 'promo' | 'noticia' | 'social'; txt: string }
type Rival = { id: string; name: string; tipo: string; lat: number; lng: number; rating: number; reviews: number; signal: Signal }

const RIVALES: Rival[] = [
  { id: 'r1', name: 'Burger Brothers', tipo: 'Hamburguesería', lat: 42.8401, lng: -8.6075, rating: 4.2, reviews: 188, signal: { k: 'reseña', txt: 'Nueva reseña 5★: «las mejores patatas de la zona»' } },
  { id: 'r2', name: 'La Casa de las Burgers', tipo: 'Hamburguesería', lat: 42.8345, lng: -8.6152, rating: 3.9, reviews: 241, signal: { k: 'promo', txt: 'Lanzaron menú a 8,90 € (Instagram)' } },
  { id: 'r3', name: "McDonald's Bertamiráns", tipo: 'Fast food', lat: 42.842, lng: -8.619, rating: 4.0, reviews: 1502, signal: { k: 'noticia', txt: 'Reforma del local anunciada (prensa local)' } },
  { id: 'r4', name: 'Pizzería Nápoles', tipo: 'Pizzería', lat: 42.8312, lng: -8.6068, rating: 4.4, reviews: 97, signal: { k: 'reseña', txt: '2 reseñas negativas esta semana' } },
  { id: 'r5', name: 'Kebab Estrella', tipo: 'Kebab', lat: 42.8389, lng: -8.621, rating: 4.1, reviews: 64, signal: { k: 'social', txt: 'Vídeo viral en TikTok (12k visualizaciones)' } },
]

const RADIOS = [
  { k: 500, t: '500 m' },
  { k: 1000, t: '1 km' },
  { k: 2000, t: '2 km' },
  { k: 5000, t: '5 km' },
]

const SIG_LABEL: Record<Signal['k'], string> = { reseña: 'Reseña', promo: 'Promo', noticia: 'Noticia', social: 'Redes' }

function distM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000
  const toR = (d: number) => (d * Math.PI) / 180
  const dLat = toR(bLat - aLat)
  const dLng = toR(bLng - aLng)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)

function pinIcon(kind: 'local' | 'rival', rating: number) {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin ${kind}"><b>${rating.toFixed(1)}</b></div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  })
}

export default function MapaIncidencia() {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const [radio, setRadio] = useState(2000)

  // Inicializa el mapa una vez.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = L.map(elRef.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: true }).setView([LOCAL.lat, LOCAL.lng], 14)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution: '© OpenStreetMap · © CARTO',
    }).addTo(map)
    L.marker([LOCAL.lat, LOCAL.lng], { icon: pinIcon('local', LOCAL.rating), zIndexOffset: 1000 }).addTo(map).bindTooltip(LOCAL.name, { direction: 'top' })
    RIVALES.forEach((r) => {
      L.marker([r.lat, r.lng], { icon: pinIcon('rival', r.rating) }).addTo(map).bindTooltip(`${r.name} · ${r.rating}★`, { direction: 'top' })
    })
    mapRef.current = map
    window.setTimeout(() => map.invalidateSize(), 250)
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Círculo del radio + encuadre.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (circleRef.current) circleRef.current.remove()
    const c = L.circle([LOCAL.lat, LOCAL.lng], { radius: radio, color: '#ffbf10', weight: 1.5, fillColor: '#ffbf10', fillOpacity: 0.06 }).addTo(map)
    circleRef.current = c
    map.fitBounds(c.getBounds(), { padding: [36, 36] })
  }, [radio])

  const enRango = RIVALES.map((r) => ({ ...r, d: distM(LOCAL.lat, LOCAL.lng, r.lat, r.lng) }))
    .filter((r) => r.d <= radio)
    .sort((a, b) => a.d - b.d)

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
        <div className="mapa-map" ref={elRef} />

        <aside className="mapa-panel">
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

          <div className="mp-list-h">
            {enRango.length} {enRango.length === 1 ? 'rival' : 'rivales'} en tu radio
          </div>
          <div className="mp-list">
            {enRango.map((r) => (
              <div className="mp-rival" key={r.id}>
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
              </div>
            ))}
            {!enRango.length && <div className="mp-empty">No hay rivales en este radio</div>}
          </div>
        </aside>
      </div>
    </div>
  )
}
