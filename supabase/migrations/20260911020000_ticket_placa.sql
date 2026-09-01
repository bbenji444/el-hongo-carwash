-- ============================================================================
-- El Hongo Car Wash — Fase 27: agrega "Placa" como campo independiente en el
-- ticket, junto a "Distintivo" (no en su lugar).
--
-- Antes la placa solo se podía capturar cuando el ticket ya tenía un
-- cliente registrado (se guardaba ligada a su ficha en la tabla vehiculos).
-- Ahora se puede anotar la placa igual que el distintivo, sin importar si
-- hay cliente o no — los dos campos van siempre juntos y visibles en el
-- formulario. Cuando SÍ hay cliente, además se sigue ligando a su ficha en
-- vehiculos (para que aparezca en el listado de Clientes), pero eso ya no
-- es requisito para poder anotar la placa en el ticket.
-- ============================================================================

alter table public.tickets
  add column if not exists placa text;
