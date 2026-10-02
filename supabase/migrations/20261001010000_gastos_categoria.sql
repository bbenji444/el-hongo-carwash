-- ============================================================================
-- El Hongo Car Wash — Fase 41: categorías de gasto, para poder ver "en qué
-- se va más el dinero" de forma visual (gráfica + filtro) en la sección de
-- Gastos. Antes solo existía "concepto" (texto libre), que no sirve para
-- agrupar de forma confiable (cada quien lo escribe distinto).
-- ============================================================================

create type public.gasto_categoria as enum (
  'nomina',
  'insumos',
  'servicios',
  'renta',
  'mantenimiento',
  'otros'
);

-- default 'otros' a propósito: backfillea los gastos ya existentes sin
-- tener que decidir una por una, y sirve de red de seguridad si algo
-- llegara a insertar sin mandar categoría.
alter table public.gastos
  add column categoria public.gasto_categoria not null default 'otros';
