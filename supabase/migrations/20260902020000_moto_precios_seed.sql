-- ============================================================================
-- El Hongo Car Wash — Fase 18b: siembra precios para Moto Chica y Moto
-- Grande (paso 2 de 2 — corre esto DESPUÉS de que
-- 20260902010000_moto_tamanos_enum.sql ya haya quedado aplicada).
--
-- Para cada paquete que ya existe, copia el precio de "automóvil" como
-- punto de partida para los dos tamaños de moto nuevos (evita que se vean
-- en $0.00 hasta que el dueño los ajuste desde Servicios/Ajustes). No pisa
-- un precio que ya se haya capturado a mano si esto se vuelve a correr.
-- ============================================================================

insert into public.servicios_precios (servicio_id, tamano_vehiculo, precio)
select sp.servicio_id, tv.tamano, sp.precio
from public.servicios_precios sp
cross join (values ('moto_chica'::tamano_vehiculo), ('moto_grande'::tamano_vehiculo)) as tv(tamano)
where sp.tamano_vehiculo = 'automovil'
on conflict (servicio_id, tamano_vehiculo) do nothing;
