-- ════════════════════════════════════════════════════════════════════
-- REGISTRO DE ACCESOS (auditoría de seguridad) — quién entra / abre / cierra
-- caja, desde qué IP y dispositivo. La IP la captura la Edge Function `acceso`
-- (server-side) → el cliente no puede falsearla. Solo la GERENCIA del local lo
-- LEE (sensible, contiene IP = dato personal). Nadie escribe directo: la verdad
-- la inserta la Edge Function con service_role.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.accesos (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locales(id) on delete cascade,
  usuario text not null,                 -- email del que accede
  evento text not null check (evento in ('login','abrir_caja','cerrar_caja')),
  ip text,
  dispositivo text,
  creado_at timestamptz not null default now()
);
alter table public.accesos enable row level security;
create index if not exists accesos_local_idx on public.accesos (local_id, creado_at desc);

-- Solo la GERENCIA (admin/encargado/central) de MI local LEE. Sin política de
-- insert para `authenticated` → nadie escribe directo (default-deny); inserta la
-- Edge Function con service_role.
drop policy if exists "accesos: gerencia lee" on public.accesos;
create policy "accesos: gerencia lee" on public.accesos for select to authenticated
  using ( local_id = public.jwt_local_id() and public.jwt_rol() in ('admin','encargado','central') );

-- Realtime: el registro aparece EN VIVO (ves cuando alguien abre caja en otro dispositivo).
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='accesos')
    then alter publication supabase_realtime add table public.accesos; end if;
end $$;

notify pgrst, 'reload schema';
