/* ════════════════════════════════════════════════════════════════════
   REGISTRO DE ACCESOS — auditoría de seguridad (quién entra / abre / cierra
   caja, desde qué IP y dispositivo). Estilo "historial de login de tu banco".
   - REGISTRAR: llama a la Edge Function `acceso` con el token del usuario; la IP
     la pone el SERVIDOR (el cliente no puede falsearla).
   - LEER: solo la GERENCIA (la RLS devuelve vacío al resto). Reactivo como los
     demás stores (Supabase + realtime), con SEED demo para no salir vacío sin
     backend. NO se persiste en el cliente (es auditoría, vive en el servidor).
   ════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { isDemoMode } from './demo'

export type Evento = 'login' | 'abrir_caja' | 'cerrar_caja'
export type Acceso = { id: string; ts: number; usuario: string; evento: Evento; ip: string | null; dispositivo: string | null }

// Etiqueta amable del dispositivo desde el user-agent (sin librerías).
function deviceLabel(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  let os = 'Equipo'
  if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS'
  else if (/android/i.test(ua)) os = 'Android'
  else if (/macintosh|mac os x/i.test(ua)) os = 'Mac'
  else if (/windows/i.test(ua)) os = 'Windows'
  else if (/linux/i.test(ua)) os = 'Linux'
  let br = 'Navegador'
  if (/edg\//i.test(ua)) br = 'Edge'
  else if (/chrome|crios/i.test(ua)) br = 'Chrome'
  else if (/firefox|fxios/i.test(ua)) br = 'Firefox'
  else if (/safari/i.test(ua)) br = 'Safari'
  const movil = /mobile|iphone|android/i.test(ua)
  return `${br} · ${os}${movil ? ' (móvil)' : ''}`
}

// SEED demo (sin backend, el libro arranca poblado y se ve el lenguaje visual).
const SEED: Acceso[] = [
  { id: 's1', ts: new Date(2026, 5, 27, 9, 2).getTime(), usuario: 'bertamirans@rebell.app', evento: 'login', ip: '88.14.22.103', dispositivo: 'Safari · Mac' },
  { id: 's2', ts: new Date(2026, 5, 27, 9, 3).getTime(), usuario: 'bertamirans@rebell.app', evento: 'abrir_caja', ip: '88.14.22.103', dispositivo: 'Safari · Mac' },
  { id: 's3', ts: new Date(2026, 5, 26, 23, 41).getTime(), usuario: 'bertamirans@rebell.app', evento: 'cerrar_caja', ip: '88.14.22.103', dispositivo: 'Chrome · Windows' },
  { id: 's4', ts: new Date(2026, 5, 26, 16, 18).getTime(), usuario: 'encargado@rebell.app', evento: 'login', ip: '212.51.9.77', dispositivo: 'Chrome · Android (móvil)' },
]

let accesos: Acceso[] = isDemoMode() ? SEED.slice() : []

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rebell:accesos'))
}

export const getAccesos = (): Acceso[] => accesos

// Registra un acceso → Edge Function (IP server-side). No bloquea: si falla, se ignora.
export async function registrarAcceso(evento: Evento) {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return // demo / sin sesión
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  try {
    await fetch(`${url}/functions/v1/acceso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ evento, dispositivo: deviceLabel() }),
    })
  } catch {
    /* sin red: el registro no debe romper el flujo de login/caja */
  }
}

/* ── Lectura: hidratar + realtime (solo gerencia; la RLS filtra) ── */
type ARow = { id: string; usuario: string; evento: Evento; ip: string | null; dispositivo: string | null; creado_at: string }
function fromRow(r: ARow): Acceso {
  return { id: r.id, ts: new Date(r.creado_at).getTime(), usuario: r.usuario, evento: r.evento, ip: r.ip, dispositivo: r.dispositivo }
}
let _syncStarted = false
async function initSync() {
  if (_syncStarted || !supabase) return
  _syncStarted = true
  const { data } = await supabase.auth.getSession()
  const lid = (data.session?.user?.app_metadata as { local_id?: string })?.local_id
  if (!lid || !data.session) return // demo → SEED
  supabase.realtime.setAuth(data.session.access_token)
  const { data: rows } = await supabase.from('accesos').select('*').eq('local_id', lid).order('creado_at', { ascending: false }).limit(120)
  if (rows) { accesos = (rows as ARow[]).map(fromRow); emit() } // si la RLS calla (no gerencia) → [] y el libro queda vacío
  supabase
    .channel('accesos-' + lid)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'accesos', filter: 'local_id=eq.' + lid }, (payload) => {
      const a = fromRow(payload.new as ARow)
      if (!accesos.some((x) => x.id === a.id)) accesos = [a, ...accesos].slice(0, 120)
      emit()
    })
    .subscribe()
}

export function useAccesos(): Acceso[] {
  const [, force] = useState(0)
  useEffect(() => {
    void initSync()
    const on = () => force((n) => n + 1)
    window.addEventListener('rebell:accesos', on)
    return () => window.removeEventListener('rebell:accesos', on)
  }, [])
  return accesos
}
