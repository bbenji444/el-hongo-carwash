-- ============================================================================
-- El Hongo Car Wash — Backfill puntual: los 8 tickets de ayer (31 ago) que
-- traían el auto y la placa mezclados en "Distintivo" (antes de que
-- existiera el campo Placa) se separan y se les crea un cliente con la
-- placa ya registrada.
--
-- El NOMBRE del cliente se deja temporalmente como la descripción del auto
-- (ej. "Toyota Yaris gris") — entra a Clientes y renómbralo con el nombre
-- real de la persona en cuanto lo sepas, el resto (placa, historial de esa
-- lavada) no se toca.
--
-- Solo toca estos 8 tickets puntuales por su id — no es una migración de
-- esquema, córrela una sola vez.
-- ============================================================================

begin;

-- 1) Toyota Yaris gris — 925BMJ
insert into public.clientes (id, nombre)
values ('a1000000-0000-4000-8000-000000000001', 'Toyota Yaris gris');
insert into public.vehiculos (id, cliente_id, placas, tipo_vehiculo)
values ('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', '925BMJ', 'Toyota Yaris gris');
update public.tickets
set cliente_id = 'a1000000-0000-4000-8000-000000000001',
    vehiculo_id = 'a1000000-0000-4000-8000-000000000002',
    placa = '925BMJ',
    distintivo = 'Toyota Yaris gris'
where id = 'f3e30de7-4ae0-4a30-950d-3b4cf4d575aa';

-- 2) Cupra Negro — 82J-800
insert into public.clientes (id, nombre)
values ('a2000000-0000-4000-8000-000000000001', 'Cupra Negro');
insert into public.vehiculos (id, cliente_id, placas, tipo_vehiculo)
values ('a2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', '82J-800', 'Cupra Negro');
update public.tickets
set cliente_id = 'a2000000-0000-4000-8000-000000000001',
    vehiculo_id = 'a2000000-0000-4000-8000-000000000002',
    placa = '82J-800',
    distintivo = 'Cupra Negro'
where id = '4ee028f6-3f28-49fd-bfad-a54e1e1b84e9';

-- 3) Mazda CX-30 — RLP-573-C
insert into public.clientes (id, nombre)
values ('a3000000-0000-4000-8000-000000000001', 'Mazda CX-30');
insert into public.vehiculos (id, cliente_id, placas, tipo_vehiculo)
values ('a3000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000001', 'RLP-573-C', 'Mazda CX-30');
update public.tickets
set cliente_id = 'a3000000-0000-4000-8000-000000000001',
    vehiculo_id = 'a3000000-0000-4000-8000-000000000002',
    placa = 'RLP-573-C',
    distintivo = 'Mazda CX-30'
where id = '4560c42a-3bcd-429f-a7c5-de0f1a5fb6bb';

-- 4) Mazda Rojo — PDE-819-B
insert into public.clientes (id, nombre)
values ('a4000000-0000-4000-8000-000000000001', 'Mazda Rojo');
insert into public.vehiculos (id, cliente_id, placas, tipo_vehiculo)
values ('a4000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000001', 'PDE-819-B', 'Mazda Rojo');
update public.tickets
set cliente_id = 'a4000000-0000-4000-8000-000000000001',
    vehiculo_id = 'a4000000-0000-4000-8000-000000000002',
    placa = 'PDE-819-B',
    distintivo = 'Mazda Rojo'
where id = '582f95af-f412-4cfd-b9b9-61bf497f59be';

-- 5) Kia Forte blanco — E19-BHU
insert into public.clientes (id, nombre)
values ('a5000000-0000-4000-8000-000000000001', 'Kia Forte blanco');
insert into public.vehiculos (id, cliente_id, placas, tipo_vehiculo)
values ('a5000000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000001', 'E19-BHU', 'Kia Forte blanco');
update public.tickets
set cliente_id = 'a5000000-0000-4000-8000-000000000001',
    vehiculo_id = 'a5000000-0000-4000-8000-000000000002',
    placa = 'E19-BHU',
    distintivo = 'Kia Forte blanco'
where id = 'ba2a43e7-a6b2-4d19-8da4-ef3cc6c1aab7';

-- 6) BMW X1 Azul — 05G-531
insert into public.clientes (id, nombre)
values ('a6000000-0000-4000-8000-000000000001', 'BMW X1 Azul');
insert into public.vehiculos (id, cliente_id, placas, tipo_vehiculo)
values ('a6000000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000001', '05G-531', 'BMW X1 Azul');
update public.tickets
set cliente_id = 'a6000000-0000-4000-8000-000000000001',
    vehiculo_id = 'a6000000-0000-4000-8000-000000000002',
    placa = '05G-531',
    distintivo = 'BMW X1 Azul'
where id = 'b78dc6fd-d4a1-4133-9328-611e6ca5fd27';

-- 7) Chirey negra — 71G-075 (se conserva la nota "NO PAGÓ" en el distintivo)
insert into public.clientes (id, nombre)
values ('a7000000-0000-4000-8000-000000000001', 'Chirey negra');
insert into public.vehiculos (id, cliente_id, placas, tipo_vehiculo)
values ('a7000000-0000-4000-8000-000000000002', 'a7000000-0000-4000-8000-000000000001', '71G-075', 'Chirey negra');
update public.tickets
set cliente_id = 'a7000000-0000-4000-8000-000000000001',
    vehiculo_id = 'a7000000-0000-4000-8000-000000000002',
    placa = '71G-075',
    distintivo = 'Chirey negra — NO PAGÓ'
where id = 'aaff3aa4-53e1-45bd-89ab-2c316b2770f3';

-- 8) Ford Windstar café — LWG-414-B
insert into public.clientes (id, nombre)
values ('a8000000-0000-4000-8000-000000000001', 'Ford Windstar café');
insert into public.vehiculos (id, cliente_id, placas, tipo_vehiculo)
values ('a8000000-0000-4000-8000-000000000002', 'a8000000-0000-4000-8000-000000000001', 'LWG-414-B', 'Ford Windstar café');
update public.tickets
set cliente_id = 'a8000000-0000-4000-8000-000000000001',
    vehiculo_id = 'a8000000-0000-4000-8000-000000000002',
    placa = 'LWG-414-B',
    distintivo = 'Ford Windstar café'
where id = '4f34e904-fd71-46c4-8336-b4625e1a5009';

commit;
