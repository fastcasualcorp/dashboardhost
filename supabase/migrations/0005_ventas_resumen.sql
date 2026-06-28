-- ════════════════════════════════════════════════════════════════
-- REBELL · 0005 — RPC de agregación SERVER-SIDE de ventas (auditoría 28-jun, datos reales)
--
-- Problema: el panel sumaba en el CLIENTE sobre solo .limit(400) ventas → en un local con volumen, el
-- "total del mes" / gráficas MENTÍAN (infravaloraban). Fix: agregar en Postgres sobre TODAS las filas.
--
-- ventas_resumen(desde, hasta) → una fila por DÍA (hora local Europe/Madrid) con total, efectivo, tarjeta y
-- nº de tickets, SOLO del local del que llama (jwt_local_id() del JWT). SECURITY DEFINER con search_path fijo
-- y filtro explícito por local_id = aislamiento multi-tenant hermético (no expone datos de otros). anon NO
-- recibe execute → la key pública no puede llamarlo.
-- ════════════════════════════════════════════════════════════════

create or replace function public.ventas_resumen(desde date, hasta date)
returns table (dia date, total numeric, efectivo numeric, tarjeta numeric, tickets bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ((v.creado_at at time zone 'Europe/Madrid')::date) as dia,
    coalesce(sum(v.total), 0) as total,
    coalesce(sum(case when v.metodo = 'efectivo' then v.total else 0 end), 0) as efectivo,
    coalesce(sum(case when v.metodo is distinct from 'efectivo' then v.total else 0 end), 0) as tarjeta,
    count(*) as tickets
  from public.ventas v
  where v.local_id = public.jwt_local_id()
    and ((v.creado_at at time zone 'Europe/Madrid')::date) between desde and hasta
  group by 1
  order by 1;
$$;

revoke all on function public.ventas_resumen(date, date) from public, anon;
grant execute on function public.ventas_resumen(date, date) to authenticated;
