-- ════════════════════════════════════════════════════════════════
-- REBELL · APLICAR TODO DE UNA VEZ  (pega esto en Supabase → SQL Editor → Run)
-- Idempotente: se puede ejecutar varias veces sin romper nada.
-- Crea el esquema multi-tenant + las tablas del Salón. Después, Claude crea los
-- locales/usuarios y conecta la app usando la service_role (solo server-side).
-- Reglas: autorización en auth.users.app_metadata (solo service_role escribe);
-- RLS lo lee con auth.jwt(); cada fila lleva local_id; default-deny.
-- ════════════════════════════════════════════════════════════════

-- ── helpers de claims ──
create or replace function public.jwt_local_id() returns uuid
  language sql stable set search_path = ''
as $$ select nullif(auth.jwt() -> 'app_metadata' ->> 'local_id', '')::uuid $$;

create or replace function public.jwt_rol() returns text
  language sql stable set search_path = ''
as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'rol', 'none') $$;

-- ── locales (tenants) ──
create table if not exists public.locales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  ciudad text,
  accent text not null default 'gold',
  created_at timestamptz not null default now()
);
alter table public.locales enable row level security;
drop policy if exists "locales: ver el propio" on public.locales;
create policy "locales: ver el propio" on public.locales for select to authenticated
  using ( id = public.jwt_local_id() or public.jwt_rol() = 'central' );

-- ── perfiles (1:1 con auth.users) ──
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  local_id uuid references public.locales(id) on delete set null,
  nombre text,
  rol text not null default 'empleado' check (rol in ('empleado','encargado','admin','central')),
  avatar text,
  created_at timestamptz not null default now()
);
alter table public.perfiles enable row level security;
drop policy if exists "perfiles: verme a mí o a los de mi local" on public.perfiles;
create policy "perfiles: verme a mí o a los de mi local" on public.perfiles for select to authenticated
  using ( id = auth.uid() or local_id = public.jwt_local_id() or public.jwt_rol() = 'central' );

-- ── ventas (scoped por local) ──
create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locales(id) on delete cascade,
  total numeric(10,2) not null,
  metodo text not null check (metodo in ('efectivo','tarjeta','domicilio')),
  mesa text,
  doc text not null default 'ticket' check (doc in ('ticket','factura')),
  creado_at timestamptz not null default now()
);
alter table public.ventas add column if not exists mesa text;
alter table public.ventas add column if not exists doc text not null default 'ticket';
alter table public.ventas add column if not exists numero int;
alter table public.ventas add column if not exists arts int default 0;
alter table public.ventas add column if not exists fuente text default 'Sala';
alter table public.ventas enable row level security;
-- slug del local (el QR del cliente trae ?l=<slug>; la Edge Function lo resuelve a local_id)
alter table public.locales add column if not exists slug text;
create unique index if not exists locales_slug_idx on public.locales (slug) where slug is not null;
create index if not exists ventas_local_idx on public.ventas (local_id, creado_at desc);
drop policy if exists "ventas: ver las de mi local" on public.ventas;
create policy "ventas: ver las de mi local" on public.ventas for select to authenticated
  using ( local_id = public.jwt_local_id() or public.jwt_rol() = 'central' );
drop policy if exists "ventas: insertar en mi local" on public.ventas;
create policy "ventas: insertar en mi local" on public.ventas for insert to authenticated
  with check ( local_id = public.jwt_local_id() );

-- ── comandas (KDS, scoped por local) ──
create table if not exists public.comandas (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locales(id) on delete cascade,
  numero int not null,
  fuente text not null default 'Sala',
  mesa text,
  items jsonb not null default '[]',
  estado text not null default 'nueva' check (estado in ('nueva','prep','lista','servida')),
  creado_at timestamptz not null default now()
);
alter table public.comandas add column if not exists mesa text;
alter table public.comandas enable row level security;
create index if not exists comandas_local_idx on public.comandas (local_id, estado);
drop policy if exists "comandas: ver las de mi local" on public.comandas;
create policy "comandas: ver las de mi local" on public.comandas for select to authenticated
  using ( local_id = public.jwt_local_id() or public.jwt_rol() = 'central' );
drop policy if exists "comandas: gestionar las de mi local" on public.comandas;
create policy "comandas: gestionar las de mi local" on public.comandas for all to authenticated
  using ( local_id = public.jwt_local_id() ) with check ( local_id = public.jwt_local_id() );

-- ── mesas (plano del Salón, scoped por local) ──
create table if not exists public.mesas (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locales(id) on delete cascade,
  nombre text not null,
  x int not null default 0,
  y int not null default 0,
  w int not null default 110,
  h int not null default 110,
  sillas int not null default 4,
  forma text not null default 'cuadrada' check (forma in ('cuadrada','rect','redonda')),
  orden int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.mesas enable row level security;
create index if not exists mesas_local_idx on public.mesas (local_id, orden);
drop policy if exists "mesas: gestionar las de mi local" on public.mesas;
create policy "mesas: gestionar las de mi local" on public.mesas for all to authenticated
  using ( local_id = public.jwt_local_id() ) with check ( local_id = public.jwt_local_id() );

-- ── M4: permitir forma 'ele' (su ausencia GARANTIZABA pérdida del plano) + rotación ──
alter table public.mesas drop constraint if exists mesas_forma_check;
alter table public.mesas add constraint mesas_forma_check check (forma in ('cuadrada','rect','redonda','ele'));
alter table public.mesas add column if not exists rot int not null default 0;

-- ── Realtime: avisos EN VIVO de comandas/ventas/mesas (cross-device). Idempotente. ──
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='comandas')
    then alter publication supabase_realtime add table public.comandas; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ventas')
    then alter publication supabase_realtime add table public.ventas; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mesas')
    then alter publication supabase_realtime add table public.mesas; end if;
end $$;

-- ── Pedido online ATÓMICO y TRANSACCIONAL (lo llama la Edge Function) ──
-- nº de comanda por local con lock (sin carrera) + comanda+venta en UNA transacción
-- (o las dos o ninguna → nunca venta huérfana). SECURITY DEFINER, search_path fijo,
-- solo ejecutable por service_role (la Edge Function). (cierra hallazgos de la review)
create or replace function public.crear_pedido_online(p_slug text, p_mesa text, p_items jsonb, p_total numeric, p_arts int)
returns int language plpgsql security definer set search_path = '' as $$
declare v_local uuid; v_num int;
begin
  select id into v_local from public.locales where slug = lower(p_slug);
  if v_local is null then raise exception 'local-desconocido' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtext(v_local::text)); -- serializa la numeración por local
  select coalesce(max(numero), 0) + 1 into v_num from public.comandas where local_id = v_local;
  insert into public.comandas (local_id, numero, fuente, mesa, items, estado)
    values (v_local, v_num, 'Online', p_mesa, p_items, 'nueva');
  insert into public.ventas (local_id, total, metodo, mesa, doc, numero, arts, fuente)
    values (v_local, p_total, 'tarjeta', p_mesa, 'ticket', v_num, p_arts, 'Online');
  return v_num;
end $$;
revoke all on function public.crear_pedido_online(text, text, jsonb, numeric, int) from public, anon, authenticated;
grant execute on function public.crear_pedido_online(text, text, jsonb, numeric, int) to service_role;

-- Listo. Ahora Claude crea los locales + usuarios (service_role) y conecta la app.
