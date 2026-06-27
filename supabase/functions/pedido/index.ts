/* ════════════════════════════════════════════════════════════════════
   EDGE FUNCTION · pedido  —  intake del PEDIDO ONLINE del cliente (QR).
   El cliente de /pedir es ANÓNIMO (sin sesión) → no puede escribir en la BD
   (la RLS lo impide, a propósito). Esta función, server-side, valida el pedido
   y lo inserta con la service_role (que sí pasa la RLS), scopeado al local que
   viene en el QR (?l=<slug>). Devuelve el nº de comanda.
   Seguridad: valida importe/artículos; el slug debe existir; CORS abierto
   (cara al cliente). El cobro real (pasarela) iría ANTES de llamar aquí.
   ════════════════════════════════════════════════════════════════════ */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  let payload: { local?: string; mesa?: string | null; items?: { name: string; qty: number }[]; total?: number; metodo?: string; arts?: number }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'json' }, 400)
  }
  const { local, mesa, items, total } = payload

  // ── validación dura ──
  if (typeof local !== 'string' || !local || local.length > 40) return json({ error: 'local' }, 400)
  if (!Array.isArray(items) || items.length === 0 || items.length > 60) return json({ error: 'items' }, 400)
  for (const it of items) {
    if (typeof it?.name !== 'string' || it.name.length > 60 || typeof it.qty !== 'number' || it.qty < 1 || it.qty > 99) return json({ error: 'item' }, 400)
  }
  const t = Number(total)
  if (!Number.isFinite(t) || t <= 0 || t > 100000) return json({ error: 'total' }, 400)
  const mesaTxt = typeof mesa === 'string' && mesa.length <= 40 ? mesa : null

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // ── resolver el local desde el slug del QR ──
  const { data: loc, error: le } = await admin.from('locales').select('id').eq('slug', local.toLowerCase()).maybeSingle()
  if (le) return json({ error: 'db' }, 500)
  if (!loc) return json({ error: 'local-desconocido' }, 404)

  // ── nº de comanda del local (no atómico, suficiente para demo) ──
  const { data: last } = await admin.from('comandas').select('numero').eq('local_id', loc.id).order('numero', { ascending: false }).limit(1)
  const numero = ((last?.[0]?.numero as number) ?? 0) + 1
  const arts = items.reduce((s, i) => s + i.qty, 0)

  // ── comanda → cocina (KDS realtime) + venta → libro ──
  const { error: ce } = await admin.from('comandas').insert({ local_id: loc.id, numero, fuente: 'Online', mesa: mesaTxt, items, estado: 'nueva' })
  if (ce) return json({ error: 'comanda', detail: ce.message }, 500)
  await admin.from('ventas').insert({ local_id: loc.id, total: Math.round(t * 100) / 100, metodo: 'tarjeta', mesa: mesaTxt, doc: 'ticket', numero, arts, fuente: 'Online' })

  return json({ ok: true, numero })
})
