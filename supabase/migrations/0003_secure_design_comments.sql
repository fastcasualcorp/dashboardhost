-- ════════════════════════════════════════════════════════════════
-- REBELL · 0003 — ENDURECER design_comments (auditoría de seguridad 24-jun)
--
-- Problema (HALLAZGO confirmado, severidad media-alta): las políticas de 0002
-- abrían la tabla al rol `anon` con `using(true)/with check(true)`. Como la anon
-- key es PÚBLICA (va en el bundle), CUALQUIERA en internet podía leer, insertar,
-- editar y BORRAR todas las notas internas de diseño desde la API REST de Supabase.
--
-- Fix: quitar el acceso `anon`. Solo usuarios AUTENTICADOS (el equipo logueado)
-- gestionan las notas. El `service_role` (server-side, p.ej. el script que las
-- procesa) bypasea RLS por diseño, así que sigue pudiendo leerlas.
--
-- Scoping por local (multi-tenant hermético) = Fase 0 (auth real + app_metadata),
-- igual que ventas/comandas en 0001_init.sql. Esto es el endurecimiento INTERINO
-- que cierra la exposición a internet sin romper el modo comentarios del equipo.
-- ════════════════════════════════════════════════════════════════

drop policy if exists "design_comments: insert" on public.design_comments;
drop policy if exists "design_comments: select" on public.design_comments;
drop policy if exists "design_comments: update" on public.design_comments;
drop policy if exists "design_comments: delete" on public.design_comments;

create policy "design_comments: insert" on public.design_comments
  for insert to authenticated with check (true);
create policy "design_comments: select" on public.design_comments
  for select to authenticated using (true);
create policy "design_comments: update" on public.design_comments
  for update to authenticated using (true) with check (true);
create policy "design_comments: delete" on public.design_comments
  for delete to authenticated using (true);
