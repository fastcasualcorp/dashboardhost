/* INSPECTOR READ-ONLY del estado real de la BD de producción (auditoría 28-jun).
   Solo lanza SELECTs sobre el catálogo de Postgres → no escribe NADA. Sirve para confirmar/desmentir
   los hallazgos (¿RLS aplicada en TODAS las tablas? ¿design_comments abierta? ¿funciones SECURITY DEFINER
   con search_path fijo? ¿grants a anon?). Uso: node supabase/inspect.mjs */
import { readFileSync } from 'node:fs'

const token = readFileSync(new URL('../.sb-access-token', import.meta.url), 'utf8').trim()
const REF = 'pcmzovivezvuccoevwjh'

async function q(label, sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, read_only: true }),
  })
  const txt = await r.text()
  console.log(`\n===== ${label} (HTTP ${r.status}) =====`)
  try {
    console.log(JSON.stringify(JSON.parse(txt), null, 1))
  } catch {
    console.log(txt)
  }
}

await q('TABLAS + RLS habilitada', `
  select c.relname as tabla, c.relrowsecurity as rls_on, c.relforcerowsecurity as rls_forced
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' order by c.relname;`)

await q('POLICIES (RLS) por tabla', `
  select tablename, policyname, cmd, roles::text, qual, with_check
  from pg_policies where schemaname='public' order by tablename, policyname;`)

await q('FUNCIONES (SECURITY DEFINER + search_path)', `
  select p.proname, p.prosecdef as security_definer, p.proconfig as config
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' order by p.proname;`)

await q('GRANTS a anon / authenticated / public', `
  select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privs
  from information_schema.role_table_grants
  where table_schema='public' and grantee in ('anon','authenticated','public')
  group by table_name, grantee order by table_name, grantee;`)

await q('COLUMNAS de tablas clave (para cablear datos reales)', `
  select table_name, column_name, data_type
  from information_schema.columns
  where table_schema='public' order by table_name, ordinal_position;`)
