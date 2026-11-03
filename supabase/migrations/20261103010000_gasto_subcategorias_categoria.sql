-- ============================================================================
-- El Hongo Car Wash — Opciones de gastos por categoría, administrables desde
-- Ajustes.
--
-- Cada opción ("producto específico" / concepto: Fabuloso, Luz, Extintores…)
-- queda ligada a una categoría general de gasto, para que el formulario de
-- Gastos solo muestre las que corresponden a la categoría elegida. Las
-- categorías generales siguen siendo las 6 fijas (enum gasto_categoria).
-- Una opción sin categoría (null) se muestra en todas.
--
-- También se agrega la política de borrado (solo dueño, que es quien entra
-- a Ajustes). Una opción que ya usa algún gasto no se puede borrar (llave
-- foránea gastos.subcategoria_id) — en ese caso se desactiva.
-- ============================================================================

alter table public.gasto_subcategorias
  add column if not exists categoria gasto_categoria;

drop policy if exists gasto_subcategorias_delete on public.gasto_subcategorias;
create policy gasto_subcategorias_delete on public.gasto_subcategorias
for delete using (public.usuario_rol() = 'dueno');
