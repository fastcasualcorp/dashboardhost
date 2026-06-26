/* Cliente del proxy /api/places (Cloudflare Pages Function). Devuelve rivales REALES de
   Google Places ya filtrados. Si el endpoint no está disponible (dev local sin functions,
   o fallo de red), devuelve null → el mapa cae a los datos de DEMO. La key vive en el
   servidor, aquí solo se consumen datos ya filtrados. */

export type PlaceReview = { author: string; rating: number | null; text: string; when: string; source: string }
export type PlaceRival = {
  id: string
  name: string
  lat: number
  lng: number
  rating: number | null
  reviews: number
  tipo: string
  precio: number
  googleReviews: PlaceReview[]
}

export async function fetchRivals(lat: number, lng: number, radius: number, signal?: AbortSignal): Promise<PlaceRival[] | null> {
  try {
    const r = await fetch(`/api/places?lat=${lat}&lng=${lng}&radius=${Math.round(radius)}`, { signal })
    if (!r.ok) return null
    const d = (await r.json()) as { rivals?: PlaceRival[] }
    return Array.isArray(d.rivals) && d.rivals.length ? d.rivals : null
  } catch {
    return null
  }
}

// CACHÉ de rivales (Juan 25-jun: "no busques en Google cada vez; de vez en cuando, por si algo cambió").
// Cada llamada a Places se PAGA → guardamos el resultado en localStorage 12 h. Al entrar al Mapa se muestran
// al instante los rivales cacheados ("escaneo rápido", coste 0) y solo se hace una búsqueda NUEVA si la caché
// caducó. (Cuando esté Supabase, este caché puede subir a la nube por local + refresco por cron.)
const RIVALS_TTL = 12 * 60 * 60 * 1000 // 12 h → como mucho ~2 búsquedas/día por local
export async function fetchRivalsCached(lat: number, lng: number, radius: number, signal?: AbortSignal): Promise<PlaceRival[] | null> {
  const key = `rebell-rivals:${lat.toFixed(4)},${lng.toFixed(4)},${Math.round(radius)}`
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const cache = JSON.parse(raw) as { ts: number; rivals: PlaceRival[] }
      if (Date.now() - cache.ts < RIVALS_TTL && Array.isArray(cache.rivals) && cache.rivals.length) {
        return cache.rivals // fresco → 0 llamadas a Places
      }
    }
  } catch { /* sin localStorage o JSON corrupto → buscar */ }
  const fresh = await fetchRivals(lat, lng, radius, signal)
  if (fresh && fresh.length) {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), rivals: fresh })) } catch { /* almacenamiento lleno/privado */ }
  }
  return fresh
}
