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
export const localId = () => _localId
/** Rol del usuario (de app_metadata, solo escribible por service_role). 'central' = propietario/admin del SaaS. */
export const userRol = () => _rol
/** ¿Cuenta de administración (central)? Para funciones internas (semáforo de salud, modo escaparate). */
export const isCentral = () => _rol === 'central'
type AppMeta = { local_id?: string; rol?: string }
if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    _localId = (data.session?.user?.app_metadata as AppMeta)?.local_id ?? null
    _rol = (data.session?.user?.app_metadata as AppMeta)?.rol ?? null
  })
  supabase.auth.onAuthStateChange((_e, session) => {
    _localId = (session?.user?.app_metadata as AppMeta)?.local_id ?? null
    _rol = (session?.user?.app_metadata as AppMeta)?.rol ?? null
  })
}
