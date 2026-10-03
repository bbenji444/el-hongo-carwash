-- ============================================================================
-- El Hongo Car Wash — Fase 43: reclasificación de las compras "Dogo"/"Dogo
-- productos" que quedaron sin producto específico en la Fase 42, porque son
-- compras mixtas (varias cosas en un solo ticket).
--
-- Nada se borra ni se divide: 3 de los 4 gastos "Dogo" ya estaban
-- desglosados en renglones (gasto_items, la función de "productos de la
-- compra") con los nombres tal cual los escribieron — se verificaron
-- contra las cotizaciones adjuntas (PDF/foto) y cuadran centavo a centavo.
-- Al cuarto ("Dogo", $3,460.00) le faltaban esos renglones; se agregan
-- aquí tomados directo de su cotización adjunta (Cot004448_2.pdf).
--
-- Se homologan los nombres de producto (ej. "Jabón manos" -> "Jabón de
-- manos", variantes de "Deposito"/"Depisito" -> "Depósito/Envase", los tres
-- aromas -> "Aromatizante") para que cada renglón coincida con una
-- subcategoría del catálogo — así la gráfica de "en qué producto se va más
-- el dinero" reparte el monto de estas compras mixtas entre sus productos
-- reales, en vez de dejarlas sin clasificar. El renglón "Iva" se deja tal
-- cual (no es un producto, no se le pone subcategoría).
-- ============================================================================

insert into public.gasto_subcategorias (nombre) values
  ('Cloro'),
  ('Limpiador multiusos'),
  ('Desengrasante'),
  ('Depósito/Envase'),
  ('Teflón'),
  ('Aromatizante'),
  ('Lubricante para interiores'),
  ('Jabón de manos'),
  ('Atomizador'),
  ('Embudo')
on conflict (nombre) do nothing;

-- Gasto $3,460.00 (31/ago) — no tenía renglones, se agregan desde su
-- cotización adjunta (Cot004448_2.pdf). Suma exacta: 80+120+920+60+640+60
-- +400+110+960+110 = 3460.00.
insert into public.gasto_items (gasto_id, producto, cantidad, precio_unitario) values
  ('aa24e376-fd93-45f5-8121-acfe8cd0fafa', 'Cloro', 10, 8.00),
  ('aa24e376-fd93-45f5-8121-acfe8cd0fafa', 'Limpiador multiusos', 10, 12.00),
  ('aa24e376-fd93-45f5-8121-acfe8cd0fafa', 'Desengrasante', 40, 23.00),
  ('aa24e376-fd93-45f5-8121-acfe8cd0fafa', 'Depósito/Envase', 1, 60.00),
  ('aa24e376-fd93-45f5-8121-acfe8cd0fafa', 'Abrillantador', 20, 32.00),
  ('aa24e376-fd93-45f5-8121-acfe8cd0fafa', 'Depósito/Envase', 1, 60.00),
  ('aa24e376-fd93-45f5-8121-acfe8cd0fafa', 'Teflón', 20, 20.00),
  ('aa24e376-fd93-45f5-8121-acfe8cd0fafa', 'Depósito/Envase', 1, 110.00),
  ('aa24e376-fd93-45f5-8121-acfe8cd0fafa', 'Abrillantador', 20, 48.00),
  ('aa24e376-fd93-45f5-8121-acfe8cd0fafa', 'Depósito/Envase', 1, 110.00);

-- Gasto $3,229.44 (01/sep) — ya tenía renglones; se homologan sus nombres.
update public.gasto_items set producto = 'Jabón de manos'
where gasto_id = 'c440d1ae-5bae-41f8-885a-75426e0d7323' and producto = 'Jabón manos';

update public.gasto_items set producto = 'Depósito/Envase'
where gasto_id = 'c440d1ae-5bae-41f8-885a-75426e0d7323' and producto in ('Deposito', 'Depisito');

-- Gasto $1,460.00 (17/sep) — ya tenía renglones; se homologan sus nombres.
update public.gasto_items set producto = 'Teflón'
where gasto_id = 'dd046775-2431-415b-9f85-caf5f52c153c' and producto = 'Teflon';

update public.gasto_items set producto = 'Lubricante para interiores'
where gasto_id = 'dd046775-2431-415b-9f85-caf5f52c153c' and producto = 'Crema interior';

-- Gasto $3,190.00 (28/sep) — ya tenía renglones; se homologan sus nombres
-- (los tres aromas se agrupan en una sola subcategoría "Aromatizante").
update public.gasto_items set producto = 'Aromatizante'
where gasto_id = '9530e10a-11b7-4a63-b210-efcba22bcbbf'
  and producto in ('Aroma polo', 'Aroma coco', 'Aroma chanes');
