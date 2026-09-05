-- ============================================================================
-- El Hongo Car Wash — Fase 37: vista con estadísticas por cliente (total de
-- visitas, tipos de vehículo, placas) para poder filtrar Clientes por tipo
-- de vehículo (ej. "Camioneta Grande") y ordenar por número de visitas,
-- todo del lado de la base de datos (para que la paginación siga siendo
-- correcta con el filtro/orden aplicado, no solo sobre la página actual).
-- ============================================================================

create or replace view public.clientes_con_stats as
select
  c.id,
  c.nombre,
  c.telefono,
  count(distinct t.id) filter (where t.estado = 'entregado') as total_visitas,
  max(t.hora_salida) filter (where t.estado = 'entregado') as ultima_lavada,
  coalesce(array_agg(distinct v.tipo_vehiculo) filter (where v.tipo_vehiculo is not null), '{}') as tipos_vehiculo,
  coalesce(array_agg(distinct v.placas) filter (where v.placas is not null), '{}') as placas
from public.clientes c
left join public.tickets t on t.cliente_id = c.id
left join public.vehiculos v on v.cliente_id = c.id
group by c.id, c.nombre, c.telefono;

grant select on public.clientes_con_stats to authenticated;
