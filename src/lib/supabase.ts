import { createClient } from '@supabase/supabase-js'

/* Cliente único de Supabase. Lee las llaves de variables de entorno (Vite):
   - VITE_SUPABASE_URL        → la URL del proyecto
   - VITE_SUPABASE_ANON_KEY   → la anon/publishable key (PÚBLICA, la protege la RLS)
   La service_role NUNCA va aquí: solo server-side (Edge Functions).

   Si todavía no hay llaves (entorno local sin .env), exportamos null y la app
   sigue funcionando en "modo demo" — así el build nunca se rompe por falta de
   credenciales. Cuando conectemos Supabase, basta con rellenar el .env. */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && anon ? createClient(url, anon) : null
export const hasSupabase = supabase !== null

/* local_id del usuario logueado (vive en app_metadata, lo fija el service_role).
   Lo cacheamos de la sesión para que las inserciones lleven su local sin pedir BD. */
let _localId: string | null = null
let _rol: string | null = null
let _localResolved = false
export const localId = () => _localId
/** Rol del usuario (de app_metadata, solo escribible por service_role). 'central' = propietario/admin del SaaS. */
export const userRol = () => _rol
/** ¿Cuenta de administración (central)? Para funciones internas (semáforo de salud, modo escaparate). */
export const isCentral = () => _rol === 'central'

/* Aviso de "local resuelto". La sesión se resuelve de forma ASÍNCRONA → al montar un
   componente, localId() puede ser todavía null. Un consumidor que lea datos por-local
   (p.ej. el plano del salón, cuyo scope depende del local) saldría con el scope 'anon'
   → mostraría datos genéricos que "no son los suyos". Con esto, se recarga en cuanto el
   local está disponible (y en cada cambio de sesión). (Juan, 29-jun) */
type LocalListener = () => void
const _localListeners = new Set<LocalListener>()
/** ¿Se ha resuelto ya la sesión (sepamos local o sepamos que no hay)? Para no pintar datos por-local con el
   scope provisional 'anon' antes de tiempo (evita el "flash" de datos que no son del local). */
export const localReady = () => _localResolved
export function onLocalReady(cb: LocalListener): () => void {
  _localListeners.add(cb)
  if (_localResolved) cb() // ya resuelto → dispara ya (idempotente)
  return () => { _localListeners.delete(cb) }
}
function emitLocal() {
  _localResolved = true
  _localListeners.forEach((cb) => cb())
}

type AppMeta = { local_id?: string; rol?: string }
if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    _localId = (data.session?.user?.app_metadata as AppMeta)?.local_id ?? null
    _rol = (data.session?.user?.app_metadata as AppMeta)?.rol ?? null
    emitLocal()
  })
  supabase.auth.onAuthStateChange((_e, session) => {
    _localId = (session?.user?.app_metadata as AppMeta)?.local_id ?? null
    _rol = (session?.user?.app_metadata as AppMeta)?.rol ?? null
    emitLocal()
  })
}
