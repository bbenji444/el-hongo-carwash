-- ============================================================================
-- El Hongo Car Wash — Fase 24: reemplaza "Placas" en el ticket por un
-- "Distintivo" libre (ej. "Mazda gris", "BMW negro") que NO depende de que
-- el cliente tenga un registro ni de la tabla vehiculos — es solo una
-- etiqueta temporal en el propio ticket para identificar el auto a simple
-- vista mientras está en el mostrador/patio.
--
-- La tabla vehiculos (placas ligadas a un cliente registrado) se deja tal
-- cual — sigue usándose para el historial de vehículos por cliente en
-- /clientes — esto solo agrega un campo nuevo, independiente, en tickets.
-- ============================================================================

alter table public.tickets
  add column if not exists distintivo text;
