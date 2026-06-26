/* ════════════════════════════════════════════════════════════════════
   Cloudflare Pages Function — proxy SERVER-SIDE a Google Places (New).
   La API key vive SOLO aquí (secret `GOOGLE_PLACES_KEY` del proyecto Pages),
   NUNCA en el cliente. El navegador llama a /api/places?lat&lng&radius y
   recibe los rivales ya filtrados. (Regla de oro: claves de pago = servidor.)
   ════════════════════════════════════════════════════════════════════ */

const json = (obj, status = 200, cacheSec = 0) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheSec ? `public, max-age=${cacheSec}` : 'no-store',
    },
  })

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

  // Validación estricta: además de finitos, dentro de rangos geográficos reales (evita basura que quema cuota de Google).
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)
    return json({ error: 'lat/lng inválidos', rivals: [] }, 400)

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

  // cache 10 min en el edge → no quemamos cuota de Places en cada carga
  return json({ rivals, count: rivals.length }, 200, 600)
}
