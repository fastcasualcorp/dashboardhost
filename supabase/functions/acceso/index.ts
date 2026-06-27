/* ════════════════════════════════════════════════════════════════════
   EDGE FUNCTION · acceso — registra un ACCESO de seguridad (login / abrir caja
   / cerrar caja). La IP se captura AQUÍ (server-side) → el cliente no puede
   falsearla, como el historial de tu banco. El usuario y su local salen del JWT
   ya verificado (verify_jwt ON) → no se pueden suplantar. Inserta con
   service_role en `accesos` (RLS: nadie escribe directo; solo gerencia lee).
   ════════════════════════════════════════════════════════════════════ */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const EVENTOS = ['login', 'abrir_caja', 'cerrar_caja']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  // El JWT ya está verificado por la plataforma (verify_jwt ON). Leemos sus claims
  // (no se pueden falsear: la firma se validó arriba) → quién es y de qué local.
  const auth = req.headers.get('Authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'no-auth' }, 401)
  let claims: { app_metadata?: { local_id?: string }; email?: string; sub?: string }
  try {
    claims = JSON.parse(atob(token.split('.')[1]))
  } catch {
    return json({ error: 'bad-token' }, 401)
  }
  const local_id = claims?.app_metadata?.local_id
  const usuario = claims?.email || claims?.sub || 'desconocido'
  if (!local_id) return json({ error: 'no-local' }, 403)

  let p: { evento?: string; dispositivo?: string }
  try {
    p = await req.json()
  } catch {
    return json({ error: 'json' }, 400)
  }
  if (!EVENTOS.includes(p?.evento ?? '')) return json({ error: 'evento' }, 400)
  const dispositivo = typeof p?.dispositivo === 'string' ? p.dispositivo.slice(0, 80) : null

  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '').split(',')[0].trim() || null

  // Clave secreta NUEVA (sb_secret) si está, con fallback a la legacy auto-inyectada.
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SB_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // anti-flood: máx. 30 registros/min por local (un acceso normal es esporádico)
  const { data: rateOk } = await admin.rpc('check_rate', { p_key: 'acceso:' + local_id, p_max: 30, p_secs: 60 })
  if (rateOk === false) return json({ error: 'demasiados' }, 429)

  const { error } = await admin.from('accesos').insert({ local_id, usuario, evento: p.evento, ip, dispositivo })
  if (error) {
    console.error('acceso insert', error)
    return json({ error: 'insert' }, 500)
  }
  return json({ ok: true })
})
