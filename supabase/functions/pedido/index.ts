/* ════════════════════════════════════════════════════════════════════
   EDGE FUNCTION · pedido  —  intake del PEDIDO ONLINE del cliente (QR).
   El cliente de /pedir es ANÓNIMO → no puede escribir en la BD (RLS). Esta
   función, server-side, valida e inserta comanda+venta con service_role,
   scopeada al local por su slug (?l=<slug>). Devuelve el nº de comanda.

   Endurecido tras revisión de seguridad:
   - nº de comanda + comanda + venta en UNA RPC atómica y transaccional
     (sin carrera, sin venta huérfana).
   - chequeo de importe contra el catálogo (rechaza totales absurdamente bajos
     → no se puede "pagar 1 céntimo"). Defensa de demo.
   - errores genéricos (sin filtrar detalle de BD).

   ⚠️ DEMO: el pago es simulado (no hay pasarela). Antes de clientes REALES hace
   falta: cobro verificado server-side (Stripe PaymentIntent + webhook HMAC,
   fail-closed, insertar la venta solo tras pago confirmado) + rate-limit por
   IP/slug. Hasta entonces NO promocionar slugs de locales reales.
   ════════════════════════════════════════════════════════════════════ */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Catálogo (precio base por plato) → para un chequeo de cordura del importe.
// No es el precio exacto del menú dinámico; sirve de SUELO anti-fraude.
const PRICES: Record<string, number> = {
  'REBELL Classic': 11, 'Doble Bacon': 13, 'Crispy Chicken': 12, 'Veggie Deluxe': 12, 'Menú REBELL': 12,
  'Patatas Rebell': 4.5, 'Nuggets x6': 5.5, 'Aros de cebolla': 4, Refresco: 2.5, Cerveza: 3, Agua: 1.8, Brownie: 4.5,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  let p: { local?: string; mesa?: string | null; items?: { name: string; qty: number }[]; total?: number }
  try {
    p = await req.json()
  } catch {
    return json({ error: 'json' }, 400)
  }
  const { local, mesa, items, total } = p

  // ── validación dura ──
  if (typeof local !== 'string' || !local || local.length > 40) return json({ error: 'local' }, 400)
  if (!Array.isArray(items) || items.length === 0 || items.length > 60) return json({ error: 'items' }, 400)
  for (const it of items) {
    if (typeof it?.name !== 'string' || it.name.length > 60 || typeof it.qty !== 'number' || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > 99) return json({ error: 'item' }, 400)
  }
  const t = Number(total)
  if (!Number.isFinite(t) || t <= 0 || t > 100000) return json({ error: 'total' }, 400)
  const mesaTxt = typeof mesa === 'string' && mesa.length <= 40 ? mesa : null
  const arts = items.reduce((s, i) => s + i.qty, 0)

  // ── chequeo de cordura del importe (suelo según catálogo) ──
  const minEsperado = items.reduce((s, i) => s + (PRICES[i.name] ?? 3) * i.qty, 0)
  if (t < minEsperado * 0.5) return json({ error: 'total-bajo' }, 400) // total absurdo → fraude

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // ── pedido atómico y transaccional (comanda + venta + nº por local) ──
  const { data: numero, error } = await admin.rpc('crear_pedido_online', {
    p_slug: local.toLowerCase(),
    p_mesa: mesaTxt,
    p_items: items,
    p_total: Math.round(t * 100) / 100,
    p_arts: arts,
  })
  if (error) {
    if ((error.message || '').includes('local-desconocido')) return json({ error: 'local-desconocido' }, 404)
    console.error('crear_pedido_online', error) // detalle solo en logs server-side
    return json({ error: 'pedido' }, 500)
  }

  return json({ ok: true, numero })
})
