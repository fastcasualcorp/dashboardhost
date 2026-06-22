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
