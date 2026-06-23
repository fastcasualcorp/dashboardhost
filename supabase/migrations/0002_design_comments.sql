-- ════════════════════════════════════════════════════════════════
-- REBELL · Modo Comentarios → Supabase
-- Juan deja notas ancladas (+ capturas) por el dashboard y Claude las LEE de
-- aquí para corregirlas todas de una. Así no hace falta exportar/pasar nada.
--
-- ⚠ INTERIM (la app aún no tiene auth real; el login es un selector local):
--   permitimos al rol `anon` insertar/leer/editar estas notas. NO hay datos de
--   cliente aquí — son notas de UI del equipo. ANTES de abrir a clientes reales,
--   endurecer: o bien (a) leer SOLO con service_role (quitar el select de anon),
--   o (b) mover a auth + scoping por local vía app_metadata (como ventas/comandas
--   en 0001_init.sql). Ver [[fidelidad-a-referencias]] de reglas de seguridad.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.design_comments (
  id          uuid primary key default gen_random_uuid(),
  local       text,                 -- id del local/perfil del login (string)
  section     text,                 -- sección activa al crear la nota
  label       text,                 -- etiqueta humana del elemento anclado
  selector    text,                 -- selector CSS del elemento
  instance    int  not null default 0,
  nx          real, ny real,        -- offset normalizado dentro del elemento
  body        text,                 -- el comentario de Juan
  image       text,                 -- dataURL jpeg comprimido (referencia visual)
  done        boolean not null default false,
  client_id   text,                 -- id de navegador para agrupar una tanda
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.design_comments enable row level security;
create index if not exists design_comments_idx on public.design_comments (client_id, created_at desc);

-- INTERIM: anon (y authenticated) gestionan las notas de diseño.
create policy "design_comments: insert" on public.design_comments
  for insert to anon, authenticated with check (true);
create policy "design_comments: select" on public.design_comments
  for select to anon, authenticated using (true);
create policy "design_comments: update" on public.design_comments
  for update to anon, authenticated using (true) with check (true);
create policy "design_comments: delete" on public.design_comments
  for delete to anon, authenticated using (true);
