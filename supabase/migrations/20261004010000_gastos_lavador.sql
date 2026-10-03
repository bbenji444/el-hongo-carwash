-- ============================================================================
-- El Hongo Car Wash — Fase 44: liga opcional entre un gasto y un lavador —
-- pensado para Nómina ("¿cuánto se le ha pagado a Fulano en total?"), para
-- poder cruzarlo en la página de cada lavador con sus autos lavados,
-- ventas, etc. Sin "on delete cascade" a propósito: igual que
-- ticket_lavadores, si un lavador tiene gastos de nómina ligados no se
-- puede borrar (se bloquea con el mismo tipo de error que ya usa
-- eliminarLavador), para no perder el histórico de pagos.
-- ============================================================================

alter table public.gastos
  add column lavador_id uuid references public.lavadores (id);

create index gastos_lavador_id_idx on public.gastos (lavador_id);
