-- ============================================================================
-- El Hongo Car Wash — Pago a lavadores por comisión + vehículos Taxi y Van.
--
-- 1) A partir de hoy a cada lavador se le paga el 35% del precio de LISTA
--    del paquete de cada auto que lava (sin extras, aunque tenga descuento
--    o sea la lavada gratis). La comisión se guarda al registrar el ticket,
--    en el mismo renglón que liga el ticket con su lavador
--    (ticket_lavadores, cuya llave primaria ticket+lavador ya impide
--    duplicados). Tickets anteriores se quedan sin comisión (null).
--
-- 2) Nuevos tamaños de vehículo: Taxi y Van. Sus precios por paquete se
--    capturan en servicios_precios igual que los demás (no van fijos en
--    código como las motos).
--
-- Nota: Postgres no deja USAR un valor de enum recién agregado dentro de la
-- misma transacción — aquí solo se agregan; los precios se siembran después.
-- ============================================================================

alter type tamano_vehiculo add value if not exists 'taxi';
alter type tamano_vehiculo add value if not exists 'van';

alter table public.ticket_lavadores
  add column if not exists comision numeric(10, 2),
  add column if not exists base_comision numeric(10, 2);
