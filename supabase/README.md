# Supabase · REBELL (multi-tenant)

Proyecto: `pcmzovivezvuccoevwjh`. La autorización vive en **`app_metadata`** (solo
`service_role`), nunca en `user_metadata`. La RLS lee rol/local con `auth.jwt()`.

## Aplicar el esquema
Opción rápida (SQL Editor del dashboard): pega `migrations/0001_init.sql` y ejecútalo.

Opción CLI:
```bash
supabase link --project-ref pcmzovivezvuccoevwjh
supabase db push
```

## Modelo
- **locales** = tenants (un local = una franquicia REBELL).
- **perfiles** = 1:1 con `auth.users` (nombre/avatar/rol mostrable).
- **ventas / comandas** = datos de negocio, cada fila con `local_id`; la RLS impide
  ver datos de otro local. `rol='central'` ve todos (administración).

## Alta de usuario (server-side, service_role)
Al crear un usuario, fija sus claims de autorización (NUNCA desde el cliente):
```ts
await supabaseAdmin.auth.admin.updateUserById(userId, {
  app_metadata: { local_id, rol } // rol: empleado | encargado | admin | central
})
```
A partir de ahí, su JWT lleva `app_metadata.local_id` y `app_metadata.rol`, y todas
las políticas RLS lo aplican solas.

> Pendiente al ir a real: Edge Function de alta (gate por rol admin/central),
> y conectar el Login (selector de local) a `supabase.auth` real.
