-- ============================================================================
-- El Hongo Car Wash — Backfill puntual: el ticket de hoy (1 sep) que traía
-- auto + placa + nombre mezclados en "Distintivo".
-- ============================================================================

begin;

-- Chevrolet Onix — PBW-354-B — Don Oscar
insert into public.clientes (id, nombre)
values ('b1000000-0000-4000-8000-000000000001', 'Don Oscar');
insert into public.vehiculos (id, cliente_id, placas, tipo_vehiculo)
values ('b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'PBW-354-B', 'Chevrolet Onix');
update public.tickets
set cliente_id = 'b1000000-0000-4000-8000-000000000001',
    vehiculo_id = 'b1000000-0000-4000-8000-000000000002',
    placa = 'PBW-354-B',
    distintivo = 'Chevrolet Onix'
where id = '0e163e0d-8ca7-4481-be31-8bc0315423f3';

commit;
