-- ════════════════════════════════════════════════════════════════
-- REBELL · 0006 — canal de la venta (Sala vs Online) en la tabla `ventas`
--
-- El panel "Canal online" necesita distinguir las ventas que entran por el QR self-order (/pedir) de las del
-- TPV/sala, para sus KPIs de hoy (pedidos · facturado · ticket medio) SIN inventar números. Antes no había
-- forma de separarlas. Añadimos una columna `fuente` ('Sala' por defecto; 'Online' en los pedidos por QR).
-- `if not exists` = idempotente y seguro de re-aplicar.
-- ════════════════════════════════════════════════════════════════

alter table public.ventas
  add column if not exists fuente text not null default 'Sala'
  check (fuente in ('Sala', 'Online'));
