-- ============================================================================
-- El Hongo Car Wash — Fase 42: subcategoría de producto específico en
-- Gastos (además de la categoría general ya existente) — para poder ver
-- "¿en qué producto concreto se va más el dinero?" (ej. Shampoo,
-- Abrillantador, Detergente), no solo en qué área general (Insumos).
--
-- Es un catálogo editable (como lavadores/servicios_catalogo), no un enum
-- fijo, porque la lista de productos concretos va a seguir creciendo según
-- lo que se compre — a diferencia de la categoría general, que son ~6
-- áreas de negocio que casi nunca cambian.
--
-- Vive en el GASTO mismo (no por renglón de "producto de la compra"): si
-- una compra trae varios productos distintos, se registra como gastos
-- separados, uno por producto — así cada gasto tiene UNA subcategoría
-- clara. Es opcional (gastos como "Sueldos" no son compra de un producto,
-- se dejan sin subcategoría).
-- ============================================================================

create table public.gasto_subcategorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

alter table public.gasto_subcategorias enable row level security;

create policy gasto_subcategorias_select on public.gasto_subcategorias
for select using (public.usuario_rol() in ('dueno', 'encargado'));

create policy gasto_subcategorias_insert on public.gasto_subcategorias
for insert with check (public.usuario_rol() in ('dueno', 'encargado'));

create policy gasto_subcategorias_update on public.gasto_subcategorias
for update using (public.usuario_rol() in ('dueno', 'encargado'));

-- Semilla con los productos específicos que ya aparecen en el historial de
-- gastos (identificados a mano al analizarlo) — se puede seguir agregando
-- más desde la propia pantalla de Gastos conforme se compren cosas nuevas.
insert into public.gasto_subcategorias (nombre) values
  ('Shampoo'),
  ('Abrillantador'),
  ('Detergente'),
  ('Plásticos'),
  ('Fibras'),
  ('Cepillos'),
  ('Conos'),
  ('Espumador'),
  ('Pistola de aire'),
  ('Uniformes'),
  ('Extintores'),
  ('Rótulos/Imagen'),
  ('Combustible')
on conflict (nombre) do nothing;

alter table public.gastos
  add column subcategoria_id uuid references public.gasto_subcategorias (id);

-- ----------------------------------------------------------------------------
-- Backfill de los gastos que ya existían: reclasifica categoría y, cuando
-- aplica, subcategoría — con base en el concepto que ya tenían escrito.
-- Coincide sin importar mayúsculas/espacios (ej. "Sueldos" y "sueldos").
-- ----------------------------------------------------------------------------

update public.gastos set categoria = 'nomina'
where lower(trim(concepto)) in ('sueldos', 'sueldo');

update public.gastos set categoria = 'servicios'
where lower(trim(concepto)) in ('internet', 'luz', 'basura');

update public.gastos set categoria = 'mantenimiento'
where lower(trim(concepto)) in (
  'reparación manguera', 'reparacion manguera', 'plomero', 'mantenimiento', 'comex', 'tiner'
);

update public.gastos set categoria = 'insumos'
where lower(trim(concepto)) in ('dogo', 'dogo productos');

update public.gastos set categoria = 'otros'
where lower(trim(concepto)) in ('disel', 'diesel');

update public.gastos g set
  categoria = 'insumos',
  subcategoria_id = (select id from public.gasto_subcategorias where nombre = 'Shampoo')
where lower(trim(g.concepto)) = 'shampoo';

update public.gastos g set
  categoria = 'insumos',
  subcategoria_id = (select id from public.gasto_subcategorias where nombre = 'Abrillantador')
where lower(trim(g.concepto)) in ('abrillantador liquido', 'abrillantador líquido', 'abrillantador');

update public.gastos g set
  categoria = 'insumos',
  subcategoria_id = (select id from public.gasto_subcategorias where nombre = 'Detergente')
where lower(trim(g.concepto)) = 'detergente';

update public.gastos g set
  categoria = 'insumos',
  subcategoria_id = (select id from public.gasto_subcategorias where nombre = 'Plásticos')
where lower(trim(g.concepto)) in ('plasticos', 'plásticos');

update public.gastos g set
  categoria = 'insumos',
  subcategoria_id = (select id from public.gasto_subcategorias where nombre = 'Fibras')
where lower(trim(g.concepto)) = 'fibras';

update public.gastos g set
  categoria = 'insumos',
  subcategoria_id = (select id from public.gasto_subcategorias where nombre = 'Cepillos')
where lower(trim(g.concepto)) in ('cepillo', 'cepillos');

update public.gastos g set
  categoria = 'insumos',
  subcategoria_id = (select id from public.gasto_subcategorias where nombre = 'Conos')
where lower(trim(g.concepto)) = 'conos';

update public.gastos g set
  categoria = 'insumos',
  subcategoria_id = (select id from public.gasto_subcategorias where nombre = 'Espumador')
where lower(trim(g.concepto)) = 'espumador';

update public.gastos g set
  categoria = 'insumos',
  subcategoria_id = (select id from public.gasto_subcategorias where nombre = 'Pistola de aire')
where lower(trim(g.concepto)) in ('pistola aire', 'pistola de aire');

update public.gastos g set
  categoria = 'otros',
  subcategoria_id = (select id from public.gasto_subcategorias where nombre = 'Uniformes')
where lower(trim(g.concepto)) in ('playeras', 'playera', 'gorras', 'gorra');

update public.gastos g set
  categoria = 'mantenimiento',
  subcategoria_id = (select id from public.gasto_subcategorias where nombre = 'Extintores')
where lower(trim(g.concepto)) in ('extintor', 'extintores');

update public.gastos g set
  categoria = 'otros',
  subcategoria_id = (select id from public.gasto_subcategorias where nombre = 'Rótulos/Imagen')
where lower(trim(g.concepto)) like '%trovicel%';

update public.gastos g set
  categoria = 'otros',
  subcategoria_id = (select id from public.gasto_subcategorias where nombre = 'Combustible')
where lower(trim(g.concepto)) in ('disel', 'diesel');
