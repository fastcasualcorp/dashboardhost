-- ════════════════════════════════════════════════════════════════
-- REBELL · 0004 — design_comments SOLO para el rol `central` (auditoría arquitectura 28-jun, bloqueante #5)
--
-- Problema (confirmado en prod): tras 0003 las policies eran `using(true)` para `authenticated` → cualquier
-- negocio logueado podía LEER/EDITAR/BORRAR las notas de diseño de TODOS los demás (fuga entre tenants).
--
-- Fix: el Modo Comentarios es una herramienta INTERNA del propietario (Fast Casual / central), no de los
-- clientes. Se restringe al rol `central` (leído del JWT, app_metadata.rol). El `service_role` (script que
-- procesa las notas) bypasea RLS por diseño. Cierra la fuga sin tocar el esquema (la columna `local` es
-- texto y hoy guarda basura de test → no sirve para scopear). Si en el futuro se quiere por-local, se hará
-- con un slug fiable.
-- ════════════════════════════════════════════════════════════════

drop policy if exists "design_comments: insert" on public.design_comments;
drop policy if exists "design_comments: select" on public.design_comments;
drop policy if exists "design_comments: update" on public.design_comments;
drop policy if exists "design_comments: delete" on public.design_comments;

create policy "design_comments: central select" on public.design_comments
  for select to authenticated using (public.jwt_rol() = 'central');
create policy "design_comments: central insert" on public.design_comments
  for insert to authenticated with check (public.jwt_rol() = 'central');
create policy "design_comments: central update" on public.design_comments
  for update to authenticated using (public.jwt_rol() = 'central') with check (public.jwt_rol() = 'central');
create policy "design_comments: central delete" on public.design_comments
  for delete to authenticated using (public.jwt_rol() = 'central');
