-- ============================================================================
-- El Hongo Car Wash — Fase 29: acelera el autocompletado de placa/distintivo
-- en Nuevo ticket y agrega búsqueda por distintivo (antes solo placa).
--
-- Dos causas de la lentitud:
--   1) La búsqueda de placa hacía DOS consultas separadas (vehiculos, luego
--      clientes) — un viaje de red extra en cada tecla.
--   2) "ILIKE '%texto%'" sobre placas/tipo_vehiculo no usa ningún índice
--      normal (solo sirven para "empieza con"), así que cada tecla escaneaba
--      la tabla completa.
--
-- Se resuelve con:
--   - pg_trgm + índices GIN de trigramas en placas y tipo_vehiculo, que sí
--     aceleran ILIKE con comodín al inicio.
--   - Una vista que ya trae vehículo + cliente juntos, para que la
--     búsqueda sea una sola consulta en vez de dos.
-- ============================================================================

create extension if not exists pg_trgm;

create index if not exists idx_vehiculos_placas_trgm on public.vehiculos using gin (placas gin_trgm_ops);
create index if not exists idx_vehiculos_tipo_vehiculo_trgm on public.vehiculos using gin (tipo_vehiculo gin_trgm_ops);

-- Sin relación embebida en el tipo Database a propósito (mismo motivo que
-- usuarios_con_correo): postgrest-js infiere mal el tipo si esto se declara
-- bajo "Views" en vez de "Tables" con un literal inline.
create or replace view public.vehiculos_con_cliente as
select
  v.id as vehiculo_id,
  v.placas,
  v.tipo_vehiculo,
  v.cliente_id,
  c.nombre as cliente_nombre,
  c.telefono as cliente_telefono
from public.vehiculos v
join public.clientes c on c.id = v.cliente_id;

grant select on public.vehiculos_con_cliente to authenticated;
