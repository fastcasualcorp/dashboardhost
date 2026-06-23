/* Aplica supabase/apply.sql en el proyecto vía la Management API de Supabase.
   Necesita un Personal Access Token (sbp_…) en rebell-app/.sb-access-token.
   Con esto NO hace falta la contraseña de la BD ni pegar SQL a mano.
   Uso:  node supabase/run-sql.mjs */
import { readFileSync } from 'node:fs'

const token = readFileSync(new URL('../.sb-access-token', import.meta.url), 'utf8').trim()
const REF = 'pcmzovivezvuccoevwjh'
const sql = readFileSync(new URL('./apply.sql', import.meta.url), 'utf8')

const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})
const txt = await r.text()
console.log('HTTP', r.status)
console.log(txt)
if (!r.ok) process.exit(1)
console.log('\n✓ Esquema aplicado. Ahora: node supabase/setup-admin.mjs')
