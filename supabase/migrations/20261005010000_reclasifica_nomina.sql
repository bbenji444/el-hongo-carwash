-- ============================================================================
-- El Hongo Car Wash — Fase 45: reclasificación de los gastos de Nómina
-- históricos. Cada "Sueldos" semanal ya estaba desglosado por persona
-- (gasto_items: un renglón por quién cobró cuánto), solo que con apodos y
-- variantes de nombre en vez del nombre exacto que usa cada lavador en el
-- sistema — se homologan para que la gráfica de "¿a quién se le ha pagado
-- cuánto?" los pueda relacionar.
--
-- Se agregan 4 personas que no estaban en el catálogo de lavadores:
-- Manuel ya existía (era "Memo"). Cris y Octavio ya no trabajan aquí
-- (se agregan inactivos, solo para conservar su histórico). Fani es la
-- encargada actual — no es lavadora de oficio, pero se agrega igual
-- porque también cobra nómina y se quiere ver su historial. Brenda fue
-- encargada y ya no trabaja aquí (se agrega inactiva).
-- ============================================================================

insert into public.lavadores (nombre, activo)
select v.nombre, v.activo
from (values ('Cris', false), ('Octavio', false), ('Fani', true), ('Brenda', false)) as v(nombre, activo)
where not exists (
  select 1 from public.lavadores l where lower(trim(l.nombre)) = lower(v.nombre)
);

-- Homologa los renglones de "productos de la compra" de cada Sueldos para
-- que el nombre de cada persona coincida exacto con su nombre de lavador
-- (las variantes que solo cambian mayúsculas/minúsculas ya empatan solas,
-- esto es para las que cambian de verdad: apodos, acentos, nombre
-- completo).
update public.gasto_items set producto = 'Manuel'
where gasto_id in (select id from public.gastos where categoria = 'nomina')
  and lower(trim(producto)) = 'memo';

update public.gasto_items set producto = 'Daniel Colombia'
where gasto_id in (select id from public.gastos where categoria = 'nomina')
  and lower(trim(producto)) = 'colombia';

update public.gasto_items set producto = 'Geovanni'
where gasto_id in (select id from public.gastos where categoria = 'nomina')
  and lower(trim(producto)) in ('giovanni', 'giovani');

update public.gasto_items set producto = 'Alejandro Güero'
where gasto_id in (select id from public.gastos where categoria = 'nomina')
  and lower(trim(producto)) = 'guero';

update public.gasto_items set producto = 'Benjamin'
where gasto_id in (select id from public.gastos where categoria = 'nomina')
  and lower(trim(producto)) in ('benajamin', 'benja');
