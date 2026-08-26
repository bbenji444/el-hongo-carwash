-- ============================================================================
-- El Hongo Car Wash — Fase 13: stock mínimo para filtrar "stock bajo".
--
-- El inventario solo tenía stock_actual, sin ningún umbral para saber si
-- ese nivel ya es preocupante. Se agrega stock_minimo (configurable por
-- insumo desde la UI) para poder filtrar y exportar el listado de lo que
-- se está quedando bajo. Se usa IF NOT EXISTS por si esta migración ya se
-- corrió parcialmente antes.
-- ============================================================================

alter table public.inventario
  add column if not exists stock_minimo numeric(12, 3) not null default 10 check (stock_minimo >= 0);
