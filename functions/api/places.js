/* ════════════════════════════════════════════════════════════════════
   Cloudflare Pages Function — proxy SERVER-SIDE a Google Places (New).
   La API key vive SOLO aquí (secret `GOOGLE_PLACES_KEY` del proyecto Pages),
   NUNCA en el cliente. El navegador llama a /api/places?lat&lng&radius y
   recibe los rivales ya filtrados. (Regla de oro: claves de pago = servidor.)

   PORTERO (A1, 27-jun): este endpoint es público → hay que protegerlo para que
   nadie nos QUEME la cuota de Google (€). Tres capas:
     1) CHECK DE ORIGEN — una web de fuera siempre manda `Origin`; si no es el
        nuestro → 403 (fail-closed para origen ajeno). Same-origin manda `Referer`
        (Referrer-Policy: strict-origin-when-cross-origin) → se acepta.
     2) CACHE CUANTIZADA — la verdadera defensa anti-quema: las coords se redondean
        a una rejilla (~110 m) y la respuesta se guarda en `caches.default` por esa
        clave. Variar lat/lng un pelín ya NO salta la cache → no se llama a Google.
     3) RATE-LIMIT por IP (60/min) en memoria del isolate (baseline). Si se BINDEA
        un KV `PLACES_RL` en el proyecto Pages, se usa además un límite real
        cross-isolate. Sin KV, sigue protegido por 1) y 2).
   ════════════════════════════════════════════════════════════════════ */

// Hosts propios permitidos. `endsWith('.'+h)` cubre los previews *.dashboardhost.pages.dev.
const ALLOWED_HOSTS = ['dashboardhost.pages.dev', 'localhost', '127.0.0.1']

// Rate-limit en memoria del isolate (best-effort, baseline sin configurar nada).
const RL = new Map() // ip -> [timestamps]
const RL_MAX = 60 // peticiones
const RL_WIN = 60_000 // por minuto

const json = (obj, status = 200, cacheSec = 0) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheSec ? `public, max-age=${cacheSec}` : 'no-store',
    },
  })

const hostOf = (v) => {
  try { return new URL(v).hostname } catch { return null }
}
const hostAllowed = (h) => !!h && ALLOWED_HOSTS.some((a) => h === a || h.endsWith('.' + a))

// true = de confianza · false = origen AJENO (bloquear) · null = sin cabeceras (desconocido, no bloquear pero throttlear)
function originVerdict(request) {
  const origin = request.headers.get('Origin')
  if (origin) return hostAllowed(hostOf(origin)) // cross-site SIEMPRE manda Origin → exigirlo
  const referer = request.headers.get('Referer')
  if (referer) return hostAllowed(hostOf(referer)) // same-origin manda Referer
  return null
}

function rateLimited(ip) {
  const now = Date.now()
  const arr = (RL.get(ip) || []).filter((t) => now - t < RL_WIN)
  arr.push(now)
  RL.set(ip, arr)
  if (RL.size > 5000) RL.clear() // poda para no crecer sin fin
  return arr.length > RL_MAX
}

// Rate-limit real cross-isolate SI hay KV bindeado (opcional; si no, no-op).
async function kvRateLimited(env, ip) {
  const kv = env.PLACES_RL
  if (!kv) return false
  try {
    const k = 'rl:' + ip
    const n = parseInt((await kv.get(k)) || '0', 10)
    if (n >= RL_MAX) return true
    await kv.put(k, String(n + 1), { expirationTtl: 60 })
    return false
  } catch {
    return false // ante fallo de KV, no bloqueamos (las otras capas siguen)
  }
}

// Tipo Google → etiqueta humana en español.
function prettyType(t) {
  const M = {
    hamburger_restaurant: 'Hamburguesería',
    fast_food_restaurant: 'Fast food',
    pizza_restaurant: 'Pizzería',
    meal_takeaway: 'Comida para llevar',
    meal_delivery: 'A domicilio',
    restaurant: 'Restaurante',
    bar: 'Bar',
    cafe: 'Cafetería',
    sandwich_shop: 'Bocadillería',
  }
  return M[t] || 'Restaurante'
}
// PRICE_LEVEL_* → ticket medio aproximado (€) para comparar.
function priceFromLevel(l) {
  const M = {
    PRICE_LEVEL_INEXPENSIVE: 9,
    PRICE_LEVEL_MODERATE: 14,
    PRICE_LEVEL_EXPENSIVE: 24,
    PRICE_LEVEL_VERY_EXPENSIVE: 40,
  }
  return M[l] || 13
}

export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const lat = parseFloat(url.searchParams.get('lat'))
  const lng = parseFloat(url.searchParams.get('lng'))
  const radius = Math.min(5000, Math.max(200, parseInt(url.searchParams.get('radius') || '1500', 10)))

  // ── PORTERO 1: origen ──
  const verdict = originVerdict(request)
  if (verdict === false) return json({ error: 'origen no permitido', rivals: [] }, 403)

  // Validación estricta: además de finitos, dentro de rangos geográficos reales (evita basura que quema cuota de Google).
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)
    return json({ error: 'lat/lng inválidos', rivals: [] }, 400)

  // ── PORTERO 3: rate-limit por IP (memoria del isolate + KV opcional) ──
  const ip = request.headers.get('CF-Connecting-IP') || 'anon'
  if (rateLimited(ip) || (await kvRateLimited(env, ip)))
    return json({ error: 'demasiadas peticiones, prueba en un momento', rivals: [] }, 429)

  // ── PORTERO 2: cache CUANTIZADA (rejilla ~110 m) en el edge ──
  // La clave NO depende de las coords exactas del cliente → variarlas un poco no salta la cache (anti quema-cuota).
  const qLat = lat.toFixed(3)
  const qLng = lng.toFixed(3)
  const cache = caches.default
  const cacheKey = new Request('https://places.cache.local/v1/' + qLat + ',' + qLng + ',' + radius, { method: 'GET' })
  const cached = await cache.match(cacheKey)
  if (cached) return cached

  const key = env.GOOGLE_PLACES_KEY
  if (!key) return json({ error: 'sin GOOGLE_PLACES_KEY en el servidor', rivals: [] }, 500)

  const body = {
    includedTypes: ['restaurant', 'meal_takeaway', 'meal_delivery', 'hamburger_restaurant', 'fast_food_restaurant', 'american_restaurant', 'pizza_restaurant', 'sandwich_shop', 'bar_and_grill'],
    maxResultCount: 20,
    // PROMINENCIA (no distancia): en un centro denso, los competidores que IMPORTAN son los más conocidos,
    // no el bar más cercano. Así salen los rivales reales (Malasogra, etc.), no 20 cafeterías pegadas.
    rankPreference: 'POPULARITY',
    languageCode: 'es',
    regionCode: 'ES',
    locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
  }
  const fieldMask = [
    'places.id', 'places.displayName', 'places.rating', 'places.userRatingCount',
    'places.location', 'places.primaryType', 'places.priceLevel', 'places.reviews',
  ].join(',')

  // Timeout DURO (8s) con AbortController → un Places lento (slowloris) no deja la Function colgada consumiendo recursos.
  let r
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    r = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fieldMask },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
  } catch (e) {
    return json({ error: e?.name === 'AbortError' ? 'Places tardó demasiado' : 'no se pudo contactar con Places', rivals: [] }, 504)
  } finally {
    clearTimeout(timer)
  }
  if (!r.ok) {
    // NO filtramos el detalle de Google al cliente (podría revelar configuración/cuota/clave). Queda en logs del servidor.
    console.error('Places API error', r.status, (await r.text()).slice(0, 300))
    return json({ error: 'No se pudieron cargar los rivales ahora mismo', rivals: [] }, r.status === 403 ? 403 : 502)
  }

  // distancia (m) para excluir TU PROPIO local de la lista de rivales
  const distM = (la, lo) => {
    const R = 6371000, toR = (d) => (d * Math.PI) / 180
    const dLa = toR(la - lat), dLo = toR(lo - lng)
    const x = Math.sin(dLa / 2) ** 2 + Math.cos(toR(lat)) * Math.cos(toR(la)) * Math.sin(dLo / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(x))
  }

  const data = await r.json()
  const rivals = (data.places || [])
    .filter((p) => p.location && p.displayName?.text)
    // fuera el propio local (mismo punto ~<70m) y cualquier cosa con "rebell" en el nombre
    .filter((p) => distM(p.location.latitude, p.location.longitude) > 70 && !/rebell/i.test(p.displayName.text))
    .map((p) => ({
      id: p.id,
      name: p.displayName.text,
      lat: p.location.latitude,
      lng: p.location.longitude,
      rating: typeof p.rating === 'number' ? p.rating : null,
      reviews: p.userRatingCount || 0,
      tipo: prettyType(p.primaryType),
      precio: priceFromLevel(p.priceLevel),
      googleReviews: (p.reviews || []).slice(0, 3).map((rv) => ({
        author: rv.authorAttribution?.displayName || 'Cliente de Google',
        rating: typeof rv.rating === 'number' ? rv.rating : null,
        text: rv.text?.text || rv.originalText?.text || '',
        when: rv.relativePublishTimeDescription || '',
        source: 'Google',
      })),
    }))

  // cache 10 min en el edge → no quemamos cuota de Places en cada carga (por clave CUANTIZADA)
  const resp = json({ rivals, count: rivals.length }, 200, 600)
  context.waitUntil(cache.put(cacheKey, resp.clone()))
  return resp
}
