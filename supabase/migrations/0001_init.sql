-- ════════════════════════════════════════════════════════════════
-- REBELL · esquema multi-tenant inicial
-- Reglas de oro:
--  · La autorización (rol + local) vive en auth.users.app_metadata, que SOLO
--    puede escribir el service_role (nunca el cliente). La RLS lo lee con
--    auth.jwt() -> 'app_metadata'. Nunca usamos user_metadata para permisos.
--  · Cada fila de negocio lleva local_id; un usuario solo ve su local.
--  · Default-deny: RLS activada en todas las tablas, políticas con allowlist.
-- ════════════════════════════════════════════════════════════════

-- ── helpers de claims (leen del JWT, no de la BD → baratos y seguros) ──
create or replace function public.jwt_local_id() returns uuid
  language sql stable
  set search_path = ''
as $$ select nullif(auth.jwt() -> 'app_metadata' ->> 'local_id', '')::uuid $$;

create or replace function public.jwt_rol() returns text
  language sql stable
  set search_path = ''
as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'rol', 'none') $$;

-- ── locales (los "tenants") ──
create table if not exists public.locales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  ciudad text,
  accent text not null default 'gold',
  created_at timestamptz not null default now()
);
alter table public.locales enable row level security;

-- Un usuario ve SU local; un admin central (rol='central') los ve todos.
create policy "locales: ver el propio" on public.locales for select
  to authenticated
  using ( id = public.jwt_local_id() or public.jwt_rol() = 'central' );

-- ── perfiles (1:1 con auth.users) ──
-- El rol/local "de verdad" está en app_metadata; esta tabla es para mostrar
-- nombre/avatar y para que el service_role gestione la plantilla.
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  local_id uuid references public.locales(id) on delete set null,
  nombre text,
  rol text not null default 'empleado' check (rol in ('empleado','encargado','admin','central')),
  avatar text,
  created_at timestamptz not null default now()
);
alter table public.perfiles enable row level security;

create policy "perfiles: verme a mí o a los de mi local" on public.perfiles for select
  to authenticated
  using ( id = auth.uid() or local_id = public.jwt_local_id() or public.jwt_rol() = 'central' );

-- ── ejemplo de tabla de negocio scoped por local (ventas) ──
create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locales(id) on delete cascade,
  total numeric(10,2) not null,
  metodo text not null check (metodo in ('efectivo','tarjeta','domicilio')),
  creado_at timestamptz not null default now()
);
alter table public.ventas enable row level security;
create index if not exists ventas_local_idx on public.ventas (local_id, creado_at desc);

-- SELECT: solo tu local (o central). INSERT: solo en tu local.
create policy "ventas: ver las de mi local" on public.ventas for select
  to authenticated
  using ( local_id = public.jwt_local_id() or public.jwt_rol() = 'central' );

create policy "ventas: insertar en mi local" on public.ventas for insert
  to authenticated
  with check ( local_id = public.jwt_local_id() );

-- ── comandas (KDS) scoped por local ──
create table if not exists public.comandas (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locales(id) on delete cascade,
  numero int not null,
  fuente text not null default 'Sala',
  items jsonb not null default '[]',
  estado text not null default 'nueva' check (estado in ('nueva','prep','lista','servida')),
  creado_at timestamptz not null default now()
);
alter table public.comandas enable row level security;
create index if not exists comandas_local_idx on public.comandas (local_id, estado);

create policy "comandas: ver las de mi local" on public.comandas for select
  to authenticated
  using ( local_id = public.jwt_local_id() or public.jwt_rol() = 'central' );

create policy "comandas: gestionar las de mi local" on public.comandas for all
  to authenticated
  using ( local_id = public.jwt_local_id() )
  with check ( local_id = public.jwt_local_id() );

-- ── NOTA sobre app_metadata ──────────────────────────────────────
-- Al dar de alta un usuario, el service_role (Edge Function de admin) debe fijar:
--   app_metadata = { "local_id": "<uuid>", "rol": "empleado|encargado|admin|central" }
-- Ejemplo (server-side, service_role):
--   await supabaseAdmin.auth.admin.updateUserById(userId, {
--     app_metadata: { local_id, rol }
--   })
-- El cliente NUNCA escribe esto. La RLS de arriba lee de ahí vía auth.jwt().
