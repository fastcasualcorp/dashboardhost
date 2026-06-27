/* Setup admin de REBELL — se ejecuta UNA vez, server-side, con la service_role.
   Crea los locales + un usuario por local con sus permisos en app_metadata (que SOLO
   el service_role puede escribir) + su fila en perfiles. Idempotente: si el local ya
   existe, no lo duplica. Requiere que las tablas existan (correr antes el apply.sql).

   Uso:  node supabase/setup-admin.mjs
   Lee la service_role de  rebell-app/.sb-service-role  (gitignored). */

import { readFileSync, writeFileSync } from 'node:fs'

// Contraseña inicial común para todos los locales (fase demo). CAMBIAR antes de vender.
const PASSWORD = 'Rebell2026!'

const SR = readFileSync(new URL('../.sb-service-role', import.meta.url), 'utf8').trim()
const REF = JSON.parse(Buffer.from(SR.split('.')[1], 'base64').toString()).ref
const URL_ = `https://${REF}.supabase.co`
const H = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' }

// Los 4 locales del login (id del perfil ↔ bestia/acento).
const LOCALES = [
  { key: 'bertamirans', nombre: 'Bertamiráns', ciudad: 'Bertamiráns', accent: 'gold', rol: 'admin' },
  { key: 'madrid', nombre: 'Madrid Centro', ciudad: 'Madrid', accent: 'mono', rol: 'encargado' },
  { key: 'barcelona', nombre: 'Barcelona', ciudad: 'Barcelona', accent: 'rosa', rol: 'encargado' },
  { key: 'central', nombre: 'Administración', ciudad: 'Central', accent: 'violeta', rol: 'central' },
]

const api = async (path, opts = {}) => {
  const r = await fetch(URL_ + path, { ...opts, headers: { ...H, ...(opts.headers || {}) } })
  const txt = await r.text()
  let body
  try {
    body = txt ? JSON.parse(txt) : null
  } catch {
    body = txt
  }
  if (!r.ok) throw new Error(`${r.status} ${path} → ${txt}`)
  return body
}

const creds = []
for (const L of LOCALES) {
  // 1) local (si no existe por nombre)
  const existing = await api(`/rest/v1/locales?select=id&nombre=eq.${encodeURIComponent(L.nombre)}`)
  let localId = existing[0]?.id
  if (!localId) {
    const ins = await api('/rest/v1/locales', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ nombre: L.nombre, ciudad: L.ciudad, accent: L.accent, slug: L.key }) })
    localId = ins[0].id
  } else {
    // asegurar el slug en locales ya creados (idempotente)
    await api(`/rest/v1/locales?id=eq.${localId}`, { method: 'PATCH', body: JSON.stringify({ slug: L.key }) }).catch(() => {})
  }
  // 2) usuario (email = key@rebell.app) con app_metadata { local_id, rol }
  const email = `${L.key}@rebell.app`
  const password = PASSWORD
  let userId
  try {
    const u = await api('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { local_id: localId, rol: L.rol } }) })
    userId = u.id
  } catch (e) {
    if (String(e).includes('already been registered') || String(e).includes('422')) {
      const list = await api(`/auth/v1/admin/users?per_page=200`)
      const found = (list.users || list).find((x) => x.email === email)
      userId = found?.id
      if (userId) await api(`/auth/v1/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify({ app_metadata: { local_id: localId, rol: L.rol } }) })
    } else throw e
  }
  // 3) perfil
  if (userId) await api('/rest/v1/perfiles', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id: userId, local_id: localId, nombre: L.nombre, rol: L.rol }) }).catch(() => {})
  creds.push({ local: L.nombre, email, password, localId, rol: L.rol })
  console.log(`✓ ${L.nombre} → local ${localId} · ${email}`)
}

writeFileSync(new URL('../.sb-credentials', import.meta.url), JSON.stringify(creds, null, 2))
console.log('\nCredenciales escritas en rebell-app/.sb-credentials')
